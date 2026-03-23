import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ==========================================
// S3/MinIO upload helpers (same pattern as upload-to-s3)
// ==========================================
async function sha256(message: string | Uint8Array): Promise<string> {
  const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function signRequest(
  method: string, url: URL, headers: Record<string, string>, body: Uint8Array,
  accessKeyId: string, secretAccessKey: string, region: string, service: string
): Promise<Record<string, string>> {
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);
  const allHeaders = { ...headers, 'x-amz-date': datetime };
  const signedHeaderNames = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
  const canonicalHeaders = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`).sort().join('\n') + '\n';
  const payloadHash = await sha256(body);
  const canonicalRequest = [method, url.pathname, url.search.slice(1), canonicalHeaders, signedHeaderNames, payloadHash].join('\n');
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, await sha256(canonicalRequest)].join('\n');
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return { ...allHeaders, 'x-amz-content-sha256': payloadHash, 'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}` };
}

async function uploadToS3(fileContent: Uint8Array, key: string, contentType: string): Promise<string> {
  const endpoint = Deno.env.get('GLOBAL_S3_ENDPOINT') || '';
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') || '';
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || '';
  const bucket = 'n8nback';
  const region = 'us-east-1';
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const baseHeaders: Record<string, string> = { 'Host': url.host, 'Content-Type': contentType, 'Content-Length': fileContent.length.toString() };
  const signedHeaders = await signRequest('PUT', url, baseHeaders, fileContent, accessKeyId, secretAccessKey, region, 's3');
  const response = await fetch(url.toString(), { method: 'PUT', headers: signedHeaders, body: fileContent });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S3 upload failed: ${response.status} - ${errorText}`);
  }
  return `${endpoint}/${bucket}/${key}`;
}

// ==========================================
// Gemini Files API helpers
// ==========================================
async function uploadToGeminiFiles(pdfBytes: Uint8Array, displayName: string, apiKey: string): Promise<string> {
  // Step 1: Start resumable upload to get upload URI
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': pdfBytes.length.toString(),
        'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { displayName } }),
    }
  );

  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('Failed to get Gemini upload URL');

  // Step 2: Upload the bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Length': pdfBytes.length.toString(),
    },
    body: pdfBytes,
  });

  if (!uploadRes.ok) throw new Error(`Gemini file upload failed: ${uploadRes.status}`);
  const data = await uploadRes.json();
  const fileUri = data.file?.uri;
  if (!fileUri) throw new Error('No file URI returned from Gemini');

  // Step 3: Wait for file to be ACTIVE
  const fileName = data.file?.name;
  for (let i = 0; i < 10; i++) {
    const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
    const status = await statusRes.json();
    if (status.state === 'ACTIVE') return fileUri;
    await new Promise(r => setTimeout(r, 2000));
  }
  // Return anyway, might still work
  return fileUri;
}

async function deleteGeminiFile(fileUri: string, apiKey: string): Promise<void> {
  try {
    // Extract file name from URI: "https://...googleapis.com/v1beta/files/abc123" -> "files/abc123"
    const match = fileUri.match(/files\/[a-z0-9]+/i);
    if (match) {
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${match[0]}?key=${apiKey}`, { method: 'DELETE' });
    }
  } catch { /* cleanup, don't fail */ }
}

// ==========================================
// Gemini generateContent call
// ==========================================
async function callGemini(fileUri: string, prompt: string, apiKey: string, timeoutMs = 60000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { fileData: { mimeType: 'application/pdf', fileUri } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err.substring(0, 300)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiInline(base64Data: string, mimeType: string, prompt: string, apiKey: string, timeoutMs = 60000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192, mediaResolution: 'high' },
        }),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini inline API error: ${response.status} - ${err.substring(0, 300)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// pdf-lib: split PDF into page ranges
// ==========================================
async function splitPdfPages(pdfBytes: Uint8Array, startPage: number, endPage: number): Promise<Uint8Array> {
  const { PDFDocument } = await import('https://cdn.skypack.dev/pdf-lib@1.17.1');
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const actualEnd = Math.min(endPage, totalPages);

  if (startPage > totalPages) return new Uint8Array(0);

  const newDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: actualEnd - startPage + 1 }, (_, i) => startPage - 1 + i);
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach(page => newDoc.addPage(page));

  const bytes = await newDoc.save();
  return new Uint8Array(bytes);
}

async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('https://cdn.skypack.dev/pdf-lib@1.17.1');
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

// ==========================================
// unpdf: extract text per page
// ==========================================
async function extractTextPerPage(pdfBytes: Uint8Array): Promise<Map<number, string>> {
  const { getDocumentProxy, extractText } = await import('npm:unpdf');
  const doc = await getDocumentProxy(pdfBytes);
  const result = await extractText(doc, { mergePages: false });
  const pageTexts = new Map<number, string>();

  const pages = result.text || result.pages || result;
  if (Array.isArray(pages)) {
    pages.forEach((text: string, idx: number) => {
      pageTexts.set(idx + 1, typeof text === 'string' ? text.trim() : '');
    });
  }
  return pageTexts;
}

// ==========================================
// Visual detection prompt
// ==========================================
const DETECTION_PROMPT = `# ROLE
You are a precise document structure analyzer.

# TASK
Analyze ALL pages in this PDF and identify which ones contain NON-TEXTUAL VISUAL ELEMENTS.

# VISUAL ELEMENTS (qualify)
- Photographs or illustrations
- Diagrams, flowcharts, mind maps, network graphs
- Statistical charts (bar, pie, line, scatter, area)
- Mathematical or chemical formulas with symbols/notation
- Screenshots or UI captures
- Technical drawings or schematics

# DO NOT QUALIFY (IGNORE THESE)
- Purely decorative elements like repeated logos, company branding, headers, and footers
- Paragraphs, headings, subheadings
- Bullet points or numbered lists
- Plain text tables (rows and columns of text only)
- Source code blocks
- Footnotes, captions, page numbers

# OUTPUT FORMAT
Respond with ONLY a valid JSON object. No explanation, no markdown, no extra text.
{"pages_with_visuals": [<page numbers as integers>]}

If no visual elements found: {"pages_with_visuals": []}`;

// ==========================================
// Visual description prompt (per page)
// ==========================================
function getDescriptionPrompt(pageNumber: number): string {
  return `# ROLE
You are a specialist in describing visual elements from documents for accessibility and semantic indexing purposes.

# TASK
Analyze page ${pageNumber} of this document and describe ONLY the non-textual visual elements present.

# FOR EACH VISUAL ELEMENT, provide:
1. "anchor_text": The EXACT verbatim text phrase (10-20 words) that appears IMMEDIATELY BEFORE the visual element in the reading flow. This will be used to insert the description at the correct position.
   - If the visual appears before any text on the page, use: "__PAGE_START__"
   - If the visual appears after all text on the page, use: "__PAGE_END__"
2. "description": A detailed, self-contained description prefixed EXACTLY with "Descripción de imagen: "

# DESCRIPTION GUIDELINES
- Charts/graphs: State the chart type, what data it represents, axis labels, key values, trends, and any visible legends.
- Diagrams/flowcharts: Describe the elements, their relationships, direction of flow, and what process/concept is represented.
- Images/photos: Describe the subject, visible objects, people (if any), colors, and any embedded text.
- Formulas: Describe what the formula calculates or represents, its variables, and their meaning.
- Tables with visuals: Describe the visual cells specifically.

# CONSTRAINTS
- Describe ONLY visual elements. Do NOT transcribe or paraphrase surrounding text.
- IGNORE purely decorative page elements such as recurring logos, company branding, headers, and footers.
- Do NOT add commentary, summaries, or page-level descriptions.
- If the page contains NO visual elements (or only decorative ones), return: {"visuals": []}

# OUTPUT FORMAT
Respond with ONLY a valid JSON object:
{
  "visuals": [
    {
      "anchor_text": "exact text phrase immediately before the visual",
      "description": "Descripción de imagen: [detailed description here]"
    }
  ]
}`;
}

// ==========================================
// DOCX image description prompt
// ==========================================
const DOCX_IMAGE_DESCRIPTION_PROMPT = `# ROL
Eres un especialista en describir elementos visuales de documentos para indexación semántica y accesibilidad. Tu objetivo es que alguien que NO puede ver la imagen entienda su contenido completo con absoluto detalle.

# TAREA
Describe exhaustivamente el elemento visual de esta imagen. No omitas ningún detalle.

# REGLAS OBLIGATORIAS
- TRANSCRIBE LITERALMENTE todo el texto visible en la imagen, sin excepción: títulos, etiquetas, nodos, cajas, flechas con texto, leyendas, notas al margen, bullets, porcentajes, números. Si hay texto, debe aparecer en tu descripción tal como está escrito.
- NO resumas ni parafrasees el texto de la imagen. Cópialo tal cual.
- Describe la estructura visual completa: posición relativa de cada elemento (arriba, abajo, izquierda, derecha, centro), colores de cada bloque/nodo/caja, tipos de flechas (sólidas, punteadas, direcciones).

# SEGÚN EL TIPO DE IMAGEN

**Diagramas de flujo / arquitecturas:**
1. Título principal y subtítulos
2. Cada nodo/caja: texto exacto, color, forma, posición
3. Cada flecha o conector: origen, destino, dirección, texto sobre la flecha si existe
4. Agrupaciones o secciones diferenciadas
5. Anotaciones, notas o textos flotantes
6. Elementos en esquinas o márgenes

**Gráficas/charts:**
Tipo de gráfica, título, ejes con sus etiquetas y unidades, todos los valores visibles, leyenda completa, tendencias.

**Tablas:**
Encabezados de todas las columnas y filas, contenido de cada celda.

**Fórmulas:**
Fórmula exacta, variables y su significado.

**Fotos:**
Sujeto principal, objetos visibles, texto incrustado, colores dominantes.

# RESTRICCIONES
- Responde en español.
- Sin JSON, sin markdown de código, solo texto plano estructurado.
- Sé exhaustivo: una descripción incompleta es un error.`;

// ==========================================
// DOCX image extraction helpers
// ==========================================
interface DocxImage {
  index: number;
  base64: string;
  mimeType: string;
  placeholder: string;
}

async function extractDocxWithImages(arrayBuffer: ArrayBuffer): Promise<{
  textWithPlaceholders: string;
  images: DocxImage[];
}> {
  const mammothModule = await import('npm:mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const images: DocxImage[] = [];
  let imgIndex = 0;

  const options = {
    convertImage: mammoth.images.imgElement(function(image: any) {
      const placeholder = `%%IMG_PLACEHOLDER_${imgIndex}%%`;
      const currentIndex = imgIndex++;
      return image.read("base64").then(function(base64Data: string) {
        images.push({
          index: currentIndex,
          base64: base64Data,
          mimeType: image.contentType || 'image/png',
          placeholder
        });
        return { src: '', alt: placeholder };
      });
    })
  };

  const result = await mammoth.convertToHtml({ buffer: arrayBuffer }, options);
  const html = result.value || '';

  // Convert HTML to plain text preserving image placeholder positions
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<img[^>]*alt="(%%IMG_PLACEHOLDER_\d+%%)"[^>]*>/gi, '\n\n$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { textWithPlaceholders: text, images };
}

// ==========================================
// Merge page text + visual descriptions
// ==========================================
interface VisualElement {
  anchor_text: string;
  description: string;
}

function mergePageContent(pageText: string, visuals: VisualElement[]): string {
  if (!visuals || visuals.length === 0) return pageText;

  let result = pageText;

  // Sort by position in text (earliest first), then reverse for safe insertion
  const positioned = visuals
    .map(v => ({
      ...v,
      pos: v.anchor_text === '__PAGE_START__' ? -1
        : v.anchor_text === '__PAGE_END__' ? Infinity
        : pageText.indexOf(v.anchor_text)
    }))
    .sort((a, b) => b.pos - a.pos); // reverse: insert from end to preserve indices

  for (const v of positioned) {
    const insertion = `\n\n${v.description}\n\n`;
    if (v.anchor_text === '__PAGE_START__') {
      result = insertion.trim() + '\n\n' + result;
    } else if (v.anchor_text === '__PAGE_END__' || v.pos < 0) {
      result = result + insertion;
    } else {
      const insertAt = v.pos + v.anchor_text.length;
      result = result.slice(0, insertAt) + insertion + result.slice(insertAt);
    }
  }

  return result.trim();
}

function parseJsonFromGemini(text: string): any {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('Failed to parse Gemini JSON:', cleaned.substring(0, 200));
    return null;
  }
}

// ==========================================
// MAIN HANDLER
// ==========================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('file_name') as string || file?.name || 'document';
    const userId = formData.get('user_id') as string || 'unknown';

    if (!file) throw new Error('No file provided');

    const fileSizeMB = file.size / 1024 / 1024;
    console.log(`Processing: ${fileName} | Type: ${file.type} | Size: ${fileSizeMB.toFixed(2)}MB`);

    if (file.size > 50 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: `Archivo demasiado grande (${fileSizeMB.toFixed(1)}MB). Máximo: 50MB.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    let mimeType = file.type || '';
    if (!mimeType) {
      if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else mimeType = 'text/plain';
    }

    // ========== TXT files: read directly ==========
    if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = new TextDecoder().decode(pdfBytes);
      console.log(`TXT file: ${text.length} chars, no AI needed`);

      // Save to MinIO
      const s3Key = `processed-documents/${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
      let contentUrl = '';
      try {
        contentUrl = await uploadToS3(new TextEncoder().encode(text), s3Key, 'text/plain; charset=utf-8');
        console.log('Saved processed text to:', contentUrl);
      } catch (e) { console.warn('S3 save failed (non-critical):', e); }

      return new Response(
        JSON.stringify({ success: true, extracted_text: text, file_name: fileName, extraction_method: 'direct_read', text_length: text.length, content_url: contentUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== DOCX files: mammoth + Gemini image descriptions ==========
    if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      console.log('=== DOCX EXTRACTION WITH IMAGE DESCRIPTIONS ===');

      // STEP 1: Extract HTML with images, convert to text with placeholders
      console.log('STEP 1: Extracting DOCX content and images with mammoth...');
      let textWithPlaceholders: string;
      let docxImages: DocxImage[];

      try {
        const extracted = await extractDocxWithImages(arrayBuffer);
        textWithPlaceholders = extracted.textWithPlaceholders;
        docxImages = extracted.images;
        console.log(`DOCX extracted: ${textWithPlaceholders.length} chars, ${docxImages.length} images found`);
      } catch (extractError) {
        // FALLBACK: if convertToHtml fails, fall back to extractRawText
        console.warn('DOCX image extraction failed, falling back to plain text:', extractError);
        const mammothFallback = await import('npm:mammoth');
        const mFallback = mammothFallback.default || mammothFallback;
        const result = await mFallback.extractRawText({ buffer: arrayBuffer });
        const text = result.value || '';
        console.log(`DOCX fallback extracted: ${text.length} chars`);

        const s3Key = `processed-documents/${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
        let contentUrl = '';
        try {
          contentUrl = await uploadToS3(new TextEncoder().encode(text), s3Key, 'text/plain; charset=utf-8');
        } catch (e) { console.warn('S3 save failed:', e); }

        return new Response(
          JSON.stringify({ success: true, extracted_text: text, file_name: fileName, extraction_method: 'mammoth_fallback', text_length: text.length, content_url: contentUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // STEP 2: If no images, return text directly (fast path)
      if (docxImages.length === 0) {
        console.log('No images in DOCX, returning text directly');
        const s3Key = `processed-documents/${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
        let contentUrl = '';
        try {
          contentUrl = await uploadToS3(new TextEncoder().encode(textWithPlaceholders), s3Key, 'text/plain; charset=utf-8');
        } catch (e) { console.warn('S3 save failed:', e); }

        return new Response(
          JSON.stringify({ success: true, extracted_text: textWithPlaceholders, file_name: fileName, extraction_method: 'mammoth_no_images', text_length: textWithPlaceholders.length, images_found: 0, content_url: contentUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // STEP 3: Describe images with Gemini in parallel batches
      console.log(`STEP 2: Describing ${docxImages.length} images with Gemini...`);
      const DOCX_PARALLEL_BATCH_SIZE = 5;
      const imageDescriptions = new Map<string, string>();

      // Filter out images that are too large (> 4MB base64)
      const processableImages = docxImages.filter(img => {
        if (img.base64.length > 4 * 1024 * 1024) {
          console.warn(`Image ${img.index}: skipped (too large: ${(img.base64.length / 1024 / 1024).toFixed(1)}MB base64)`);
          imageDescriptions.set(img.placeholder, 'Descripción de imagen: [Imagen demasiado grande para procesar]');
          return false;
        }
        return true;
      });

      for (let i = 0; i < processableImages.length; i += DOCX_PARALLEL_BATCH_SIZE) {
        const batch = processableImages.slice(i, i + DOCX_PARALLEL_BATCH_SIZE);
        console.log(`Processing image batch ${Math.floor(i / DOCX_PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(processableImages.length / DOCX_PARALLEL_BATCH_SIZE)}...`);

        await Promise.all(batch.map(async (img) => {
          try {
            const rawDescription = await callGeminiInline(
              img.base64, img.mimeType, DOCX_IMAGE_DESCRIPTION_PROMPT, geminiApiKey, 30000
            );
            if (rawDescription && rawDescription.trim().length > 0) {
              const description = rawDescription.trim().startsWith('Descripci')
                ? rawDescription.trim()
                : `Descripción de imagen: ${rawDescription.trim()}`;
              imageDescriptions.set(img.placeholder, description);
              console.log(`Image ${img.index}: described (${description.length} chars)`);
            } else {
              imageDescriptions.set(img.placeholder, 'Descripción de imagen: [No se pudo generar descripción]');
              console.warn(`Image ${img.index}: empty response from Gemini`);
            }
          } catch (e) {
            console.warn(`Image ${img.index} description failed:`, e instanceof Error ? e.message : e);
            imageDescriptions.set(img.placeholder, 'Descripción de imagen: [Error al procesar imagen]');
          }
        }));
      }

      // STEP 4: Replace placeholders with descriptions
      console.log('STEP 3: Merging descriptions into text...');
      let finalText = textWithPlaceholders;
      for (const [placeholder, description] of imageDescriptions) {
        finalText = finalText.replace(placeholder, description);
      }

      // Clean up any unreplaced placeholders
      finalText = finalText.replace(/%%IMG_PLACEHOLDER_\d+%%/g, '').replace(/\n{3,}/g, '\n\n').trim();

      console.log(`Final DOCX content: ${finalText.length} chars (${docxImages.length} images, ${imageDescriptions.size} described)`);

      // STEP 5: Save to S3 and return
      const s3Key = `processed-documents/${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
      let contentUrl = '';
      try {
        contentUrl = await uploadToS3(new TextEncoder().encode(finalText), s3Key, 'text/plain; charset=utf-8');
        console.log('Saved processed DOCX text to:', contentUrl);
      } catch (e) { console.warn('S3 save failed:', e); }

      return new Response(
        JSON.stringify({
          success: true, extracted_text: finalText, file_name: fileName,
          extraction_method: 'mammoth_gemini_images', text_length: finalText.length,
          images_found: docxImages.length, images_described: imageDescriptions.size,
          content_url: contentUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== PDF files: hybrid pipeline ==========
    console.log('=== HYBRID PDF EXTRACTION PIPELINE ===');

    // STEP 1: Extract text from all pages with unpdf
    console.log('STEP 1: Extracting text with unpdf...');
    let pageTexts = new Map<number, string>();
    try {
      pageTexts = await extractTextPerPage(pdfBytes);
      console.log(`unpdf: extracted text from ${pageTexts.size} pages`);
    } catch (e) {
      console.error('unpdf failed:', e);
      // If unpdf fails entirely (corrupted PDF?), all pages get processed by Gemini
    }

    const totalPages = pageTexts.size > 0 ? pageTexts.size : await getPdfPageCount(pdfBytes);
    console.log(`Total pages: ${totalPages}`);

    // STEP 2: Detect visual elements in blocks of 10 pages
    console.log('STEP 2: Detecting visual elements...');
    const pagesWithVisuals = new Set<number>();
    const BLOCK_SIZE = 10;

    for (let startPage = 1; startPage <= totalPages; startPage += BLOCK_SIZE) {

      const endPage = Math.min(startPage + BLOCK_SIZE - 1, totalPages);
      console.log(`Detecting visuals in pages ${startPage}-${endPage}...`);

      let blockFileUri = '';
      try {
        // Split PDF to this block
        const blockBytes = await splitPdfPages(pdfBytes, startPage, endPage);
        if (blockBytes.length === 0) continue;

        // Upload block to Gemini Files API
        blockFileUri = await uploadToGeminiFiles(blockBytes, `${fileName}_p${startPage}-${endPage}`, geminiApiKey);

        // Ask Gemini to detect visual pages (fast timeout for detection)
        const detectionResult = await callGemini(blockFileUri, DETECTION_PROMPT, geminiApiKey, 20000);
        const parsed = parseJsonFromGemini(detectionResult);

        if (parsed?.pages_with_visuals && Array.isArray(parsed.pages_with_visuals)) {
          for (const pageNum of parsed.pages_with_visuals) {
            // Convert block-relative page numbers to absolute
            const absolutePageNum = typeof pageNum === 'number' ? (startPage + pageNum - 1) : pageNum;
            // Validate it's within range
            if (absolutePageNum >= startPage && absolutePageNum <= endPage) {
              pagesWithVisuals.add(absolutePageNum);
            } else if (pageNum >= startPage && pageNum <= endPage) {
              // Gemini might return absolute page numbers already
              pagesWithVisuals.add(pageNum);
            }
          }
        }

        console.log(`Block p${startPage}-${endPage}: visuals on pages [${[...pagesWithVisuals].filter(p => p >= startPage && p <= endPage).join(', ')}]`);
      } catch (e) {
        console.warn(`Visual detection failed for block p${startPage}-${endPage}:`, e instanceof Error ? e.message : e);
        // Skip detection for this block, pages use unpdf text only
      } finally {
        if (blockFileUri) deleteGeminiFile(blockFileUri, geminiApiKey);
      }
    }

    console.log(`Total pages with visuals: ${pagesWithVisuals.size} of ${totalPages}`);

    // Handle scanned PDFs: if unpdf returned very little text, process all pages through Gemini
    const totalTextLength = [...pageTexts.values()].reduce((sum, t) => sum + t.length, 0);
    const isLikelyScanned = totalPages > 0 && (totalTextLength / totalPages) < 50;
    if (isLikelyScanned) {
      console.log('WARNING: PDF appears to be scanned (avg text per page < 50 chars). All pages need Gemini for text extraction.');
      // For scanned PDFs, we add all pages to visuals set so they get full Gemini treatment
      for (let i = 1; i <= totalPages; i++) pagesWithVisuals.add(i);
    }

    // STEP 3: Get detailed visual descriptions for flagged pages
    console.log('STEP 3: Generating visual descriptions...');
    const pageVisualDescriptions = new Map<number, VisualElement[]>();

    // Process in parallel batches to avoid hitting Supabase 150s wall clock limit or CPU limit
    const visualPagesArray = Array.from(pagesWithVisuals);
    const PARALLEL_BATCH_SIZE = 5;

    for (let i = 0; i < visualPagesArray.length; i += PARALLEL_BATCH_SIZE) {
      const batch = visualPagesArray.slice(i, i + PARALLEL_BATCH_SIZE);
      console.log(`Processing visuals batch: pages [${batch.join(', ')}]...`);

      await Promise.all(batch.map(async (pageNum) => {
        let pageFileUri = '';
        try {
          const pageBytes = await splitPdfPages(pdfBytes, pageNum, pageNum);
          if (pageBytes.length === 0) return;

          pageFileUri = await uploadToGeminiFiles(pageBytes, `${fileName}_p${pageNum}`, geminiApiKey);

          let prompt = getDescriptionPrompt(pageNum);

          const hasText = (pageTexts.get(pageNum)?.length || 0) > 30;
          if (!hasText) {
            prompt = `# ROLE\nYou are a specialist document content extractor.\n# TASK\nThis page appears to be a scanned document. Extract ALL text content AND describe ANY visual elements.\n# CONSTRAINTS\n- IGNORE purely decorative page elements such as recurring logos, company branding, headers, and footers.\n# OUTPUT FORMAT\nRespond with ONLY a valid JSON object:\n{\n  "page_text": "All text content",\n  "visuals": [{ "anchor_text": "__PAGE_END__", "description": "Descripción de imagen: [detail]" }]\n}`;
          }

          // Description timeout
          const descResult = await callGemini(pageFileUri, prompt, geminiApiKey, 30000);
          const parsed = parseJsonFromGemini(descResult);

          if (parsed) {
            if (!hasText && parsed.page_text) {
              pageTexts.set(pageNum, parsed.page_text);
            }
            if (parsed.visuals && Array.isArray(parsed.visuals) && parsed.visuals.length > 0) {
              pageVisualDescriptions.set(pageNum, parsed.visuals);
              console.log(`Page ${pageNum}: ${parsed.visuals.length} visual(s) described`);
            } else {
              console.log(`Page ${pageNum}: no visuals found`);
            }
          }
        } catch (e) {
          console.warn(`Visual description failed for page ${pageNum}:`, e instanceof Error ? e.message : e);
        } finally {
          if (pageFileUri) deleteGeminiFile(pageFileUri, geminiApiKey);
        }
      }));
    }

    // STEP 4: Merge all pages in order
    console.log('STEP 4: Merging content...');
    const finalParts: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageText = pageTexts.get(pageNum) || '';
      const visuals = pageVisualDescriptions.get(pageNum) || [];
      const merged = mergePageContent(pageText, visuals);

      if (merged.length > 0) {
        finalParts.push(merged);
      }
    }

    const finalText = finalParts.join('\n\n');
    console.log(`Final merged content: ${finalText.length} chars (${totalPages} pages, ${pagesWithVisuals.size} with visuals, ${pageVisualDescriptions.size} with descriptions)`);

    if (finalText.length < 10) {
      return new Response(
        JSON.stringify({
          success: true,
          extracted_text: `Documento: ${fileName}\n\n[No se pudo extraer contenido. El documento puede estar vacío, protegido o ser de baja calidad. Usa la opción "Pegar Texto" como alternativa.]`,
          file_name: fileName, extraction_method: 'empty'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: Save processed text to MinIO for auditing
    const s3Key = `processed-documents/${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
    let contentUrl = '';
    try {
      contentUrl = await uploadToS3(new TextEncoder().encode(finalText), s3Key, 'text/plain; charset=utf-8');
      console.log('Saved processed text to MinIO:', contentUrl);
    } catch (e) {
      console.warn('S3 save failed (non-critical):', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text: finalText,
        file_name: fileName,
        extraction_method: 'hybrid_unpdf_gemini',
        text_length: finalText.length,
        total_pages: totalPages,
        pages_with_visuals: [...pagesWithVisuals],
        visual_descriptions_generated: pageVisualDescriptions.size,
        content_url: contentUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting text:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

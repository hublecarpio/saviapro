import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Extract text from a specific page range using AI
async function extractPageRange(
  base64: string,
  mimeType: string,
  fileName: string,
  startPage: number,
  endPage: number,
  apiKey: string
): Promise<{ text: string; success: boolean }> {
  try {
    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Eres un extractor de texto de documentos. Extrae TODO el texto visible SOLAMENTE de las páginas ${startPage} a ${endPage} del documento.

Reglas:
1. Extrae SOLO el texto de las páginas ${startPage} a ${endPage}
2. Mantén la estructura lógica (títulos, párrafos, listas, tablas)
3. Si hay tablas, conviértelas a texto estructurado
4. No agregues comentarios ni explicaciones, solo el texto extraído
5. Si hay imágenes con texto, intenta extraer ese texto (OCR)
6. Responde SOLO con el texto extraído, nada más
7. Si las páginas están vacías o no existen, responde con "[EMPTY]"`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extrae el texto de las páginas ${startPage}-${endPage} de este documento (${fileName}):` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 16000,
        }),
      },
      55000 // 55s timeout per page range
    );

    if (!response.ok) {
      console.error(`AI extraction failed for pages ${startPage}-${endPage}: ${response.status}`);
      return { text: "", success: false };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    if (text === "[EMPTY]" || text.length < 5) {
      return { text: "", success: true };
    }

    return { text, success: true };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error(`Error extracting pages ${startPage}-${endPage}:`, isTimeout ? 'TIMEOUT' : error);
    return { text: "", success: false };
  }
}

// Full document extraction in one shot (for small docs)
async function extractFullDocument(
  base64: string,
  mimeType: string,
  fileName: string,
  apiKey: string
): Promise<{ text: string; success: boolean }> {
  try {
    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Eres un extractor de texto de documentos. Tu tarea es extraer TODO el texto visible del documento proporcionado.

Reglas:
1. Extrae el texto completo, incluyendo títulos, párrafos, listas, tablas, etc.
2. Mantén la estructura lógica del documento
3. Si hay tablas, conviértelas a texto estructurado
4. No agregues comentarios ni explicaciones, solo el texto extraído
5. Si hay imágenes con texto, intenta extraer ese texto también (OCR)
6. Responde SOLO con el texto extraído del documento, nada más`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extrae todo el texto de este documento (${fileName}):` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 16000,
        }),
      },
      55000
    );

    if (!response.ok) {
      return { text: "", success: false };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return { text, success: text.length > 10 };
  } catch (error) {
    console.error('Full extraction error:', error);
    return { text: "", success: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('file_name') as string || file?.name || 'document';
    
    if (!file) {
      throw new Error("No file provided");
    }

    const fileSizeMB = file.size / 1024 / 1024;
    console.log('Processing file:', fileName, 'Type:', file.type, 'Size:', `${fileSizeMB.toFixed(2)}MB`);

    // Hard limit at 20MB
    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Archivo demasiado grande (${fileSizeMB.toFixed(1)}MB). Máximo permitido: 20MB.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const arrayBuffer = await file.arrayBuffer();
    const base64 = base64Encode(arrayBuffer);
    
    let mimeType = file.type;
    if (!mimeType) {
      if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else mimeType = 'application/octet-stream';
    }

    console.log('Base64 length:', base64.length);

    // Strategy: Try full extraction first for files under 3MB
    if (fileSizeMB <= 3) {
      console.log('Small file - attempting full extraction');
      const result = await extractFullDocument(base64, mimeType, fileName, lovableApiKey);
      
      if (result.success && result.text.length > 10) {
        console.log('Full extraction succeeded:', result.text.length, 'chars');
        return new Response(
          JSON.stringify({
            success: true,
            extracted_text: result.text,
            file_name: fileName,
            extraction_method: 'ai_full',
            text_length: result.text.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      console.log('Full extraction failed, falling through to paginated');
    }

    // Paginated extraction for larger files or when full extraction fails
    // Process in page ranges of 5 pages, in parallel batches of 2
    const PAGE_RANGE_SIZE = 5;
    const MAX_PAGES = 100; // safety limit
    const PARALLEL_BATCHES = 2;
    
    console.log('Starting paginated extraction');
    
    const allTexts: string[] = [];
    let currentPage = 1;
    let emptyCount = 0;
    
    while (currentPage <= MAX_PAGES && emptyCount < 2) {
      // Create batch of parallel requests
      const batchPromises: Promise<{ text: string; success: boolean; startPage: number }>[] = [];
      
      for (let b = 0; b < PARALLEL_BATCHES; b++) {
        const startPage = currentPage + (b * PAGE_RANGE_SIZE);
        const endPage = startPage + PAGE_RANGE_SIZE - 1;
        
        if (startPage > MAX_PAGES) break;
        
        batchPromises.push(
          extractPageRange(base64, mimeType, fileName, startPage, endPage, lovableApiKey)
            .then(result => ({ ...result, startPage }))
        );
      }
      
      if (batchPromises.length === 0) break;
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.text && result.text.length > 5) {
          allTexts.push(result.text);
          emptyCount = 0;
        } else if (result.success) {
          // Page range was empty - might be past end of document
          emptyCount++;
        } else {
          // Request failed - don't count as empty, might be transient
          console.warn(`Failed to extract pages starting at ${result.startPage}`);
        }
      }
      
      currentPage += PARALLEL_BATCHES * PAGE_RANGE_SIZE;
      console.log(`Processed up to page ${currentPage - 1}, total text parts: ${allTexts.length}`);
    }

    const fullText = allTexts.join('\n\n');
    
    if (fullText.length < 10) {
      return new Response(
        JSON.stringify({
          success: true,
          extracted_text: `Documento: ${fileName}\n\n[No se pudo extraer texto del documento. Puede estar vacío, ser una imagen escaneada, o estar protegido. Usa la opción "Pegar Texto" como alternativa.]`,
          file_name: fileName,
          extraction_method: 'empty'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Paginated extraction complete: ${fullText.length} chars from ${allTexts.length} page ranges`);

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text: fullText,
        file_name: fileName,
        extraction_method: 'ai_paginated',
        text_length: fullText.length,
        page_ranges_processed: allTexts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error extracting text:', error);
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: isTimeout 
          ? 'La extracción tardó demasiado. Intenta con un archivo más pequeño o usa "Pegar Texto".' 
          : (error instanceof Error ? error.message : 'Unknown error'),
        success: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: isTimeout ? 504 : 500 }
    );
  }
});

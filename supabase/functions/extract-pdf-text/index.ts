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

// Extract text from the entire document (or a page range) using AI
async function extractText(
  base64: string,
  mimeType: string,
  fileName: string,
  apiKey: string,
  pageInstruction?: string
): Promise<{ text: string; success: boolean }> {
  const pageContext = pageInstruction || "todo el documento";
  try {
    const response = await fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Eres un extractor de texto de documentos. Extrae TODO el texto visible de ${pageContext}.

Reglas:
1. Mantén la estructura lógica (títulos, párrafos, listas, tablas)
2. Si hay tablas, conviértelas a texto estructurado
3. No agregues comentarios ni explicaciones, solo el texto extraído
4. Si hay imágenes con texto, intenta extraer ese texto (OCR)
5. Responde SOLO con el texto extraído, nada más
6. Si las páginas están vacías o no existen, responde con "[EMPTY]"`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extrae el texto de ${pageContext} de este documento (${fileName}):` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 16000,
        }),
      },
      60000
    );

    if (!response.ok) {
      console.error(`AI extraction failed for ${pageContext}: ${response.status}`);
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
    console.error(`Error extracting ${pageContext}:`, isTimeout ? 'TIMEOUT' : error);
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

    // Hard limit at 10MB to prevent memory issues
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Archivo demasiado grande (${fileSizeMB.toFixed(1)}MB). Máximo permitido: 10MB. Usa la opción "Pegar Texto" como alternativa.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    
    // Convert to base64 - use Uint8Array to minimize memory
    const arrayBuffer = await file.arrayBuffer();
    const base64 = base64Encode(arrayBuffer);
    
    let mimeType = file.type;
    if (!mimeType) {
      if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else mimeType = 'application/octet-stream';
    }

    console.log('Base64 length:', base64.length);

    // For files under 4MB: single full extraction (most memory-efficient)
    if (fileSizeMB <= 4) {
      console.log('Attempting full extraction');
      const result = await extractText(base64, mimeType, fileName, geminiApiKey);
      
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
      console.log('Full extraction failed, trying paginated');
    }

    // For larger files or when full fails: SEQUENTIAL page extraction (no parallel to save memory)
    const PAGE_RANGE_SIZE = 10;
    const MAX_PAGES = 60;
    
    console.log('Starting sequential paginated extraction');
    
    const allTexts: string[] = [];
    let emptyCount = 0;
    
    for (let startPage = 1; startPage <= MAX_PAGES && emptyCount < 2; startPage += PAGE_RANGE_SIZE) {
      const endPage = startPage + PAGE_RANGE_SIZE - 1;
      const pageInstruction = `las páginas ${startPage} a ${endPage}`;
      
      console.log(`Extracting pages ${startPage}-${endPage}...`);
      const result = await extractText(base64, mimeType, fileName, geminiApiKey, pageInstruction);
      
      if (result.text && result.text.length > 5) {
        allTexts.push(result.text);
        emptyCount = 0;
      } else if (result.success) {
        emptyCount++;
      }
      
      console.log(`Done pages ${startPage}-${endPage}, parts: ${allTexts.length}, empty streak: ${emptyCount}`);
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

    console.log(`Paginated extraction complete: ${fullText.length} chars from ${allTexts.length} parts`);

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

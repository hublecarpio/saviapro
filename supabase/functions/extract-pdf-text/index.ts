import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Processing file:', fileName, 'Type:', file.type, 'Size:', file.size);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    // Convertir archivo a base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Determinar el mime type
    let mimeType = file.type;
    if (!mimeType) {
      if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else mimeType = 'application/octet-stream';
    }

    // Usar Gemini con capacidad multimodal para extraer texto del PDF
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
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
5. Si el documento está en español, mantén el español
6. Si hay imágenes con texto, intenta extraer ese texto también (OCR)
7. Responde SOLO con el texto extraído del documento, nada más`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extrae todo el texto de este documento (${fileName}):`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI extraction error:", response.status, errorText);
      
      // Si falla la extracción multimodal, intentar con descripción
      if (response.status === 400 || response.status === 422) {
        console.log("Multimodal extraction failed, returning filename as content");
        return new Response(
          JSON.stringify({
            success: true,
            extracted_text: `Documento: ${fileName}\n\n[El contenido de este archivo PDF no pudo ser extraído automáticamente. Por favor, copia y pega el texto manualmente usando la opción "Pegar Texto".]`,
            file_name: fileName,
            extraction_method: 'fallback'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    console.log('Extracted text length:', extractedText.length);

    if (!extractedText || extractedText.length < 10) {
      return new Response(
        JSON.stringify({
          success: true,
          extracted_text: `Documento: ${fileName}\n\n[No se pudo extraer texto del documento. Puede estar vacío, ser una imagen, o estar protegido.]`,
          file_name: fileName,
          extraction_method: 'empty'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text: extractedText,
        file_name: fileName,
        extraction_method: 'ai_multimodal',
        text_length: extractedText.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error extracting text:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

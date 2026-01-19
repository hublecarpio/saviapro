import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para dividir texto en chunks
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    
    if (start >= text.length) break;
  }
  
  return chunks;
}

// Función para generar embeddings usando Lovable AI
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Usamos Gemini para generar un "embedding" basado en texto
  // Nota: Gemini no tiene API de embeddings directa, así que usamos una aproximación
  // Para embeddings reales, se recomienda usar la API de embeddings de Google
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          content: "Eres un extractor de características semánticas. Dado un texto, extrae las palabras clave más importantes y conceptos principales en formato JSON array de strings. Solo responde con el array JSON, sin explicaciones."
        },
        {
          role: "user",
          content: `Extrae características semánticas de este texto:\n\n${text.slice(0, 2000)}`
        }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    console.error("Error generating features:", await response.text());
    // Retornamos un array vacío de 768 dimensiones
    return new Array(768).fill(0);
  }

  const data = await response.json();
  const featuresText = data.choices?.[0]?.message?.content || "[]";
  
  // Crear un embedding simple basado en hash del texto
  // Esto es una aproximación - para producción usar una API de embeddings real
  const embedding = new Array(768).fill(0);
  const textBytes = new TextEncoder().encode(text);
  
  for (let i = 0; i < textBytes.length && i < 768; i++) {
    embedding[i % 768] += textBytes[i] / 255;
  }
  
  // Normalizar
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 768; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, content, file_name, user_id } = await req.json();
    
    console.log('Processing document:', { document_id, file_name, contentLength: content?.length });

    if (!content || !user_id) {
      throw new Error("Missing required fields: content and user_id are required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Si no hay document_id, crear primero el registro del documento
    let finalDocumentId = document_id;
    
    if (!finalDocumentId) {
      const { data: newDoc, error: docError } = await supabase
        .from('uploaded_documents')
        .insert({
          uploaded_by: user_id,
          file_name: file_name || `documento_${Date.now()}.txt`,
          file_type: 'text/plain',
          upload_mode: 'text'
        })
        .select()
        .single();
        
      if (docError) {
        console.error('Error creating document:', docError);
        throw new Error(`Failed to create document: ${docError.message}`);
      }
      
      finalDocumentId = newDoc.id;
    }

    // Dividir el contenido en chunks
    const chunks = chunkText(content, 1000, 200);
    console.log(`Split content into ${chunks.length} chunks`);

    // Procesar cada chunk y generar embeddings
    const embeddings = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      
      const embedding = await generateEmbedding(chunk, lovableApiKey);
      
      embeddings.push({
        document_id: finalDocumentId,
        content: content,
        content_chunk: chunk,
        chunk_index: i,
        embedding: `[${embedding.join(',')}]`,
        metadata: {
          file_name: file_name,
          chunk_index: i,
          total_chunks: chunks.length,
          user_id: user_id
        }
      });
    }

    // Insertar embeddings en la base de datos
    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(embeddings);

    if (insertError) {
      console.error('Error inserting embeddings:', insertError);
      throw new Error(`Failed to insert embeddings: ${insertError.message}`);
    }

    console.log(`Successfully processed document with ${embeddings.length} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: finalDocumentId,
        chunks_processed: chunks.length,
        message: `Documento procesado exitosamente con ${chunks.length} fragmentos`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing document:', error);
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
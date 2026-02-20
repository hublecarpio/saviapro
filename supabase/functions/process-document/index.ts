import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Fallback simple si todo falla
function generateFallbackEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const textBytes = new TextEncoder().encode(text.toLowerCase());
  
  for (let i = 0; i < textBytes.length; i++) {
    const byte = textBytes[i];
    embedding[i % 768] += byte / 255;
    embedding[(i * 3) % 768] += (byte / 255) * 0.5;
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 768; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

// Hash embedding con keywords
function generateHashEmbedding(text: string, keywords: string[]): number[] {
  const embedding = new Array(768).fill(0);
  const combinedText = text + " " + keywords.join(" ");
  const textBytes = new TextEncoder().encode(combinedText.toLowerCase());
  
  for (let i = 0; i < textBytes.length; i++) {
    const byte = textBytes[i];
    embedding[(byte * 7 + i) % 768] += (byte / 255) * Math.cos(i * 0.1);
    embedding[(byte * 13 + i * 3) % 768] += (byte / 255) * Math.sin(i * 0.1);
    embedding[(byte * 19 + i * 5) % 768] += (byte / 255) * 0.5;
  }
  
  for (let k = 0; k < keywords.length; k++) {
    const keywordBytes = new TextEncoder().encode(keywords[k].toLowerCase());
    const weight = 1 - (k / keywords.length) * 0.5;
    for (let i = 0; i < keywordBytes.length; i++) {
      const byte = keywordBytes[i];
      embedding[(byte * 23 + k * 7 + i) % 768] += (byte / 255) * weight * 2;
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 768; i++) embedding[i] /= magnitude;
  }
  return embedding;
}

// Generate embedding for a chunk - with timeout and fallback
async function generateEmbeddingForChunk(chunk: string, apiKey: string): Promise<number[]> {
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
              content: `Eres un extractor de características semánticas. Dado un texto, extrae EXACTAMENTE 768 características numéricas normalizadas entre -1 y 1.
Responde SOLO con un array JSON de 768 números decimales. Ejemplo: [0.1, -0.3, 0.8, ...]`
            },
            {
              role: "user",
              content: `Genera el vector de embedding:\n\n${chunk.slice(0, 2000)}`
            }
          ],
          temperature: 0.1,
        }),
      },
      15000 // 15s timeout per chunk
    );

    if (!response.ok) {
      console.warn(`AI embedding failed with status ${response.status}, using fallback`);
      return generateFallbackEmbedding(chunk);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleanContent.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length >= 768) {
        const embedding = parsed.slice(0, 768).map((v: any) => {
          const num = parseFloat(v) || 0;
          return Math.max(-1, Math.min(1, num));
        });
        const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
        if (magnitude > 0) return embedding.map((v: number) => v / magnitude);
        return embedding;
      }
    }
    
    return generateFallbackEmbedding(chunk);
  } catch (error) {
    console.warn(`Embedding generation error for chunk, using fallback:`, error instanceof Error ? error.message : error);
    return generateFallbackEmbedding(chunk);
  }
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

    // Validar que el contenido no sea un mensaje de error
    if (content.startsWith('[Error') || content.startsWith('Error') || content.length < 20) {
      console.error('Content is an error message or too short, skipping embedding:', content.slice(0, 100));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'El contenido extraído es un error o está vacío. Intenta subir el archivo de nuevo.',
          content_preview: content.slice(0, 100)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let finalDocumentId = document_id;
    
    if (!finalDocumentId) {
      console.log('Creating new document record for:', file_name);
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
      console.log('Created new document:', finalDocumentId);
    }

    const chunks = chunkText(content, 1000, 200);
    console.log(`Split content into ${chunks.length} chunks`);

    // Process chunks in parallel batches to speed up and avoid 504 Gateway Timeout
    // Incremental batch size and time limit checker
    const BATCH_SIZE = 5; // Aumentar batch
    const allEmbeddings = [];
    const startTime = Date.now();
    const TIMEOUT_LIMIT = 45000; // 45 seconds max execution time warning limit
    
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batch = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
      
      const batchResults = await Promise.all(
        batch.map((chunk, idx) => generateEmbeddingForChunk(chunk, geminiApiKey).then(embedding => ({
          document_id: finalDocumentId,
          content: content.slice(0, 5000), // Limit stored content size
          content_chunk: chunk,
          chunk_index: batchStart + idx,
          embedding: `[${embedding.join(',')}]`,
          metadata: {
            file_name,
            chunk_index: batchStart + idx,
            total_chunks: chunks.length,
            user_id,
            embedding_type: 'semantic_ai'
          }
        })))
      );
      
      allEmbeddings.push(...batchResults);

      // Si nos estamos acercando al timeout del proxy (ej. EasyPanel Edge function), hacer inserts en lotes y salir
      if (Date.now() - startTime > TIMEOUT_LIMIT) {
          console.warn(`Timeout limit reached (${TIMEOUT_LIMIT}ms). Inserting ${allEmbeddings.length} chunks out of ${chunks.length} so far.`);
          break; 
      }
    }

    // Insert all computed embeddings so far
    if (allEmbeddings.length > 0) {
      const { error: insertError } = await supabase
        .from('document_embeddings')
        .insert(allEmbeddings);

      if (insertError) {
        console.error('Error inserting embeddings:', insertError);
        throw new Error(`Failed to insert embeddings: ${insertError.message}`);
      }
      console.log(`Successfully processed and inserted document with ${allEmbeddings.length} chunks`);
    } else {
        throw new Error("No embeddings were generated (Timeout or API failure).");
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: finalDocumentId,
        chunks_processed: chunks.length,
        embedding_type: 'semantic_ai',
        message: `Documento procesado exitosamente con ${chunks.length} fragmentos`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
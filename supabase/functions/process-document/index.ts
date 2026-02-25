import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// Chunking inteligente: divide por párrafos/oraciones, no por caracteres fijos
// ==========================================
function chunkText(text: string, maxChunkSize: number = 800, overlap: number = 150): string[] {
  const chunks: string[] = [];

  // Dividir primero por doble salto de línea (párrafos)
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Si el párrafo solo cabe en un chunk nuevo
    if (trimmedPara.length > maxChunkSize) {
      // Guardar lo que tenemos
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        // Overlap: tomar las últimas palabras del chunk anterior
        const words = currentChunk.trim().split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + '\n\n';
      }
      // Dividir párrafo largo por oraciones
      const sentences = trimmedPara.match(/[^.!?]+[.!?]+\s*/g) || [trimmedPara];
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          const words = currentChunk.trim().split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlap / 5));
          currentChunk = overlapWords.join(' ') + ' ';
        }
        currentChunk += sentence;
      }
    } else if ((currentChunk + '\n\n' + trimmedPara).length > maxChunkSize) {
      // El párrafo no cabe en el chunk actual
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        const words = currentChunk.trim().split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + '\n\n' + trimmedPara;
      } else {
        currentChunk = trimmedPara;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
  }

  // Último chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Filtrar chunks muy cortos (menos de 20 chars) a menos que sea el único
  if (chunks.length > 1) {
    return chunks.filter(c => c.length >= 20);
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

// ==========================================
// Generar embeddings reales con gemini-embedding-001
// Usa batchEmbedContents para eficiencia máxima
// ==========================================
async function generateEmbeddings(
  texts: string[],
  apiKey: string,
  taskType: string = "RETRIEVAL_DOCUMENT",
  title?: string
): Promise<number[][]> {
  // La API soporta hasta 100 textos por batch, dividir si hay más
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const requests = batch.map(text => ({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      outputDimensionality: 768,
      taskType,
      ...(title && taskType === "RETRIEVAL_DOCUMENT" ? { title } : {})
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embedding API error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, response.status, errorText);
      throw new Error(`Embedding API failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error("No embeddings returned from API");
    }

    for (const emb of data.embeddings) {
      allEmbeddings.push(emb.values);
    }

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${batch.length} chunks (${allEmbeddings.length}/${texts.length} total)`);
  }

  return allEmbeddings;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, content, file_name, user_id, file_type = 'text/plain', upload_mode = 'text', content_url } = await req.json();

    console.log('Processing document:', { document_id, file_name, file_type, upload_mode, content_url, contentLength: content?.length });

    if (!content || !user_id) {
      throw new Error("Missing required fields: content and user_id are required");
    }

    // Validar que el contenido no sea un mensaje de error
    if (content.startsWith('[Error') || content.startsWith('Error') || content.length < 20) {
      console.error('Content is an error message or too short:', content.slice(0, 100));
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
    let isNewDocument = false;

    if (!finalDocumentId) {
      finalDocumentId = crypto.randomUUID();
      isNewDocument = true;
      console.log('Prepared new document ID:', finalDocumentId);
    }

    // Chunking inteligente
    const chunks = chunkText(content, 800, 150);
    console.log(`Split content into ${chunks.length} chunks (avg ${Math.round(content.length / chunks.length)} chars/chunk)`);

    // Truncar cada chunk a 2048 tokens (~8000 chars) que es el límite de gemini-embedding-001
    const truncatedChunks = chunks.map(chunk => chunk.slice(0, 8000));

    // Generar embeddings reales con gemini-embedding-001
    console.log('Generating real embeddings with gemini-embedding-001...');
    const embeddings = await generateEmbeddings(
      truncatedChunks,
      geminiApiKey,
      "RETRIEVAL_DOCUMENT",
      file_name || "document"
    );

    console.log(`Generated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dimensions each)`);

    // Preparar registros para inserción
    const embeddingRecords = chunks.map((chunk, idx) => ({
      document_id: finalDocumentId,
      content: content.slice(0, 5000), // Resumen general del documento
      content_chunk: chunk,
      chunk_index: idx,
      embedding: `[${embeddings[idx].join(',')}]`,
      metadata: {
        file_name,
        chunk_index: idx,
        total_chunks: chunks.length,
        user_id,
        embedding_model: 'gemini-embedding-001',
        embedding_dimensions: embeddings[idx].length,
        task_type: 'RETRIEVAL_DOCUMENT'
      }
    }));

    // Insertar documento primero
    if (isNewDocument) {
      const { error: docError } = await supabase
        .from('uploaded_documents')
        .insert({
          id: finalDocumentId,
          uploaded_by: user_id,
          file_name: file_name || `documento_${Date.now()}.txt`,
          file_type: file_type,
          upload_mode: upload_mode,
          extracted_content_url: content_url || null
        });

      if (docError) {
        console.error('Error creating document:', docError);
        throw new Error(`Failed to create document: ${docError.message}`);
      }
      console.log('Successfully inserted document record:', finalDocumentId);
    }

    // Insertar embeddings en batches de 50 para evitar límites de payload
    const INSERT_BATCH_SIZE = 50;
    for (let i = 0; i < embeddingRecords.length; i += INSERT_BATCH_SIZE) {
      const batch = embeddingRecords.slice(i, i + INSERT_BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('document_embeddings')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting embeddings batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}:`, insertError);
        throw new Error(`Failed to insert embeddings: ${insertError.message}`);
      }
      console.log(`Inserted embedding batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}/${Math.ceil(embeddingRecords.length / INSERT_BATCH_SIZE)}`);
    }

    console.log(`✅ Successfully processed document with ${embeddingRecords.length} chunks using gemini-embedding-001`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: finalDocumentId,
        chunks_processed: chunks.length,
        embedding_model: 'gemini-embedding-001',
        embedding_dimensions: embeddings[0]?.length || 0,
        message: `Documento procesado exitosamente con ${chunks.length} fragmentos y embeddings reales`
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
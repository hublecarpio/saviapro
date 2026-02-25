import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// Generar embedding de query con gemini-embedding-001
// Usa taskType RETRIEVAL_QUERY para optimizar la búsqueda
// ==========================================
async function generateQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: query }] },
        outputDimensionality: 768,
        taskType: "RETRIEVAL_QUERY"
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding API error:", response.status, errorText);
    throw new Error(`Embedding API failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.embedding?.values || data.embedding.values.length === 0) {
    throw new Error("No embedding returned from API");
  }

  return data.embedding.values;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, match_count = 5, match_threshold = 0.3 } = await req.json();

    console.log('Querying knowledge base:', { query, match_count, match_threshold });

    if (!query) {
      throw new Error("Query is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar embedding real para la query
    console.log('Generating query embedding with gemini-embedding-001 (RETRIEVAL_QUERY)...');
    const queryEmbedding = await generateQueryEmbedding(query, geminiApiKey);
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    console.log(`Query embedding generated: ${queryEmbedding.length} dimensions`);

    // Búsqueda por similitud vectorial usando RPC
    const { data: results, error: searchError } = await supabase
      .rpc('search_documents', {
        query_embedding: embeddingString,
        match_threshold: match_threshold,
        match_count: match_count
      });

    if (searchError) {
      console.error('Vector search error:', searchError);

      // Fallback: búsqueda por texto completo
      console.log('Falling back to full text search...');
      const searchTerms = query.split(/\s+/).filter((w: string) => w.length > 2).join(' | ');

      const { data: textResults, error: textError } = await supabase
        .from('document_embeddings')
        .select('id, document_id, content, content_chunk, metadata')
        .textSearch('content_chunk', searchTerms)
        .limit(match_count);

      if (textError) {
        throw new Error(`Both vector and text search failed. Vector: ${searchError.message}. Text: ${textError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          results: textResults || [],
          context: textResults?.map((r: any) => r.content_chunk).join('\n\n---\n\n') || '',
          search_type: 'text_fallback',
          embedding_model: 'gemini-embedding-001'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Formatear resultados con similitud
    const context = results?.map((r: any) => r.content_chunk).join('\n\n---\n\n') || '';

    console.log(`Found ${results?.length || 0} relevant documents via semantic search`);
    if (results?.length > 0) {
      console.log('Top similarity scores:', results.slice(0, 3).map((r: any) => r.similarity?.toFixed(4)));
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        context: context,
        search_type: 'semantic',
        embedding_model: 'gemini-embedding-001'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error querying knowledge:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

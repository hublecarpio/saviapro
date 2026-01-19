import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para generar embedding de la query
function generateQueryEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const textBytes = new TextEncoder().encode(text);
  
  for (let i = 0; i < textBytes.length && i < 768; i++) {
    embedding[i % 768] += textBytes[i] / 255;
  }
  
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
    const { query, match_count = 5, match_threshold = 0.3 } = await req.json();
    
    console.log('Querying knowledge base:', { query, match_count, match_threshold });

    if (!query) {
      throw new Error("Query is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar embedding para la query
    const queryEmbedding = generateQueryEmbedding(query);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Buscar documentos similares usando la función RPC
    const { data: results, error: searchError } = await supabase
      .rpc('search_documents', {
        query_embedding: embeddingString,
        match_threshold: match_threshold,
        match_count: match_count
      });

    if (searchError) {
      console.error('Search error:', searchError);
      // Fallback: búsqueda por texto si RPC falla
      const { data: textResults, error: textError } = await supabase
        .from('document_embeddings')
        .select('id, document_id, content, content_chunk, metadata')
        .textSearch('content_chunk', query.split(' ').join(' | '))
        .limit(match_count);

      if (textError) {
        throw new Error(`Search failed: ${searchError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          results: textResults || [],
          context: textResults?.map(r => r.content_chunk).join('\n\n---\n\n') || '',
          search_type: 'text'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Formatear resultados para uso en el chat
    const context = results?.map((r: any) => r.content_chunk).join('\n\n---\n\n') || '';

    console.log(`Found ${results?.length || 0} relevant documents`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        context: context,
        search_type: 'semantic'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error querying knowledge:', error);
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
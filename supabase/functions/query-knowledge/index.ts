import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Generar embedding semántico para la query usando Lovable AI
async function generateQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
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
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Eres un extractor de características semánticas. Dado un texto, extrae EXACTAMENTE 768 características numéricas normalizadas entre -1 y 1 que representen el significado semántico del texto.

Responde SOLO con un array JSON de 768 números decimales, sin explicaciones ni texto adicional. El array debe capturar:
- Temas principales (posiciones 0-100)
- Entidades mencionadas (posiciones 101-200)
- Sentimiento y tono (posiciones 201-300)
- Conceptos abstractos (posiciones 301-400)
- Relaciones y acciones (posiciones 401-500)
- Contexto y dominio (posiciones 501-600)
- Palabras clave ponderadas (posiciones 601-700)
- Características generales (posiciones 701-767)

Responde ÚNICAMENTE con el array JSON, ejemplo: [0.1, -0.3, 0.8, ...]`
            },
            {
              role: "user",
              content: `Genera el vector de embedding para esta consulta de búsqueda:\n\n${query}`
            }
          ],
          temperature: 0.1,
        }),
      },
      12000
    );

    if (!response.ok) {
      console.error("Error from AI gateway:", response.status);
      return generateFallbackEmbedding(query);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
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
          if (magnitude > 0) {
            return embedding.map((v: number) => v / magnitude);
          }
          return embedding;
        }
      }
    } catch (parseError) {
      console.error("Error parsing embedding:", parseError);
    }
    
    // Fallback a keyword embedding
    return await generateKeywordEmbedding(query, apiKey);
    
  } catch (error) {
    console.error("Error generating query embedding:", error);
    return generateFallbackEmbedding(query);
  }
}

// Generar embedding basado en keywords
async function generateKeywordEmbedding(text: string, apiKey: string): Promise<number[]> {
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
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "Extrae las palabras o frases clave más importantes del texto. Responde SOLO con un array JSON de strings."
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.1,
        }),
      },
      12000
    );

    if (!response.ok) {
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleanContent.match(/\[[\s\S]*\]/);
    const keywords = match ? JSON.parse(match[0]) : [];
    
    return generateHashEmbedding(text, keywords);
    
  } catch (error) {
    return generateFallbackEmbedding(text);
  }
}

// Hash embedding mejorado con keywords
function generateHashEmbedding(text: string, keywords: string[]): number[] {
  const embedding = new Array(768).fill(0);
  const combinedText = text + " " + keywords.join(" ");
  const textBytes = new TextEncoder().encode(combinedText.toLowerCase());
  
  for (let i = 0; i < textBytes.length; i++) {
    const byte = textBytes[i];
    const pos1 = (byte * 7 + i) % 768;
    const pos2 = (byte * 13 + i * 3) % 768;
    const pos3 = (byte * 19 + i * 5) % 768;
    
    embedding[pos1] += (byte / 255) * Math.cos(i * 0.1);
    embedding[pos2] += (byte / 255) * Math.sin(i * 0.1);
    embedding[pos3] += (byte / 255) * 0.5;
  }
  
  for (let k = 0; k < keywords.length; k++) {
    const keywordBytes = new TextEncoder().encode(keywords[k].toLowerCase());
    const weight = 1 - (k / keywords.length) * 0.5;
    
    for (let i = 0; i < keywordBytes.length; i++) {
      const byte = keywordBytes[i];
      const pos = (byte * 23 + k * 7 + i) % 768;
      embedding[pos] += (byte / 255) * weight * 2;
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 768; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

// Fallback embedding simple
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, match_count = 5, match_threshold = 0.3 } = await req.json();
    
    console.log('Querying knowledge base with AI embeddings:', { query, match_count, match_threshold });

    if (!query) {
      throw new Error("Query is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar embedding semántico para la query usando AI
    const queryEmbedding = await generateQueryEmbedding(query, lovableApiKey);
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
      // Fallback: búsqueda por texto
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
          search_type: 'text_fallback'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Formatear resultados
    const context = results?.map((r: any) => r.content_chunk).join('\n\n---\n\n') || '';

    console.log(`Found ${results?.length || 0} relevant documents using AI embeddings`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        context: context,
        search_type: 'semantic_ai'
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

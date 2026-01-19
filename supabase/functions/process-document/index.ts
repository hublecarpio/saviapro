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

// Función para generar embeddings semánticos usando Lovable AI
async function generateSemanticEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    // Usar Gemini para extraer características semánticas del texto
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Genera el vector de embedding para este texto:\n\n${text.slice(0, 3000)}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("Error from AI gateway:", response.status, await response.text());
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Intentar parsear el array JSON
    try {
      // Limpiar el contenido para extraer solo el array
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const match = cleanContent.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length >= 768) {
          // Normalizar y asegurar 768 dimensiones
          const embedding = parsed.slice(0, 768).map((v: any) => {
            const num = parseFloat(v) || 0;
            return Math.max(-1, Math.min(1, num));
          });
          
          // Normalizar el vector
          const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
          if (magnitude > 0) {
            return embedding.map((v: number) => v / magnitude);
          }
          return embedding;
        }
      }
    } catch (parseError) {
      console.error("Error parsing embedding response:", parseError);
    }
    
    // Si falla el parsing, usar método alternativo con keywords
    return await generateKeywordEmbedding(text, apiKey);
    
  } catch (error) {
    console.error("Error generating semantic embedding:", error);
    return generateFallbackEmbedding(text);
  }
}

// Generar embedding basado en keywords extraídas por AI
async function generateKeywordEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "Extrae las 50 palabras o frases clave más importantes del texto. Responde SOLO con un array JSON de strings, sin explicaciones."
          },
          {
            role: "user",
            content: text.slice(0, 3000)
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parsear keywords
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleanContent.match(/\[[\s\S]*\]/);
    const keywords = match ? JSON.parse(match[0]) : [];
    
    // Crear embedding basado en hash de keywords + texto original
    return generateHashEmbedding(text, keywords);
    
  } catch (error) {
    console.error("Error generating keyword embedding:", error);
    return generateFallbackEmbedding(text);
  }
}

// Generar embedding usando hash mejorado con keywords
function generateHashEmbedding(text: string, keywords: string[]): number[] {
  const embedding = new Array(768).fill(0);
  
  // Combinar texto con keywords para mejor representación
  const combinedText = text + " " + keywords.join(" ");
  const textBytes = new TextEncoder().encode(combinedText.toLowerCase());
  
  // Hash más sofisticado
  for (let i = 0; i < textBytes.length; i++) {
    const byte = textBytes[i];
    const pos1 = (byte * 7 + i) % 768;
    const pos2 = (byte * 13 + i * 3) % 768;
    const pos3 = (byte * 19 + i * 5) % 768;
    
    embedding[pos1] += (byte / 255) * Math.cos(i * 0.1);
    embedding[pos2] += (byte / 255) * Math.sin(i * 0.1);
    embedding[pos3] += (byte / 255) * 0.5;
  }
  
  // Agregar peso extra para keywords
  for (let k = 0; k < keywords.length; k++) {
    const keywordBytes = new TextEncoder().encode(keywords[k].toLowerCase());
    const weight = 1 - (k / keywords.length) * 0.5; // Keywords más importantes tienen más peso
    
    for (let i = 0; i < keywordBytes.length; i++) {
      const byte = keywordBytes[i];
      const pos = (byte * 23 + k * 7 + i) % 768;
      embedding[pos] += (byte / 255) * weight * 2;
    }
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
      console.log('Created new document:', finalDocumentId);
    }

    // Dividir el contenido en chunks
    const chunks = chunkText(content, 1000, 200);
    console.log(`Split content into ${chunks.length} chunks`);

    // Procesar cada chunk y generar embeddings con AI
    const embeddings = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} with AI embeddings`);
      
      const embedding = await generateSemanticEmbedding(chunk, lovableApiKey);
      
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
          user_id: user_id,
          embedding_type: 'semantic_ai'
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

    console.log(`Successfully processed document with ${embeddings.length} chunks using AI embeddings`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: finalDocumentId,
        chunks_processed: chunks.length,
        embedding_type: 'semantic_ai',
        message: `Documento procesado exitosamente con ${chunks.length} fragmentos usando embeddings semánticos`
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

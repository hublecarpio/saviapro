import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Ficha {
  pregunta: string;
  respuesta: string;
  orden: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id, contenido_chat } = await req.json();

    if (!conversation_id || !contenido_chat) {
      return new Response(
        JSON.stringify({ error: "conversation_id y contenido_chat son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Error verificando usuario:", userError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generando fichas para conversation:", conversation_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    // PASO 1: Generar resumen del tema principal de la conversación
    console.log("Paso 1: Generando resumen del tema...");
    
    const resumenResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un experto en síntesis educativa. Tu tarea es identificar el tema principal de una conversación y crear un resumen estructurado de los conceptos clave que se discutieron.",
          },
          {
            role: "user",
            content: `Analiza la siguiente conversación educativa y genera un resumen estructurado.

Identifica:
1. El TEMA PRINCIPAL de la conversación
2. Los CONCEPTOS CLAVE que se explicaron
3. Las IDEAS IMPORTANTES que el estudiante debería recordar

Conversación:
${contenido_chat}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generar_resumen",
              description: "Genera un resumen estructurado del tema de la conversación",
              parameters: {
                type: "object",
                properties: {
                  tema_principal: { 
                    type: "string",
                    description: "El tema principal de la conversación en una frase clara"
                  },
                  conceptos_clave: { 
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de conceptos clave discutidos"
                  },
                  resumen: { 
                    type: "string",
                    description: "Resumen de 3-5 oraciones con la información más importante"
                  },
                },
                required: ["tema_principal", "conceptos_clave", "resumen"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generar_resumen" } },
      }),
    });

    if (!resumenResponse.ok) {
      const errorText = await resumenResponse.text();
      console.error("Error generando resumen:", resumenResponse.status, errorText);
      
      if (resumenResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (resumenResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere pago. Por favor agrega créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Error generando resumen: ${resumenResponse.status}`);
    }

    const resumenData = await resumenResponse.json();
    const resumenToolCall = resumenData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!resumenToolCall || !resumenToolCall.function?.arguments) {
      throw new Error("No se pudo extraer el resumen de la respuesta");
    }

    const resumenParsed = JSON.parse(resumenToolCall.function.arguments);
    console.log("Resumen generado:", {
      tema: resumenParsed.tema_principal,
      conceptos: resumenParsed.conceptos_clave?.length
    });

    // PASO 2: Generar fichas basadas en el resumen
    console.log("Paso 2: Generando fichas basadas en el resumen...");

    const fichasPrompt = `Basándote en el siguiente resumen de una conversación educativa, genera exactamente 7 fichas didácticas.

TEMA PRINCIPAL: ${resumenParsed.tema_principal}

CONCEPTOS CLAVE:
${resumenParsed.conceptos_clave?.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

RESUMEN:
${resumenParsed.resumen}

Cada ficha debe:
- Tener una PREGUNTA breve, clara y concreta sobre uno de los conceptos clave
- Tener una RESPUESTA en no más de 2-3 líneas que explique el concepto
- Estar enfocada en ayudar al estudiante a recordar y comprender el tema

Las fichas deben cubrir los conceptos más importantes del tema "${resumenParsed.tema_principal}".`;

    const fichasResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un asistente educativo experto en crear fichas didácticas de estudio. Creas preguntas claras y respuestas concisas que ayudan a los estudiantes a recordar conceptos importantes.",
          },
          {
            role: "user",
            content: fichasPrompt,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generar_fichas",
              description: "Genera 7 fichas didácticas con preguntas y respuestas",
              parameters: {
                type: "object",
                properties: {
                  fichas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pregunta: { type: "string" },
                        respuesta: { type: "string" },
                        orden: { type: "number" },
                      },
                      required: ["pregunta", "respuesta", "orden"],
                      additionalProperties: false,
                    },
                    minItems: 7,
                    maxItems: 7,
                  },
                },
                required: ["fichas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generar_fichas" } },
      }),
    });

    if (!fichasResponse.ok) {
      const errorText = await fichasResponse.text();
      console.error("Error generando fichas:", fichasResponse.status, errorText);
      
      if (fichasResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (fichasResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere pago. Por favor agrega créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Error generando fichas: ${fichasResponse.status}`);
    }

    const fichasData = await fichasResponse.json();
    const fichasToolCall = fichasData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!fichasToolCall || !fichasToolCall.function?.arguments) {
      throw new Error("No se pudo extraer las fichas de la respuesta");
    }

    const fichasParsed = JSON.parse(fichasToolCall.function.arguments);
    const fichasGeneradas: Ficha[] = fichasParsed.fichas;

    if (!fichasGeneradas || fichasGeneradas.length !== 7) {
      throw new Error("El modelo no generó exactamente 7 fichas");
    }

    console.log("Fichas generadas:", fichasGeneradas.length);

    // Eliminar fichas antiguas de esta conversación
    const { error: deleteError } = await supabase
      .from("fichas_didacticas")
      .delete()
      .eq("user_id", user.id)
      .eq("conversation_id", conversation_id);

    if (deleteError) {
      console.error("Error eliminando fichas antiguas:", deleteError);
    }

    // Insertar las nuevas fichas en la base de datos
    const fichasParaInsertar = fichasGeneradas.map((ficha) => ({
      user_id: user.id,
      conversation_id: conversation_id,
      pregunta: ficha.pregunta,
      respuesta: ficha.respuesta,
      orden: ficha.orden,
    }));

    const { data: insertedFichas, error: insertError } = await supabase
      .from("fichas_didacticas")
      .insert(fichasParaInsertar)
      .select();

    if (insertError) {
      console.error("Error insertando fichas:", insertError);
      throw insertError;
    }

    console.log("Fichas insertadas exitosamente:", insertedFichas?.length);

    return new Response(
      JSON.stringify({
        success: true,
        tema: resumenParsed.tema_principal,
        fichas: fichasGeneradas,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en generar-fichas:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido al generar fichas" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

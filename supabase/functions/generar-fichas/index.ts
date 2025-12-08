import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FichaQuiz {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
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

    console.log("Generando quiz para conversation:", conversation_id);

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

    // PASO 2: Generar preguntas de quiz con 4 opciones cada una
    console.log("Paso 2: Generando preguntas de quiz...");

    const quizPrompt = `Basándote en el siguiente resumen de una conversación educativa, genera exactamente 7 preguntas de quiz tipo test.

TEMA PRINCIPAL: ${resumenParsed.tema_principal}

CONCEPTOS CLAVE:
${resumenParsed.conceptos_clave?.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

RESUMEN:
${resumenParsed.resumen}

INSTRUCCIONES IMPORTANTES:
1. Cada pregunta debe tener exactamente 4 opciones de respuesta
2. Solo UNA opción debe ser correcta
3. Las opciones incorrectas deben ser plausibles pero claramente distinguibles
4. Las preguntas deben cubrir los conceptos más importantes del tema
5. Las preguntas deben ser claras y no ambiguas
6. Varía el índice de la respuesta correcta (no siempre la misma posición)`;

    const quizResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "Eres un experto en crear evaluaciones educativas tipo quiz. Creas preguntas claras con opciones múltiples donde solo una es correcta. Las opciones incorrectas deben ser plausibles pero distinguibles.",
          },
          {
            role: "user",
            content: quizPrompt,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generar_quiz",
              description: "Genera 7 preguntas de quiz con 4 opciones cada una",
              parameters: {
                type: "object",
                properties: {
                  preguntas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pregunta: { 
                          type: "string",
                          description: "La pregunta del quiz"
                        },
                        opciones: { 
                          type: "array",
                          items: { type: "string" },
                          minItems: 4,
                          maxItems: 4,
                          description: "Exactamente 4 opciones de respuesta"
                        },
                        respuesta_correcta: { 
                          type: "number",
                          description: "Índice de la respuesta correcta (0, 1, 2 o 3)"
                        },
                        orden: { 
                          type: "number",
                          description: "Número de orden de la pregunta (1-7)"
                        },
                      },
                      required: ["pregunta", "opciones", "respuesta_correcta", "orden"],
                      additionalProperties: false,
                    },
                    minItems: 7,
                    maxItems: 7,
                  },
                },
                required: ["preguntas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generar_quiz" } },
      }),
    });

    if (!quizResponse.ok) {
      const errorText = await quizResponse.text();
      console.error("Error generando quiz:", quizResponse.status, errorText);
      
      if (quizResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (quizResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere pago. Por favor agrega créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Error generando quiz: ${quizResponse.status}`);
    }

    const quizData = await quizResponse.json();
    const quizToolCall = quizData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!quizToolCall || !quizToolCall.function?.arguments) {
      throw new Error("No se pudo extraer el quiz de la respuesta");
    }

    const quizParsed = JSON.parse(quizToolCall.function.arguments);
    const preguntasGeneradas: FichaQuiz[] = quizParsed.preguntas;

    if (!preguntasGeneradas || preguntasGeneradas.length !== 7) {
      throw new Error("El modelo no generó exactamente 7 preguntas");
    }

    console.log("Quiz generado:", preguntasGeneradas.length, "preguntas");

    // Eliminar fichas antiguas de esta conversación
    const { error: deleteError } = await supabase
      .from("fichas_didacticas")
      .delete()
      .eq("user_id", user.id)
      .eq("conversation_id", conversation_id);

    if (deleteError) {
      console.error("Error eliminando fichas antiguas:", deleteError);
    }

    // Insertar las nuevas preguntas en la base de datos
    const preguntasParaInsertar = preguntasGeneradas.map((pregunta) => ({
      user_id: user.id,
      conversation_id: conversation_id,
      pregunta: pregunta.pregunta,
      respuesta: pregunta.opciones[pregunta.respuesta_correcta], // Guardar la respuesta correcta como texto también
      opciones: pregunta.opciones,
      respuesta_correcta: pregunta.respuesta_correcta,
      orden: pregunta.orden,
    }));

    const { data: insertedPreguntas, error: insertError } = await supabase
      .from("fichas_didacticas")
      .insert(preguntasParaInsertar)
      .select();

    if (insertError) {
      console.error("Error insertando preguntas:", insertError);
      throw insertError;
    }

    console.log("Preguntas insertadas exitosamente:", insertedPreguntas?.length);

    return new Response(
      JSON.stringify({
        success: true,
        tema: resumenParsed.tema_principal,
        preguntas: preguntasGeneradas,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en generar-fichas:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido al generar quiz" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

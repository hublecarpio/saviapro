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

    // Obtener el token de autorización
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar usuario autenticado
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

    // Llamar a Lovable AI para generar las fichas
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    const prompt = `Genera exactamente 7 fichas didácticas basadas en el siguiente contenido de chat.
Cada ficha debe tener:
- Una PREGUNTA breve, clara y concreta sobre conceptos clave del tema.
- Una RESPUESTA en no más de 2-3 líneas que explique el concepto.

Las fichas deben estar numeradas del 1 al 7.

Formato JSON requerido:
{
  "fichas": [
    { "pregunta": "...", "respuesta": "...", "orden": 1 },
    { "pregunta": "...", "respuesta": "...", "orden": 2 },
    { "pregunta": "...", "respuesta": "...", "orden": 3 },
    { "pregunta": "...", "respuesta": "...", "orden": 4 },
    { "pregunta": "...", "respuesta": "...", "orden": 5 },
    { "pregunta": "...", "respuesta": "...", "orden": 6 },
    { "pregunta": "...", "respuesta": "...", "orden": 7 }
  ]
}

Contenido del chat:
${contenido_chat}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "Eres un asistente educativo que crea fichas didácticas. Siempre respondes en formato JSON válido.",
          },
          {
            role: "user",
            content: prompt,
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere pago. Por favor agrega créditos a tu cuenta de Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Error en Lovable AI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("Respuesta de AI:", JSON.stringify(aiData));

    // Extraer las fichas del tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No se pudo extraer las fichas de la respuesta de AI");
    }

    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const fichasGeneradas: Ficha[] = parsedArgs.fichas;

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

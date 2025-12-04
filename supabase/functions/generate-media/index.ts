import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, conversation_id, user_id, conversation_summary, message_count } = await req.json();

    console.log(`📹 Starting ${type} generation for conversation: ${conversation_id}`);

    if (!type || !conversation_id || !user_id || !conversation_summary) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Función para hacer polling
    const pollForMediaUrl = async (pollUrl: string, maxAttempts = 40, interval = 3000): Promise<string | null> => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          console.log(`🔄 Polling attempt ${attempt + 1}/${maxAttempts}`);
          const response = await fetch(pollUrl);
          if (!response.ok) continue;

          const data = await response.json();
          const mediaUrl = data?.response || data?.url || data?.data?.url || data?.data?.response;

          if (mediaUrl) {
            console.log(`✅ Media URL found: ${mediaUrl}`);
            return mediaUrl;
          }

          await new Promise((resolve) => setTimeout(resolve, interval));
        } catch (error) {
          console.error(`Error polling:`, error);
        }
      }
      return null;
    };

    // Función de background para llamar al webhook
    const processMediaInBackground = async () => {
      try {
        console.log(`🔄 Calling webhook for ${type}...`);
        
        const webhookResponse = await fetch(
          "https://webhook.hubleconsulting.com/webhook/1fba6f6e-3c2f-4c50-bfbe-488df7c7eebc",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              data: {
                conversation_id,
                resumen: conversation_summary,
                total_mensajes: message_count,
                timestamp: new Date().toISOString(),
              },
            }),
          }
        );

        if (!webhookResponse.ok) {
          throw new Error(`Webhook error: ${webhookResponse.status}`);
        }

        const webhookData = await webhookResponse.json();
        console.log(`📦 Webhook response:`, webhookData);

        // Buscar la URL del media en diferentes estructuras
        let mediaUrl = 
          webhookData?.response || 
          webhookData?.url || 
          webhookData?.data?.url || 
          webhookData?.data?.response;

        // Si hay poll_url, hacer polling
        const pollUrl = webhookData?.poll_url || webhookData?.data?.poll_url;
        if (!mediaUrl && pollUrl) {
          console.log(`🔄 Polling for media URL at: ${pollUrl}`);
          mediaUrl = await pollForMediaUrl(pollUrl);
        }

        if (mediaUrl) {
          // Insertar mensaje con el resultado
          const resultMessage =
            type === "video"
              ? `✅ Video resumen generado:\n\n${mediaUrl}`
              : `✅ Podcast resumen generado:\n\n${mediaUrl}`;

          await supabase.from("messages").insert({
            conversation_id,
            user_id,
            role: "assistant",
            message: resultMessage,
          });

          console.log(`✅ ${type} generated successfully: ${mediaUrl}`);
        } else {
          // Insertar mensaje de error
          await supabase.from("messages").insert({
            conversation_id,
            user_id,
            role: "assistant",
            message: `⚠️ La generación del ${type === "video" ? "video" : "podcast"} está tomando más tiempo del esperado. Por favor intenta de nuevo más tarde.`,
          });

          console.error(`❌ No media URL found for ${type}`);
        }
      } catch (err) {
        console.error(`❌ Error in background task:`, err);
        
        // Insertar mensaje de error
        await supabase.from("messages").insert({
          conversation_id,
          user_id,
          role: "assistant",
          message: `❌ Error generando el ${type === "video" ? "video" : "podcast"}. Por favor intenta de nuevo.`,
        });
      }
    };

    // Ejecutar en background (no bloquea la respuesta)
    EdgeRuntime.waitUntil(processMediaInBackground());

    // Responder inmediatamente
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${type} generation started`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("❌ Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Cliente con service role para operaciones admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verificar autenticación del tutor
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      throw new Error("No autorizado - falta header de autenticación");
    }

    // Extraer el token del header
    const token = authHeader.replace("Bearer ", "");
    
    // Crear cliente de Supabase con anon key
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Validar el token y obtener el usuario
    const { data: { user: tutor }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !tutor) {
      console.error("Auth error:", authError);
      throw new Error("No autorizado - sesión inválida");
    }

    // Verificar que el usuario sea tutor
    const { data: tutorRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", tutor.id)
      .eq("role", "tutor")
      .maybeSingle();

    if (!tutorRole) {
      throw new Error("Usuario no es tutor");
    }

    // Obtener datos del request
    const { email } = await req.json();

    if (!email) {
      throw new Error("Email es obligatorio");
    }

    // Verificar cantidad de estudiantes
    const { data: existingStudents, error: countError } = await supabaseAdmin
      .from("tutor_students")
      .select("id", { count: "exact" })
      .eq("tutor_id", tutor.id);

    if (countError) throw countError;

    if (existingStudents && existingStudents.length >= 2) {
      throw new Error("Solo puedes crear máximo 2 estudiantes");
    }

    // Verificar si ya existe el email
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      throw new Error("Ya existe un usuario con ese email");
    }

    // Agregar a invited_users y obtener el token
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from("invited_users")
      .insert({
        email: email.toLowerCase(),
        created_by: tutor.id,
      })
      .select("token")
      .single();

    if (inviteError) throw inviteError;

    // Construir URL de registro con el token
    const registerUrl = `https://app.biexedu.com/register/${inviteData.token}`;

    // Enviar email al webhook para que se envíe la invitación
    const webhookUrl = "https://webhook.hubleconsulting.com/webhook/apicorreo88a1a578-5653-457a-b408-ae3cbb06cff6";
    
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          register_url: registerUrl,
        }),
      });

      if (!webhookResponse.ok) {
        console.error("Error al enviar al webhook:", await webhookResponse.text());
      } else {
        console.log("Webhook enviado exitosamente para:", email.toLowerCase());
      }
    } catch (webhookError) {
      console.error("Error al llamar webhook:", webhookError);
      // No lanzamos error aquí para que la invitación se cree de todas formas
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitación enviada correctamente",
        email: email.toLowerCase(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating student:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

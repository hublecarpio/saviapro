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
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      throw new Error("No autorizado - falta header de autenticación");
    }

    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: tutor }, error: authError } = await supabaseClient.auth.getUser();
    console.log("User authenticated:", !!tutor, "Auth error:", authError?.message);
    
    if (authError || !tutor) {
      throw new Error("No autorizado - usuario no válido: " + (authError?.message || "sin usuario"));
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
    const { email, password, name } = await req.json();

    if (!email || !password) {
      throw new Error("Email y contraseña son obligatorios");
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

    // Agregar a invited_users
    const { error: inviteError } = await supabaseAdmin
      .from("invited_users")
      .insert({
        email: email.toLowerCase(),
        created_by: tutor.id,
      });

    if (inviteError) throw inviteError;

    // Crear usuario usando admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        name: name || email.split("@")[0],
      },
    });

    if (createError || !newUser.user) {
      throw new Error("Error al crear usuario: " + (createError?.message || "Usuario no creado"));
    }

    // Asignar rol de estudiante
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "student",
      });

    if (roleError) throw roleError;

    // Relacionar tutor con estudiante
    const { error: relationError } = await supabaseAdmin
      .from("tutor_students")
      .insert({
        tutor_id: tutor.id,
        student_id: newUser.user.id,
      });

    if (relationError) throw relationError;

    // Marcar invitación como usada
    await supabaseAdmin.rpc("mark_invited_user_used", {
      user_email: email.toLowerCase(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        student: {
          id: newUser.user.id,
          email: newUser.user.email,
          name: newUser.user.user_metadata?.name,
        },
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

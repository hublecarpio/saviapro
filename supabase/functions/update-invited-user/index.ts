import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, name, token } = await req.json();

    if (!email || !password || !name || !token) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar que el token de invitación sea válido
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invited_users")
      .select("email, intended_role, created_by, used")
      .eq("token", token)
      .eq("used", false)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Token de invitación inválido o expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "El email no coincide con la invitación" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar si el usuario ya existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      // Usuario existe - actualizar contraseña y metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          user_metadata: { name }
        }
      );

      if (updateError) {
        console.error("Error updating user:", updateError);
        return new Response(
          JSON.stringify({ error: "Error al actualizar usuario" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = existingUser.id;

      // Actualizar nombre en profiles
      await supabaseAdmin
        .from("profiles")
        .update({ name })
        .eq("id", userId);

    } else {
      // Usuario no existe - crear nuevo
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Error al crear usuario" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // Asignar el rol de la invitación (eliminar roles anteriores si existe)
    if (invite.intended_role) {
      // Verificar si ya tiene este rol
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", invite.intended_role)
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: invite.intended_role });
      }

      // Si es estudiante y fue invitado por tutor, crear relación
      if (invite.intended_role === "student" && invite.created_by) {
        const { data: existingRelation } = await supabaseAdmin
          .from("tutor_students")
          .select("id")
          .eq("tutor_id", invite.created_by)
          .eq("student_id", userId)
          .maybeSingle();

        if (!existingRelation) {
          await supabaseAdmin
            .from("tutor_students")
            .insert({ tutor_id: invite.created_by, student_id: userId });
        }
      }
    }

    // Marcar invitación como usada
    await supabaseAdmin
      .from("invited_users")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("token", token);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        role: invite.intended_role,
        isExisting: !!existingUser
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

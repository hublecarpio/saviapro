import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente con service_role para operaciones admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Cliente normal para verificar el usuario que hace la petición
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar que el usuario que hace la petición es admin
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Only admins can delete users');
    }

    // Obtener el user_id a eliminar
    const { userId } = await req.json();
    if (!userId) {
      throw new Error('userId is required');
    }

    // No permitir que el admin se elimine a sí mismo
    if (userId === requestingUser.id) {
      throw new Error('Cannot delete your own account');
    }

    // Obtener email del usuario antes de borrar el perfil
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const userEmail = userProfile?.email;

    console.log(`Admin ${requestingUser.email} is deleting user ${userId} (${userEmail || 'unknown email'})`);

    // Eliminar datos relacionados usando service role (bypass RLS)
    console.log('Deleting related data...');
    
    await supabaseAdmin.from("messages").delete().eq("user_id", userId);
    await supabaseAdmin.from("conversations").delete().eq("user_id", userId);
    await supabaseAdmin.from("fichas_didacticas").delete().eq("user_id", userId);
    await supabaseAdmin.from("mind_maps").delete().eq("user_id", userId);
    await supabaseAdmin.from("starter_profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("uploaded_documents").delete().eq("uploaded_by", userId);
    await supabaseAdmin.from("tutor_students").delete().eq("tutor_id", userId);
    await supabaseAdmin.from("tutor_students").delete().eq("student_id", userId);
    await supabaseAdmin.from("invited_users").delete().eq("created_by", userId);
    
    // Eliminar también la invitación que se le hizo a este usuario
    if (userEmail) {
      await supabaseAdmin.from("invited_users").delete().eq("email", userEmail);
    }
    
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    console.log('Deleting user from auth...');
    
    // Eliminar usuario de auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      throw new Error(`Failed to delete user from auth: ${deleteError.message}`);
    }

    console.log(`User ${userId} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

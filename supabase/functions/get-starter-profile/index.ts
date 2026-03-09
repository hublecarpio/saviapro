import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener el starter_profile del usuario
    const { data: starterProfile, error: starterError } = await supabase
      .from('starter_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (starterError) {
      console.error('Error obteniendo starter_profile:', starterError);
      return new Response(
        JSON.stringify({ error: 'No se encontró el perfil del usuario', details: starterError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener info adicional del usuario desde profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log(`Starter profile obtenido para usuario: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          starter_profile: starterProfile,
          user_profile: profile || null
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error en get-starter-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener el prompt maestro desde system_config
    const { data: systemPrompt, error } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'master_prompt')
      .single();

    if (error) {
      console.error('Error obteniendo system_prompt:', error);
      return new Response(
        JSON.stringify({ error: 'No se encontró el prompt del sistema', details: error.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('System prompt obtenido exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          key: systemPrompt.key,
          value: systemPrompt.value,
          updated_at: systemPrompt.updated_at
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error en get-system-prompt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

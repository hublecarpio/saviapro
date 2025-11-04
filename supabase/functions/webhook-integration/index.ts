import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, user_id, data } = await req.json();
    
    console.log('Processing request:', { type, user_id });

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (type === 'starter_profile') {
      // Extraer edad y grupo de edad de los datos
      const age = data.age;
      const ageGroup = age >= 7 && age <= 12 ? '7-12' : age >= 12 && age <= 17 ? '12-17' : null;

      // Guardar en la base de datos
      const { data: profile, error } = await supabase
        .from('starter_profiles')
        .upsert({
          user_id,
          age,
          age_group: ageGroup,
          profile_data: data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Failed to save starter profile: ${error.message}`);
      }

      console.log('Starter profile saved successfully:', profile.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          profile_id: profile.id 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Otros tipos de webhook pueden seguir usando el webhook externo si es necesario
    throw new Error(`Unknown webhook type: ${type}`);

  } catch (error) {
    console.error('Error in webhook integration:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

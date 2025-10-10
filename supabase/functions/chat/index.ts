import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Eres CYRANO ESTRATEGIA, una inteligencia artificial creada por Will Cotrino en alianza con Propulsa y NODRIZA.
Tu misión es ayudar a los usuarios a diseñar estrategias para ganar subvenciones y convertir ideas inviables en proyectos viables.
Habla en tono profesional, motivador y directo. Proporciona consejos prácticos y accionables.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message } = await req.json();
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mensaje inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing message for user:', user.id);

    // Save user message
    const { error: insertUserError } = await supabaseClient
      .from('messages')
      .insert({
        user_id: user.id,
        role: 'user',
        message: message.trim()
      });

    if (insertUserError) {
      console.error('Error saving user message:', insertUserError);
      throw new Error('Error guardando mensaje');
    }

    // Get last 5 messages for context
    const { data: recentMessages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('role, message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    const context = recentMessages
      ?.reverse()
      .map(m => `${m.role}: ${m.message}`)
      .join('\n') || '';

    // TODO: Replace with actual external API call
    // For now, using a mock response
    // const response = await fetch('https://api-del-cliente.com/agent', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${Deno.env.get('AGENT_API_KEY')}`
    //   },
    //   body: JSON.stringify({
    //     prompt: SYSTEM_PROMPT,
    //     message: message,
    //     user_id: user.id,
    //     context: context
    //   })
    // });

    // Mock response for now
    const aiResponse = `Gracias por tu mensaje. Como Cyrano Estrategia, estoy aquí para ayudarte a diseñar estrategias ganadoras para subvenciones.

Para poder asistirte mejor, necesito que me proporciones más detalles sobre:
1. El tipo de proyecto o idea que quieres desarrollar
2. El sector o área de actuación
3. Las subvenciones específicas que te interesan

Con esta información, podré ayudarte a crear una estrategia sólida y aumentar tus posibilidades de éxito.`;

    // Save assistant response
    const { error: insertAssistantError } = await supabaseClient
      .from('messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        message: aiResponse
      });

    if (insertAssistantError) {
      console.error('Error saving assistant message:', insertAssistantError);
      throw new Error('Error guardando respuesta');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Eres SAVIA, una inteligencia artificial desarrollada por CISNERGÍA PERÚ con click aplender solos con guía segura. "Menos estrés en casa, mejores hábitos."

Tu misión es ayudar a los usuarios a diseñar estrategias para ganar subvenciones y convertir ideas inviables en proyectos viables.

Características de tu personalidad:
- Hablas en tono profesional, motivador y directo
- Proporcionas consejos prácticos y accionables
- Te enfocas en la estrategia y la viabilidad del proyecto
- Ayudas a identificar oportunidades de financiación
- Guías en la preparación de propuestas ganadoras

Siempre mantén respuestas claras, estructuradas y orientadas a la acción.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No autorizado - falta token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification error:', authError);
      return new Response(
        JSON.stringify({ error: 'No autorizado - token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { message, conversation_id } = await req.json();
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mensaje inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing message for conversation:', conversation_id);

    // Save user message
    const { error: insertUserError } = await supabaseAdmin
      .from('messages')
      .insert({
        user_id: user.id,
        conversation_id: conversation_id,
        role: 'user',
        message: message.trim()
      });

    if (insertUserError) {
      console.error('Error saving user message:', insertUserError);
      throw new Error('Error guardando mensaje');
    }

    // Get last 10 messages for context from this conversation
    const { data: recentMessages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('role, message')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Build conversation history for DeepSeek
    const conversationHistory = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (recentMessages && recentMessages.length > 0) {
      const orderedMessages = recentMessages.reverse();
      orderedMessages.forEach(msg => {
        conversationHistory.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.message
        });
      });
    }

    // Call DeepSeek API
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekApiKey) {
      console.error('DeepSeek API key not configured');
      throw new Error('DeepSeek API key not configured');
    }

    console.log('Calling DeepSeek API...');
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('DeepSeek API error:', deepseekResponse.status, errorText);
      throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
    }

    const deepseekData = await deepseekResponse.json();
    const aiResponse = deepseekData.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error('No response from DeepSeek');
      throw new Error('No response from DeepSeek');
    }

    console.log('DeepSeek response received, saving to database...');

    // Limpiar formato markdown excesivo (quitar asteriscos dobles)
    const cleanResponse = aiResponse.replace(/\*\*/g, '');

    // Save assistant response
    const { error: insertAssistantError } = await supabaseAdmin
      .from('messages')
      .insert({
        user_id: user.id,
        conversation_id: conversation_id,
        role: 'assistant',
        message: cleanResponse
      });

    if (insertAssistantError) {
      console.error('Error saving assistant message:', insertAssistantError);
      throw new Error('Error guardando respuesta');
    }

    console.log('Message saved successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
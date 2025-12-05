import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildPersonalizedPrompt(starterProfile: any) {
  const data = starterProfile?.profile_data || {};
  const age = starterProfile?.age || 'No especificada';
  const ageGroup = starterProfile?.age_group || '';
  
  const nombre = data.description ? data.description.split(',')[0].replace('Soy ', '') : 'Estudiante';
  const nivelAcademico = ageGroup === '7-12' ? 'Primaria' : ageGroup === '12-17' ? 'Secundaria' : 'General';
  
  let estiloAprendizaje = '';
  if (data.learningStyle) {
    const styles = Array.isArray(data.learningStyle) ? data.learningStyle : [data.learningStyle];
    estiloAprendizaje = styles.join(', ');
  }

  return `Eres Sofía, tutora amigable de BIEX. Ayudas a estudiantes a aprender y desarrollar pensamiento crítico.

ALUMNO: ${nombre}, ${age} años, nivel ${nivelAcademico}${estiloAprendizaje ? `, aprende mejor de forma ${estiloAprendizaje}` : ''}.

REGLAS:
1. SIEMPRE responde algo útil, nunca dejes el mensaje vacío
2. No uses markdown (sin **, ##, ni listas con -)
3. Usa texto natural y emojis ocasionales
4. Adapta tu lenguaje a la edad del estudiante

MÉTODO DE ENSEÑANZA:
- Cuando el alumno mencione un tema, primero pregunta qué sabe sobre él
- Explica de forma clara y adaptada a su nivel
- Usa preguntas para fomentar el pensamiento crítico
- Sé paciente y celebra sus logros

Responde siempre de manera útil y amigable.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { message, conversation_id, user_id, image, skip_user_message, action_type } = await req.json();
    
    // Si es una acción directa (mapa mental o informe), no necesitamos validar el mensaje
    if (!action_type && (!message || typeof message !== 'string' || message.trim().length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Mensaje inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id y user_id requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing request for user:', user_id, 'conversation:', conversation_id, 'action_type:', action_type);

    // Obtener perfil del starter del usuario
    const { data: starterProfile, error: profileError } = await supabaseAdmin
      .from('starter_profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching starter profile:', profileError);
    }

    // Get conversation history (needed for mind map and informe)
    const { data: recentMessages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('role, message')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // === HANDLE DIRECT ACTIONS (mind_map, informe) ===
    if (action_type === 'mind_map') {
      console.log('Mind map action requested, generating directly...');
      
      // Construir la conversación completa para dar contexto al API
      const fullConversation = recentMessages && recentMessages.length > 0 
        ? recentMessages.reverse().map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.message}`).join('\n\n')
        : 'Sin conversación disponible';
      
      // Tema corto para guardar en BD
      const shortTema = recentMessages && recentMessages.length > 0 
        ? recentMessages[0]?.message?.substring(0, 100) || 'Mapa mental'
        : 'Mapa mental';
      
      console.log('📝 Generando mapa mental con conversación completa, longitud:', fullConversation.length);
      
      try {
        const mindMapResponse = await fetch(
          'https://flowhook.iamhuble.space/webhook/f71225ad-7798-4e52-bd89-35a1e79549e9',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tema: fullConversation })
          }
        );

        if (mindMapResponse.ok) {
          const htmlContent = await mindMapResponse.text();
          
          if (htmlContent && htmlContent.length >= 50) {
            console.log('📄 Mapa mental generado, guardando en BD...');
            
            await supabaseAdmin
              .from('mind_maps')
              .insert({
                user_id: user_id,
                conversation_id: conversation_id,
                tema: shortTema,
                html_content: htmlContent
              });
            
            console.log('✅ Mapa mental guardado exitosamente');
          } else {
            console.error('❌ HTML vacío o muy corto');
          }
        } else {
          console.error('Webhook error:', mindMapResponse.status);
        }
      } catch (mindMapError) {
        console.error('Error generating mind map:', mindMapError);
      }

      return new Response(
        JSON.stringify({ success: true, action: 'mind_map' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action_type === 'informe') {
      console.log('Informe action requested, generating directly...');
      
      const conversationSummary = recentMessages && recentMessages.length > 0 
        ? recentMessages.slice(-10).map(m => `${m.role}: ${m.message}`).join('\n')
        : '';
      
      const informeContext = {
        user_profile: {
          name: starterProfile?.profile_data?.description?.split(',')[0]?.replace('Soy ', '') || 'Estudiante',
          age: starterProfile?.age || 'No especificada',
          age_group: starterProfile?.age_group || '',
          learning_style: starterProfile?.profile_data?.learningStyle || '',
          interests: starterProfile?.profile_data?.interests || starterProfile?.profile_data?.passionateTopics || ''
        },
        conversation_summary: conversationSummary,
        topic: 'Informe de conversación',
        timestamp: new Date().toISOString()
      };

      try {
        const webhookResponse = await fetch('https://webhook.hubleconsulting.com/webhook/154f3182-4561-4897-b57a-51db1fd2informe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(informeContext)
        });

        if (webhookResponse.ok) {
          const webhookData = await webhookResponse.json();
          const pdfUrl = webhookData.response;

          if (pdfUrl) {
            console.log('PDF generated:', pdfUrl);
            
            await supabaseAdmin
              .from('messages')
              .insert({
                user_id: user_id,
                conversation_id: conversation_id,
                role: 'assistant',
                message: `📄 ¡Tu informe está listo! Descárgalo aquí:\n\n${pdfUrl}`
              });
          }
        } else {
          console.error('Webhook error:', webhookResponse.status);
          await supabaseAdmin
            .from('messages')
            .insert({
              user_id: user_id,
              conversation_id: conversation_id,
              role: 'assistant',
              message: '❌ Hubo un problema generando el informe. Por favor intenta de nuevo más tarde.'
            });
        }
      } catch (webhookError) {
        console.error('Error calling webhook:', webhookError);
        await supabaseAdmin
          .from('messages')
          .insert({
            user_id: user_id,
            conversation_id: conversation_id,
            role: 'assistant',
            message: '❌ Hubo un error inesperado generando el informe. Por favor intenta de nuevo.'
          });
      }

      return new Response(
        JSON.stringify({ success: true, action: 'informe' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === NORMAL CHAT FLOW ===
    // Construir prompt personalizado
    const systemPrompt = buildPersonalizedPrompt(starterProfile);

    // Save user message (skip if requested - used for background tasks)
    if (!skip_user_message) {
      const { error: insertUserError } = await supabaseAdmin
        .from('messages')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          role: 'user',
          message: message.trim()
        });

      if (insertUserError) {
        console.error('Error saving user message:', insertUserError);
        throw new Error('Error guardando mensaje');
      }
    }

    // Build conversation history
    const conversationHistory: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }> = [
      { role: 'system', content: systemPrompt }
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

    // Si hay una imagen, agregar al último mensaje del usuario
    if (image && image.data && image.mimeType) {
      const lastUserMessageIndex = conversationHistory.length - 1;
      if (conversationHistory[lastUserMessageIndex]?.role === 'user') {
        const textContent = conversationHistory[lastUserMessageIndex].content as string;
        conversationHistory[lastUserMessageIndex] = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: textContent
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.data}`
              }
            }
          ]
        };
      }
    }

    // Call Lovable AI with retry logic
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const callAI = async (attempt: number = 1, useBackupModel: boolean = false): Promise<string> => {
      const model = useBackupModel ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
      console.log(`Calling Lovable AI with ${model}... (attempt ${attempt})`);
      console.log('Conversation history length:', conversationHistory.length);
      console.log('System prompt length:', (conversationHistory[0]?.content as string)?.length || 0);
      
      // Agregar mensaje adicional para forzar respuesta si es necesario
      const messagesWithPrompt = [...conversationHistory];
      if (attempt > 1) {
        // En reintentos, agregar instrucción explícita
        messagesWithPrompt.push({
          role: 'user' as const,
          content: '[Sistema: Por favor responde al mensaje anterior del usuario de forma útil y amigable.]'
        });
      }
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messagesWithPrompt,
          temperature: 0.8,
          max_tokens: 1500,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          if (attempt < 3) {
            console.log('Rate limited, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            return callAI(attempt + 1, useBackupModel);
          }
          throw new Error('Límite de solicitudes excedido. Por favor intenta más tarde.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Créditos insuficientes. Por favor recarga tu saldo.');
        }
        
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      console.log('AI response structure:', JSON.stringify({
        hasChoices: !!aiData.choices,
        choicesLength: aiData.choices?.length,
        hasMessage: !!aiData.choices?.[0]?.message,
        contentLength: aiData.choices?.[0]?.message?.content?.length,
        finishReason: aiData.choices?.[0]?.finish_reason
      }));
      
      const content = aiData.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
        console.log('Empty response received, attempt:', attempt, 'useBackupModel:', useBackupModel);
        
        // Retry with same model first
        if (attempt < 2) {
          console.log('Empty response, retrying with same model...');
          await new Promise(resolve => setTimeout(resolve, 500));
          return callAI(attempt + 1, useBackupModel);
        }
        // Try backup model
        if (!useBackupModel) {
          console.log('Empty response after retries, trying backup model...');
          return callAI(1, true);
        }
        console.error('No response from AI after all retries');
        
        // Generar una respuesta contextual basada en el último mensaje
        const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
        const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
        
        if (userText.length < 5) {
          return `¡Hola! 😊 Cuéntame, ¿qué te gustaría aprender hoy? Estoy aquí para ayudarte con cualquier tema.`;
        }
        return `¡Hola! 😊 Parece que tuve un pequeño problema técnico. ¿Podrías repetir tu mensaje? Estoy aquí para ayudarte.`;
      }

      return content;
    };

    const assistantResponse = await callAI();

    // Limpiar markdown de la respuesta (**, ##, listas, etc.)
    let cleanedResponse = assistantResponse
      .replaceAll('**', '')
      .replaceAll('##', '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '');

    console.log('AI response received, saving to database...');

    // Save assistant response
    const { error: insertAssistantError } = await supabaseAdmin
      .from('messages')
      .insert({
        user_id: user_id,
        conversation_id: conversation_id,
        role: 'assistant',
        message: cleanedResponse
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
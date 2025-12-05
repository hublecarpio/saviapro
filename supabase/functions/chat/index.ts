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

    // Call n8n webhook for AI response
    console.log('Calling n8n webhook for AI response...');
    
    // Detectar tipo de respuesta esperada basándose en el mensaje
    const messageLower = message.toLowerCase().trim();
    let tipo_respuesta = 'informativa'; // default
    
    // Palabras clave para tipo visual
    const visualKeywords = ['imagen', 'imágenes', 'foto', 'fotos', 'muestra', 'muéstrame', 'ver', 'visual', 'dibujo', 'ilustra', 'gráfico', 'diagrama', 'ejemplo visual', 'cómo se ve', 'como se ve', 'picture', 'image'];
    
    // Palabras clave para tipo auditivo
    const audioKeywords = ['audio', 'escucha', 'escuchar', 'sonido', 'pronuncia', 'pronunciación', 'lee en voz alta', 'podcast', 'reproduce', 'oír', 'voz'];
    
    if (visualKeywords.some(keyword => messageLower.includes(keyword))) {
      tipo_respuesta = 'visual';
    } else if (audioKeywords.some(keyword => messageLower.includes(keyword))) {
      tipo_respuesta = 'auditiva';
    }
    
    console.log('Detected response type:', tipo_respuesta);
    
    const webhookResponse = await fetch(
      'https://webhook.hubleconsulting.com/webhook/7e846525-ea3a-4213-8f66-5d0dad8547bc',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: message.trim(),
          id_conversation: conversation_id,
          id_user: user_id,
          tipo_respuesta: tipo_respuesta
        })
      }
    );

    if (!webhookResponse.ok) {
      console.error('Webhook error:', webhookResponse.status);
      throw new Error('Error al obtener respuesta del agente');
    }

    const webhookData = await webhookResponse.json();
    console.log('Webhook response received:', JSON.stringify(webhookData));

    // Process the array of messages from n8n
    // The response format is: [{"mensajes": ["msg1", "msg2", ...], "images": ["url1", "url2", ...], "images_count": 2}]
    let mensajes: string[] = [];
    let images: string[] = [];
    
    if (Array.isArray(webhookData) && webhookData.length > 0) {
      const responseObj = webhookData[0];
      mensajes = responseObj.mensajes || [];
      images = responseObj.images || [];
    } else if (webhookData.mensajes) {
      mensajes = webhookData.mensajes;
      images = webhookData.images || [];
    } else if (Array.isArray(webhookData)) {
      mensajes = webhookData;
    }
    
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      console.error('Invalid response format from webhook:', webhookData);
      throw new Error('Formato de respuesta inválido del agente');
    }

    console.log('AI response received, saving', mensajes.length, 'messages and', images.length, 'images to database...');

    // Save each message as a separate assistant message with delay
    for (let i = 0; i < mensajes.length; i++) {
      const msg = mensajes[i];
      
      // Wait 500ms between messages (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Limpiar markdown de la respuesta (**, ##, listas, etc.)
      const cleanedMessage = msg
        .replaceAll('**', '')
        .replaceAll('##', '')
        .replace(/^\s*[-*]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '');

      const { error: insertAssistantError } = await supabaseAdmin
        .from('messages')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          role: 'assistant',
          message: cleanedMessage
        });

      if (insertAssistantError) {
        console.error('Error saving assistant message:', insertAssistantError);
        throw new Error('Error guardando respuesta');
      }
      
      console.log(`Message ${i + 1}/${mensajes.length} saved`);
    }

    // Save images as a separate message if there are any
    if (images.length > 0) {
      // Wait before sending images
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Format: [IMAGES]url1|url2|url3[/IMAGES]
      const imagesMessage = `[IMAGES]${images.join('|')}[/IMAGES]`;
      
      const { error: insertImagesError } = await supabaseAdmin
        .from('messages')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          role: 'assistant',
          message: imagesMessage
        });

      if (insertImagesError) {
        console.error('Error saving images message:', insertImagesError);
      } else {
        console.log(`${images.length} images saved as message`);
      }
    }

    console.log('All messages saved successfully');

    // Update conversation title after 3+ messages if still has default title
    const { data: convData } = await supabaseAdmin
      .from('conversations')
      .select('title')
      .eq('id', conversation_id)
      .single();
    
    const { count: messageCount } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id);
    
    // If conversation has 3+ messages and title looks like default, generate better title
    const totalMessages = messageCount || recentMessages?.length || 0;
    const needsTitleUpdate = convData?.title === 'Nueva conversación' || 
                             convData?.title?.startsWith('Hola') ||
                             convData?.title?.startsWith('hola') ||
                             convData?.title?.length < 10;
    
    console.log('Title update check:', { totalMessages, currentTitle: convData?.title, needsTitleUpdate });
    
    if (totalMessages >= 3 && needsTitleUpdate && recentMessages && recentMessages.length > 0) {
      console.log('Generating conversation title with AI...');
      
      // Build conversation context for title generation (first 3 messages)
      const conversationContext = recentMessages
        .reverse()
        .slice(0, 3)
        .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.message.substring(0, 150)}`)
        .join('\n');
      
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        if (LOVABLE_API_KEY) {
          const titleResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                {
                  role: 'system',
                  content: 'Genera un título MUY CORTO de 2-3 palabras máximo para esta conversación. Solo el tema principal. Sin puntuación. Sin explicaciones. Ejemplos: "Fracciones matemáticas", "Historia azteca", "Fotosíntesis plantas".'
                },
                {
                  role: 'user',
                  content: conversationContext
                }
              ],
              max_tokens: 20,
              temperature: 0.2
            }),
          });

          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            let generatedTitle = titleData.choices?.[0]?.message?.content?.trim() || '';
            
            // Clean up the title
            generatedTitle = generatedTitle
              .replace(/^["']|["']$/g, '') // Remove quotes
              .replace(/^título:\s*/i, '') // Remove "Título:" prefix
              .replace(/[.!?:,;]$/g, '') // Remove trailing punctuation
              .substring(0, 30); // Limit length
            
            if (generatedTitle && generatedTitle.length > 2) {
              await supabaseAdmin
                .from('conversations')
                .update({ title: generatedTitle })
                .eq('id', conversation_id);
              
              console.log('Conversation title updated with AI to:', generatedTitle);
            }
          } else {
            console.error('AI title generation failed:', titleResponse.status);
          }
        } else {
          console.log('LOVABLE_API_KEY not available, skipping AI title generation');
        }
      } catch (titleError) {
        console.error('Error generating AI title:', titleError);
        // Fallback: use simple extraction
        const userMessages = recentMessages
          .filter(m => m.role === 'user')
          .map(m => m.message)
          .slice(0, 2)
          .join(' ');
        const words = userMessages.split(/\s+/).filter(w => w.length > 3);
        const fallbackTitle = words.slice(0, 3).join(' ').substring(0, 30) || 'Conversación';
        
        await supabaseAdmin
          .from('conversations')
          .update({ title: fallbackTitle })
          .eq('id', conversation_id);
        
        console.log('Fallback title used:', fallbackTitle);
      }
    }

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
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
  
  // Extraer información relevante del starter
  const nombre = data.description ? data.description.split(',')[0].replace('Soy ', '') : 'Estudiante';
  const nivelAcademico = ageGroup === '7-12' ? 'Primaria' : ageGroup === '12-17' ? 'Secundaria' : 'No especificado';
  
  // Construir descripción del perfil cognitivo
  let perfilCognitivo = [];
  
  if (data.learningStyle) {
    const styles = Array.isArray(data.learningStyle) ? data.learningStyle : [data.learningStyle];
    perfilCognitivo.push(`Estilo de aprendizaje: ${styles.join(', ')}`);
  }
  
  if (data.studyTime || data.sessionDuration) {
    perfilCognitivo.push(`Tiempo de estudio preferido: ${data.studyTime || data.sessionDuration}`);
  }
  
  if (data.explanationStyle || data.communicationStyle) {
    const style = data.explanationStyle || data.communicationStyle;
    perfilCognitivo.push(`Estilo de explicación preferido: ${Array.isArray(style) ? style.join(', ') : style}`);
  }
  
  if (data.interests || data.passionateTopics) {
    const topics = data.interests || data.passionateTopics;
    perfilCognitivo.push(`Temas de interés: ${Array.isArray(topics) ? topics.join(', ') : topics}`);
  }

  const perfilTexto = perfilCognitivo.length > 0 ? perfilCognitivo.join('. ') : 'Perfil aún sin completar';

  return `Tú eres Sofía, una tutora experta y amigable de la plataforma BIEX 4.0. Tu misión es guiar a los estudiantes, no solo para que aprendan un tema, sino para que desarrollen un pensamiento crítico profundo y duradero. Tu personalidad es empática, paciente y extremadamente curiosa.

TU REGLA MÁS IMPORTANTE: Debes seguir un flujo de trabajo estructurado en FASES. Nunca te saltes una fase ni mezcles sus objetivos.

---
--- PERFIL DEL ALUMNO (Datos de Entrada) ---

* Nombre: ${nombre}
* Edad: ${age} años
* Nivel: ${nivelAcademico}
* Perfil Cognitivo y de Aprendizaje: ${perfilTexto}
---

NOTA IMPORTANTE SOBRE RESPUESTAS: 
- NUNCA uses formato markdown en tus respuestas (no uses **, ##, listas con -, etc.)
- Responde siempre en texto claro y natural
- Si te piden un "informe", "reporte" o "documento PDF", responde que estás generando el documento y proporciona un breve ejemplo por escrito mientras se crea. El sistema generará el PDF automáticamente.
- Si te piden un "mapa mental", "mapa conceptual" o "esquema visual", confirma que estás creando el mapa mental y proporciona un breve resumen por escrito del contenido. El sistema lo generará automáticamente.

### FLUJO DE TRABAJO OBLIGATORIO ###

Tu interacción con el alumno se divide en 3 FASES. Comienzas siempre en la FASE 1.

#### FASE 1: INVESTIGACIÓN Y ENTREGA DE CONTENIDO

Tu Objetivo: Recopilar y presentar la información base de la manera más efectiva para el alumno.

1. Inicio de Tema: Cuando el alumno te diga sobre qué tema quiere aprender, tu PRIMERA ACCIÓN SIEMPRE será preguntar por sus conocimientos previos. Usa una frase como: "¡Claro! Hablemos de [TEMA]. Para empezar, cuéntame en tus propias palabras, ¿qué sabes o qué has escuchado sobre esto?"
2. Análisis y Adaptación: Usa su respuesta para entender su nivel. Luego, genera una "clase" o un "informe" totalmente adaptado a su PERFIL.
   * Si su perfil indica aprendizaje Visual, describe el contenido como si fueran infografías, mapas mentales o videos cortos.
   * Si su perfil indica aprendizaje Auditivo, usa narrativas y explicaciones habladas.
   * Si su perfil es Kinestésico, sugiere actividades prácticas.
   * Si su perfil es de Lectura/Escritura, genera textos estructurados con puntos claros.
3. Refinamiento: El alumno puede hacerte preguntas para aclarar dudas sobre este material. Responde directamente.

---
#### LA TRANSICIÓN (LA ILACIÓN)

REGLA DE CAMBIO DE FASE: Pasarás de la FASE 1 a la FASE 2 ÚNICA Y EXCLUSIVAMENTE cuando el alumno te dé una confirmación clara de que ha entendido el material y está listo para profundizar. (Ej: "Ya entendí", "Estoy listo/a", "Ok, podemos seguir").

Cuando detectes una de estas frases, debes responder con una transición amable. Por ejemplo: "Perfecto. Ahora que ya tenemos la información base, vamos a lo más interesante: conversar sobre ello." E inmediatamente, inicias la FASE 2.

---
#### FASE 2: DIÁLOGO SOCRÁTICO

Tu Objetivo: Fomentar el pensamiento crítico.

1. REGLA CRÍTICA: A partir de este momento, tienes PROHIBIDO dar nueva información o responder preguntas directamente. Tu ÚNICO MÉTODO de comunicación es hacer PREGUNTAS ABIERTAS.
2. Tipo de Preguntas: Tus preguntas deben guiar al alumno a conectar el tema con su vida, explorar "por qués", imaginar escenarios y cuestionar la información.
3. Evaluación Interna: Mientras conversas, evalúa mentalmente su nivel de comprensión en una escala del 1 al 10.
4. Cierre del Diálogo: Después de varias preguntas (aproximadamente 10-15 intercambios), cierra la sesión de forma positiva: "Has hecho un gran trabajo conectando las ideas. Se nota que has comprendido el tema a un nivel más profundo. ¡Excelente!"

---
#### FASE 3: REPORTE FINAL

Tu Objetivo: Generar un resumen para el tutor (padre/madre).

1. Generación Automática: Al finalizar la FASE 2, sin que el alumno te lo pida, genera un bloque de texto final, claramente separado del resto de la conversación, con el siguiente formato exacto:

### REPORTE PARA TUTOR ###
**Alumno:** ${nombre}
**Tema de la Sesión:** [Tema que estudiaron]
**Nivel de Comprensión (Rúbrica):** [Número del 1 al 10] de 10.
**Observaciones de Sofía:** [Comentario breve y constructivo sobre el desempeño del estudiante.]

---
IMPORTANTE: 
- Adapta tu lenguaje y complejidad a la edad del estudiante (${age} años, nivel ${nivelAcademico})
- Usa emojis ocasionalmente para mantener el ambiente amigable y motivador
- Si el estudiante tiene ${age} años o menos, usa lenguaje más simple y ejemplos concretos
- Mantén las respuestas concisas pero completas
- Siempre sé paciente y celebra los logros del estudiante

INICIO DE LA CONVERSACIÓN: Comienza la interacción en la FASE 1. Saluda al estudiante por su nombre (${nombre}) de manera cálida y pregúntale sobre qué tema le gustaría aprender hoy.`;
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
      
      // Crear resumen del tema basado en la conversación
      const conversationSummary = recentMessages && recentMessages.length > 0 
        ? recentMessages.slice(0, 5).map(m => m.message).join(' ').substring(0, 100)
        : 'Tema de estudio';
      
      console.log('📝 Generando mapa mental para tema:', conversationSummary);
      
      try {
        const mindMapResponse = await fetch(
          'https://flowhook.iamhuble.space/webhook/f71225ad-7798-4e52-bd89-35a1e79549e9',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tema: conversationSummary })
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
                tema: conversationSummary,
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
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 2000,
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
        contentLength: aiData.choices?.[0]?.message?.content?.length
      }));
      
      const content = aiData.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
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
        console.error('No response from AI after all retries, aiData:', JSON.stringify(aiData));
        throw new Error('No se pudo obtener respuesta del AI. Por favor intenta de nuevo.');
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
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

    const { message, conversation_id, user_id } = await req.json();
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
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

    console.log('Processing message for user:', user_id, 'conversation:', conversation_id);

    // Obtener perfil del starter del usuario
    const { data: starterProfile, error: profileError } = await supabaseAdmin
      .from('starter_profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching starter profile:', profileError);
    }

    // Construir prompt personalizado
    const systemPrompt = buildPersonalizedPrompt(starterProfile);

    // Save user message
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

    // Get conversation history (last 20 messages)
    const { data: recentMessages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('role, message')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Build conversation history
    const conversationHistory = [
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

    // Call Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: conversationHistory,
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Límite de solicitudes excedido. Por favor intenta más tarde.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Por favor recarga tu saldo.');
      }
      
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantResponse = aiData.choices?.[0]?.message?.content;

    if (!assistantResponse) {
      console.error('No response from AI');
      throw new Error('No response from AI');
    }

    console.log('AI response received, saving to database...');

    // Save assistant response
    const { error: insertAssistantError } = await supabaseAdmin
      .from('messages')
      .insert({
        user_id: user_id,
        conversation_id: conversation_id,
        role: 'assistant',
        message: assistantResponse
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
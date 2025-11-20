import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, audioFormat } = await req.json();
    
    if (!audioBase64) {
      throw new Error('No audio data provided');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Convertir base64 a blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Crear data URL para enviar a Gemini
    const mimeType = audioFormat === 'mp4' ? 'audio/mp4' : 
                     audioFormat === 'ogg' ? 'audio/ogg' : 
                     'audio/webm';
    const dataUrl = `data:${mimeType};base64,${audioBase64}`;

    console.log('Transcribing audio with Gemini...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Por favor transcribe este audio a texto en español. Solo devuelve el texto transcrito sin comentarios adicionales.'
              },
              {
                type: 'audio_url',
                audio_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Gemini AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Límite de solicitudes excedido. Por favor intenta más tarde.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Por favor recarga tu saldo.');
      }
      
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const transcription = aiData.choices?.[0]?.message?.content;

    if (!transcription) {
      throw new Error('No transcription received from AI');
    }

    console.log('Transcription successful');

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

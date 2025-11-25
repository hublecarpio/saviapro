import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audioBase64, audioFormat } = await req.json();
    
    if (!audioBase64) {
      throw new Error('No audio data provided');
    }

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!googleApiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY not configured');
    }

    console.log('Processing audio with Google Speech-to-Text...');
    console.log('Audio format:', audioFormat);
    
    // Process audio in chunks to prevent memory issues
    const binaryAudio = processBase64Chunks(audioBase64);
    console.log('Audio size:', binaryAudio.length, 'bytes');

    // Determine encoding based on format
    let encoding = 'WEBM_OPUS';
    if (audioFormat === 'mp4') encoding = 'MP3';
    else if (audioFormat === 'ogg') encoding = 'OGG_OPUS';
    else if (audioFormat === 'webm') encoding = 'WEBM_OPUS';

    // Convert binary audio back to base64 for Google API
    const base64ForGoogle = btoa(String.fromCharCode(...binaryAudio));

    // Call Google Speech-to-Text API
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: encoding,
            sampleRateHertz: 48000, // Common sample rate for web audio
            languageCode: 'es-ES', // Spanish
            alternativeLanguageCodes: ['es-MX', 'es-AR', 'es-CO'], // Latin American variants
            enableAutomaticPunctuation: true,
            model: 'default',
            useEnhanced: true,
          },
          audio: {
            content: base64ForGoogle,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Speech-to-Text error:', response.status, errorText);
      
      if (response.status === 400) {
        throw new Error('Formato de audio no compatible. Por favor intenta de nuevo.');
      }
      if (response.status === 429) {
        throw new Error('Límite de solicitudes excedido. Por favor intenta más tarde.');
      }
      if (response.status === 403) {
        throw new Error('API key inválida. Por favor verifica tu configuración.');
      }
      
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google API response:', JSON.stringify(data, null, 2));

    // Extract transcription from response
    const transcription = data.results
      ?.map((result: any) => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    if (!transcription) {
      throw new Error('No se pudo transcribir el audio. Por favor intenta hablar más claro.');
    }

    console.log('Transcription successful:', transcription);

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido al transcribir'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
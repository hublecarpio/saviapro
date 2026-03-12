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
    console.log('[process-pedagogical-doc] === START ===');

    const { content, file_name, user_id, file_type = 'application/octet-stream', content_url } = await req.json();

    console.log('[process-pedagogical-doc] Received:', {
      file_name,
      file_type,
      user_id,
      contentLength: content?.length,
    });

    // Validación
    if (!content || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: content and user_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (content.length < 20) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is too short (minimum 20 characters)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (content.startsWith('[Error')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content appears to be an error message, not valid document text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[process-pedagogical-doc] Validation passed');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar título quitando la extensión
    const title = (file_name ?? 'documento').replace(/\.[^/.]+$/, '');

    const documentId = crypto.randomUUID();

    console.log('[process-pedagogical-doc] Inserting into pedagogical_docs:', {
      id: documentId,
      title,
      category: 'general',
      contentLength: content.length,
    });

    const { error: insertError } = await supabase
      .from('pedagogical_docs')
      .insert({
        id: documentId,
        title,
        content,
        category: 'general',
        sort_order: 0,
        is_active: true,
        metadata: {
          file_type,
          original_file_name: file_name,
          text_length: content.length,
          uploaded_by: user_id,
          content_url: content_url ?? null,
        },
      });

    if (insertError) {
      console.error('[process-pedagogical-doc] ❌ Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to insert document: ${insertError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[process-pedagogical-doc] ✅ Successfully inserted document:', {
      document_id: documentId,
      title,
      content_length: content.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        title,
        content_length: content.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[process-pedagogical-doc] ❌ General error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

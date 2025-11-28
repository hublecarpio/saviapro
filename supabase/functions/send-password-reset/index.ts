import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Crear cliente de Supabase con service_role_key para acceso administrativo
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

    // Verificar si el usuario existe
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error al buscar usuario:', userError);
      throw new Error('Error al verificar el usuario');
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      // Por seguridad, devolvemos éxito incluso si el usuario no existe
      return new Response(
        JSON.stringify({ success: true, message: 'Si el correo existe, recibirás las instrucciones' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generar link de recuperación de contraseña
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email
    });

    if (resetError) {
      console.error('Error al generar link:', resetError);
      throw new Error('Error al generar el link de recuperación');
    }

    console.log('Link de recuperación generado:', resetData);

    // Construir el link personalizado con el dominio correcto
    const token = resetData.properties?.hashed_token;
    const resetLink = `https://app.biexedu.com/reset-password?token=${token}&type=recovery`;

    // Enviar el link al webhook del cliente
    const webhookPayload = {
      email: email,
      reset_link: resetLink,
      type: 'password_reset'
    };

    console.log('Enviando a webhook:', webhookPayload);

    const webhookResponse = await fetch(
      'https://webhook.hubleconsulting.com/webhook/apicorreo88a1a578-5653-457a-b408-ae3cbb06cff6',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      }
    );

    if (!webhookResponse.ok) {
      console.error('Error en webhook:', await webhookResponse.text());
      throw new Error('Error al enviar al webhook');
    }

    const webhookResult = await webhookResponse.json();
    console.log('Respuesta del webhook:', webhookResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Se ha enviado el correo con las instrucciones para restablecer tu contraseña' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error en send-password-reset:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al procesar la solicitud' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
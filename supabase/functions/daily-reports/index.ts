import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://webhook.hubleconsulting.com/webhook/c388170a-5b5b-4dc7-a506-c655c47ffa85';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily reports generation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date range (Peru timezone UTC-5)
    const now = new Date();
    const peruOffset = -5 * 60 * 60 * 1000;
    const peruNow = new Date(now.getTime() + peruOffset);
    const todayStart = new Date(peruNow.getFullYear(), peruNow.getMonth(), peruNow.getDate());
    todayStart.setTime(todayStart.getTime() - peruOffset);
    
    console.log('Fetching tutors and their students...');

    // Get all tutors with their students
    const { data: tutorStudents, error: tsError } = await supabase
      .from('tutor_students')
      .select(`
        tutor_id,
        student_id
      `);

    if (tsError) {
      console.error('Error fetching tutor_students:', tsError);
      throw tsError;
    }

    if (!tutorStudents || tutorStudents.length === 0) {
      console.log('No tutor-student relationships found');
      return new Response(
        JSON.stringify({ success: true, message: 'No students to report' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group students by tutor
    const tutorMap = new Map<string, string[]>();
    tutorStudents.forEach(ts => {
      const students = tutorMap.get(ts.tutor_id) || [];
      students.push(ts.student_id);
      tutorMap.set(ts.tutor_id, students);
    });

    const reports: any[] = [];

    for (const [tutorId, studentIds] of tutorMap) {
      // Get tutor profile
      const { data: tutorProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', tutorId)
        .single();

      const tutorReport = {
        tutor_id: tutorId,
        tutor_name: tutorProfile?.name || 'Sin nombre',
        tutor_email: tutorProfile?.email || '',
        students: [] as any[],
        generated_at: new Date().toISOString()
      };

      for (const studentId of studentIds) {
        // Get student profile
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', studentId)
          .single();

        // Get today's conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, title, updated_at')
          .eq('user_id', studentId)
          .gte('updated_at', todayStart.toISOString())
          .order('updated_at', { ascending: false });

        // Get today's messages
        const { data: messages } = await supabase
          .from('messages')
          .select('message, role, created_at')
          .eq('user_id', studentId)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: true });

        // Get today's quiz results
        const { data: quizResults } = await supabase
          .from('quiz_results')
          .select('is_correct, created_at')
          .eq('user_id', studentId)
          .gte('created_at', todayStart.toISOString());

        // Get starter profile for context
        const { data: starterProfile } = await supabase
          .from('starter_profiles')
          .select('profile_data, age')
          .eq('user_id', studentId)
          .single();

        const totalQuizzes = quizResults?.length || 0;
        const correctAnswers = quizResults?.filter(q => q.is_correct).length || 0;
        const accuracy = totalQuizzes > 0 ? Math.round((correctAnswers / totalQuizzes) * 100) : 0;

        // Generate AI summary if there's activity and we have the API key
        let aiSummary = null;
        if (deepseekKey && messages && messages.length > 0) {
          try {
            const conversationSummary = messages
              .slice(-20) // Last 20 messages
              .map(m => `${m.role}: ${m.message.substring(0, 200)}`)
              .join('\n');

            const aiPrompt = `Eres un asistente educativo. Analiza la siguiente actividad de un estudiante y genera un breve reporte para su tutor.

Información del estudiante:
- Nombre: ${studentProfile?.name || 'Sin nombre'}
- Edad: ${starterProfile?.age || 'No especificada'}
- Temas estudiados hoy: ${conversations?.map(c => c.title).join(', ') || 'Ninguno'}
- Mensajes intercambiados: ${messages?.length || 0}
- Quizzes completados: ${totalQuizzes}
- Precisión en quizzes: ${accuracy}%

Últimos mensajes de la conversación:
${conversationSummary}

Genera un reporte breve (máximo 150 palabras) que incluya:
1. Resumen del progreso del día
2. Áreas de dificultad observadas
3. Recomendaciones para el tutor
4. Estado emocional percibido (basado en el tono de los mensajes)`;

            const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${deepseekKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: aiPrompt }],
                max_tokens: 800,
                temperature: 0.7,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiSummary = aiData.choices?.[0]?.message?.content || null;
            }
          } catch (aiError) {
            console.error('Error generating AI summary:', aiError);
          }
        }

        // Parse AI summary to extract structured data
        let progressSummary = aiSummary || `${messages?.length || 0} mensajes, ${totalQuizzes} quizzes (${accuracy}% correctas)`;
        let difficulties = null;
        let recommendations = null;
        let emotionalState = null;

        if (aiSummary) {
          // Try to extract sections from AI response
          const progressMatch = aiSummary.match(/(?:progreso|avance)[:\s]*([^.]+\.)/i);
          const difficultiesMatch = aiSummary.match(/(?:dificultad|dificultades)[:\s]*([^.]+\.)/i);
          const recommendationsMatch = aiSummary.match(/(?:recomendaci[oó]n|recomendaciones)[:\s]*([^.]+\.)/i);
          const emotionalMatch = aiSummary.match(/(?:estado emocional|emocional)[:\s]*([^.]+\.)/i);

          if (progressMatch) progressSummary = progressMatch[1].trim();
          if (difficultiesMatch) difficulties = difficultiesMatch[1].trim();
          if (recommendationsMatch) recommendations = recommendationsMatch[1].trim();
          if (emotionalMatch) emotionalState = emotionalMatch[1].trim();
          
          // If no structured extraction worked, use the full summary
          if (!progressMatch && !difficultiesMatch && !recommendationsMatch) {
            progressSummary = aiSummary;
          }
        }

        const studentReport = {
          student_id: studentId,
          student_name: studentProfile?.name || 'Sin nombre',
          student_email: studentProfile?.email || '',
          age: starterProfile?.age || null,
          activity: {
            conversations_today: conversations?.length || 0,
            topics: conversations?.map(c => c.title) || [],
            messages_count: messages?.length || 0,
            quizzes_completed: totalQuizzes,
            quiz_accuracy: accuracy,
          },
          ai_summary: aiSummary,
          parsed: {
            progress_summary: progressSummary,
            difficulties,
            recommendations,
            emotional_state: emotionalState
          }
        };

        tutorReport.students.push(studentReport);

        // Save report to database for the tutor
        if (messages && messages.length > 0) {
          const latestConversation = conversations?.[0];
          await supabase.from('tutor_reports').insert({
            student_id: studentId,
            tutor_id: tutorId,
            conversation_id: latestConversation?.id || null,
            topic: latestConversation?.title || 'Actividad general',
            progress_summary: studentReport.parsed.progress_summary,
            difficulties: studentReport.parsed.difficulties,
            recommendations: studentReport.parsed.recommendations,
            emotional_state: studentReport.parsed.emotional_state,
            daily_observation: `Conversaciones: ${conversations?.length || 0}, Mensajes: ${messages?.length || 0}, Quizzes: ${totalQuizzes} (${accuracy}% correctas)`,
          });
          
          console.log(`Report saved for student ${studentProfile?.name} -> tutor ${tutorProfile?.name}`);
        }
      }

      reports.push(tutorReport);
    }

    console.log(`Generated reports for ${reports.length} tutors`);

    // Send to webhook
    console.log('Sending reports to webhook...');
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'daily_tutor_reports',
        generated_at: new Date().toISOString(),
        timezone: 'America/Lima',
        reports: reports,
      }),
    });

    const webhookStatus = webhookResponse.ok ? 'success' : 'failed';
    console.log(`Webhook response status: ${webhookResponse.status}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reports_count: reports.length,
        webhook_status: webhookStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily-reports:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

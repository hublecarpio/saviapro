import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Target, TrendingUp, Clock, BookOpen } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface GroupStats {
  totalStudents: number;
  totalMessages: number;
  totalConversations: number;
  avgMessagesPerStudent: number;
  avgQuizScore: number;
  activeToday: number;
  studentsProgress: Array<{
    id: string;
    name: string;
    messages: number;
    quizScore: number;
    lastActivity: string | null;
  }>;
}

interface TutorEstadisticasProps {
  students: Student[];
  tutorId: string;
}

export const TutorEstadisticas = ({ students, tutorId }: TutorEstadisticasProps) => {
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupStats();
  }, [students]);

  const loadGroupStats = async () => {
    if (students.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const studentIds = students.map(s => s.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Mensajes totales
      const { count: totalMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("user_id", studentIds);

      // Conversaciones totales
      const { count: totalConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .in("user_id", studentIds);

      // Estudiantes activos hoy
      const { data: activeMessages } = await supabase
        .from("messages")
        .select("user_id")
        .in("user_id", studentIds)
        .gte("created_at", today.toISOString());

      const uniqueActive = new Set(activeMessages?.map(m => m.user_id) || []);

      // Quiz results agregados
      const { data: allQuizResults } = await supabase
        .from("quiz_results")
        .select("user_id, is_correct")
        .in("user_id", studentIds);

      const correctTotal = allQuizResults?.filter(r => r.is_correct).length || 0;
      const quizTotal = allQuizResults?.length || 0;
      const avgQuizScore = quizTotal > 0 ? Math.round((correctTotal / quizTotal) * 100) : 0;

      // Progreso individual de cada estudiante
      const studentsProgress = await Promise.all(
        students.map(async (student) => {
          const { count: msgCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", student.id);

          const { data: studentQuiz } = await supabase
            .from("quiz_results")
            .select("is_correct")
            .eq("user_id", student.id);

          const correct = studentQuiz?.filter(r => r.is_correct).length || 0;
          const total = studentQuiz?.length || 0;
          const score = total > 0 ? Math.round((correct / total) * 100) : 0;

          const { data: lastMsg } = await supabase
            .from("messages")
            .select("created_at")
            .eq("user_id", student.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: student.id,
            name: student.name,
            messages: msgCount || 0,
            quizScore: score,
            lastActivity: lastMsg?.created_at || null,
          };
        })
      );

      setStats({
        totalStudents: students.length,
        totalMessages: totalMessages || 0,
        totalConversations: totalConversations || 0,
        avgMessagesPerStudent: students.length > 0 ? Math.round((totalMessages || 0) / students.length) : 0,
        avgQuizScore,
        activeToday: uniqueActive.size,
        studentsProgress: studentsProgress.sort((a, b) => b.messages - a.messages),
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats || students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No hay datos suficientes</h3>
          <p className="text-muted-foreground">Invita estudiantes para ver estadísticas</p>
        </CardContent>
      </Card>
    );
  }

  const maxMessages = Math.max(...stats.studentsProgress.map(s => s.messages), 1);

  return (
    <div className="space-y-6">
      {/* Métricas generales del grupo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total estudiantes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeToday}</p>
                <p className="text-sm text-muted-foreground">Activos hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgQuizScore}%</p>
                <p className="text-sm text-muted-foreground">Promedio quiz</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas adicionales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen del grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total de mensajes
            </span>
            <span className="font-semibold">{stats.totalMessages}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total de conversaciones
            </span>
            <span className="font-semibold">{stats.totalConversations}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Promedio mensajes por estudiante
            </span>
            <span className="font-semibold">{stats.avgMessagesPerStudent}</span>
          </div>
        </CardContent>
      </Card>

      {/* Comparativa de estudiantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativa de actividad</CardTitle>
          <CardDescription>Mensajes por estudiante</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.studentsProgress.map((student) => (
            <div key={student.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{student.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {student.quizScore}% quiz
                  </Badge>
                  <span className="text-sm text-muted-foreground">{student.messages} msgs</span>
                </div>
              </div>
              <Progress 
                value={(student.messages / maxMessages) * 100} 
                className="h-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ranking de precisión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de comprensión</CardTitle>
          <CardDescription>Ordenado por precisión en quiz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...stats.studentsProgress]
              .sort((a, b) => b.quizScore - a.quizScore)
              .map((student, index) => (
                <div key={student.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={student.quizScore} className="w-24 h-2" />
                    <span className="text-sm font-semibold w-12 text-right">{student.quizScore}%</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
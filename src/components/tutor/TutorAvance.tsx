import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, BookOpen, CheckCircle, XCircle, Clock, MessageSquare, TrendingUp, Target } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface StudentProgress {
  totalConversations: number;
  totalMessages: number;
  totalQuizzes: number;
  correctAnswers: number;
  lastSessions: Array<{ date: string; messages: number }>;
}

interface TutorAvanceProps {
  students: Student[];
  tutorId: string;
}

export const TutorAvance = ({ students, tutorId }: TutorAvanceProps) => {
  const [selectedStudent, setSelectedStudent] = useState<string>(students[0]?.id || "");
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentProgress(selectedStudent);
    }
  }, [selectedStudent]);

  const loadStudentProgress = async (studentId: string) => {
    setLoading(true);
    try {
      // Contar conversaciones
      const { count: conversationsCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", studentId);

      // Contar mensajes totales
      const { count: messagesCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", studentId);

      // Resultados de quiz
      const { data: quizResults } = await supabase
        .from("quiz_results")
        .select("is_correct")
        .eq("user_id", studentId);

      // Últimas sesiones (mensajes por día de los últimos 7 días)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", studentId)
          .gte("created_at", date.toISOString())
          .lt("created_at", nextDate.toISOString());

        last7Days.push({
          date: format(date, "EEE", { locale: es }),
          messages: count || 0,
        });
      }

      setProgress({
        totalConversations: conversationsCount || 0,
        totalMessages: messagesCount || 0,
        totalQuizzes: quizResults?.length || 0,
        correctAnswers: quizResults?.filter(r => r.is_correct).length || 0,
        lastSessions: last7Days,
      });
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedStudentData = students.find(s => s.id === selectedStudent);
  const quizPercentage = progress?.totalQuizzes 
    ? Math.round((progress.correctAnswers / progress.totalQuizzes) * 100) 
    : 0;

  // Determinar nivel basado en actividad
  const getLevel = () => {
    const total = progress?.totalMessages || 0;
    if (total >= 100) return { level: 3, name: "Avanzado", color: "text-green-600" };
    if (total >= 30) return { level: 2, name: "Intermedio", color: "text-blue-600" };
    return { level: 1, name: "Principiante", color: "text-orange-600" };
  };

  const levelInfo = getLevel();

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No tienes estudiantes</h3>
          <p className="text-muted-foreground">Invita estudiantes para ver su progreso</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de estudiante */}
      <div className="flex items-center gap-4">
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Seleccionar alumno" />
          </SelectTrigger>
          <SelectContent>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Información del estudiante */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{selectedStudentData?.name}</CardTitle>
                    <CardDescription>{selectedStudentData?.email}</CardDescription>
                  </div>
                </div>
                <Badge className={`${levelInfo.color} bg-opacity-10`}>
                  Nivel {levelInfo.level}: {levelInfo.name}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Métricas de progreso */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{progress?.totalMessages || 0}</p>
                    <p className="text-sm text-muted-foreground">Mensajes totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{progress?.totalConversations || 0}</p>
                    <p className="text-sm text-muted-foreground">Temas estudiados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{progress?.correctAnswers || 0}</p>
                    <p className="text-sm text-muted-foreground">Respuestas correctas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Target className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{quizPercentage}%</p>
                    <p className="text-sm text-muted-foreground">Precisión quiz</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de actividad semanal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Actividad de los últimos 7 días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-32">
                {progress?.lastSessions.map((session, idx) => {
                  const maxMessages = Math.max(...(progress?.lastSessions.map(s => s.messages) || [1]));
                  const height = maxMessages > 0 ? (session.messages / maxMessages) * 100 : 0;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div className="w-full flex flex-col items-center justify-end h-24">
                        <span className="text-xs text-muted-foreground mb-1">{session.messages}</span>
                        <div 
                          className="w-full max-w-8 bg-primary/80 rounded-t transition-all"
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2 capitalize">{session.date}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Nivel de comprensión */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nivel de comprensión</CardTitle>
              <CardDescription>Basado en respuestas de quiz</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Precisión general</span>
                  <span className="text-sm text-muted-foreground">{quizPercentage}%</span>
                </div>
                <Progress value={quizPercentage} className="h-3" />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {progress?.correctAnswers || 0} correctas
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    {(progress?.totalQuizzes || 0) - (progress?.correctAnswers || 0)} incorrectas
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
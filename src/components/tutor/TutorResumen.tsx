import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Clock, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface StudentActivity {
  studentId: string;
  lastActivity: string | null;
  todayMessages: number;
  totalQuizzes: number;
  correctAnswers: number;
}

interface TutorResumenProps {
  students: Student[];
  tutorId: string;
}

export const TutorResumen = ({ students, tutorId }: TutorResumenProps) => {
  const [activities, setActivities] = useState<Record<string, StudentActivity>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentActivities();

    if (students.length === 0) return;

    const channel = supabase
      .channel("tutor-resumen-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadStudentActivities();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results" }, () => {
        loadStudentActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [students]);

  const loadStudentActivities = async () => {
    if (students.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activitiesMap: Record<string, StudentActivity> = {};

      for (const student of students) {
        // Última actividad
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("created_at")
          .eq("user_id", student.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Mensajes de hoy
        const { count: todayCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", student.id)
          .gte("created_at", today.toISOString());

        // Resultados de quiz
        const { data: quizResults } = await supabase
          .from("quiz_results")
          .select("is_correct")
          .eq("user_id", student.id);

        const totalQuizzes = quizResults?.length || 0;
        const correctAnswers = quizResults?.filter(r => r.is_correct).length || 0;

        activitiesMap[student.id] = {
          studentId: student.id,
          lastActivity: lastMessage?.created_at || null,
          todayMessages: todayCount || 0,
          totalQuizzes,
          correctAnswers,
        };
      }

      setActivities(activitiesMap);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (activity: StudentActivity | undefined, starterCompleted: boolean) => {
    if (!starterCompleted) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Perfil pendiente</Badge>;
    }
    
    if (!activity?.lastActivity) {
      return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Sin actividad</Badge>;
    }

    const lastDate = new Date(activity.lastActivity);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      return <Badge className="bg-green-100 text-green-700 border-green-200">Va excelente</Badge>;
    } else if (hoursDiff < 72) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Normal</Badge>;
    } else {
      return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Necesita apoyo</Badge>;
    }
  };

  const formatLastActivity = (dateStr: string | null) => {
    if (!dateStr) return "Sin actividad";
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Hace menos de 1 hora";
    if (diffHours < 24) return `Hace ${diffHours} horas`;
    const days = Math.floor(diffHours / 24);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No tienes estudiantes</h3>
          <p className="text-muted-foreground">Ve a la sección "Lista de estudiantes" para invitar a tus alumnos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {students.map((student) => {
          const activity = activities[student.id];
          const quizPercentage = activity?.totalQuizzes 
            ? Math.round((activity.correctAnswers / activity.totalQuizzes) * 100) 
            : 0;

          return (
            <Card key={student.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <CardDescription>{student.email}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(activity, student.starter_completed)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Última actividad</p>
                      <p className="text-sm font-medium">{formatLastActivity(activity?.lastActivity || null)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mensajes hoy</p>
                      <p className="text-sm font-medium">{activity?.todayMessages || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Quiz correctos</p>
                      <p className="text-sm font-medium">{activity?.correctAnswers || 0}/{activity?.totalQuizzes || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    {quizPercentage >= 70 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Nivel comprensión</p>
                      <p className="text-sm font-medium">{quizPercentage}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
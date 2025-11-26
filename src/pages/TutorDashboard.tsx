import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, MessageSquare, Brain, TrendingUp } from "lucide-react";

interface DashboardMetrics {
  totalStudents: number;
  totalMessages: number;
  totalConversations: number;
  totalMindMaps: number;
  activeStudentsToday: number;
}

const TutorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalStudents: 0,
    totalMessages: 0,
    totalConversations: 0,
    totalMindMaps: 0,
    activeStudentsToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
        return;
      }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);

      if (!roles?.some((r) => r.role === "tutor")) {
        if (roles?.some((r) => r.role === "admin")) {
          navigate("/admin");
        } else {
          navigate("/chat");
        }
        return;
      }

      setUser(session.user);
      await loadDashboardMetrics(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardMetrics = async (tutorId: string) => {
    try {
      // Obtener lista de estudiantes
      const { data: relations, error: relError } = await supabase
        .from("tutor_students")
        .select("student_id")
        .eq("tutor_id", tutorId);

      if (relError) throw relError;

      if (!relations || relations.length === 0) {
        setMetrics({
          totalStudents: 0,
          totalMessages: 0,
          totalConversations: 0,
          totalMindMaps: 0,
          activeStudentsToday: 0,
        });
        return;
      }

      const studentIds = relations.map((r) => r.student_id);

      // Contar mensajes totales
      const { count: messagesCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("user_id", studentIds);

      // Contar conversaciones totales
      const { count: conversationsCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .in("user_id", studentIds);

      // Contar mapas mentales totales
      const { count: mindMapsCount } = await supabase
        .from("mind_maps")
        .select("*", { count: "exact", head: true })
        .in("user_id", studentIds);

      // Contar estudiantes activos hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: activeToday } = await supabase
        .from("messages")
        .select("user_id")
        .in("user_id", studentIds)
        .gte("created_at", today.toISOString());

      const uniqueActiveStudents = new Set(activeToday?.map((m) => m.user_id) || []);

      setMetrics({
        totalStudents: studentIds.length,
        totalMessages: messagesCount || 0,
        totalConversations: conversationsCount || 0,
        totalMindMaps: mindMapsCount || 0,
        activeStudentsToday: uniqueActiveStudents.size,
      });
    } catch (error) {
      console.error("Error loading dashboard metrics:", error);
      toast.error("Error al cargar métricas");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold">Dashboard de Tutor</h2>
            <p className="text-muted-foreground">Resumen general de actividad de tus estudiantes</p>
          </div>

          {/* Cards de métricas principales */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalStudents}</div>
                <p className="text-xs text-muted-foreground">de 2 disponibles</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activos Hoy</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeStudentsToday}</div>
                <p className="text-xs text-muted-foreground">estudiantes con actividad</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalMessages}</div>
                <p className="text-xs text-muted-foreground">en {metrics.totalConversations} conversaciones</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mapas Mentales</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalMindMaps}</div>
                <p className="text-xs text-muted-foreground">creados por estudiantes</p>
              </CardContent>
            </Card>
          </div>

          {/* Información adicional */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Actividad</CardTitle>
              <CardDescription>Estadísticas generales de todos tus estudiantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Promedio de mensajes por estudiante</span>
                <span className="font-semibold">
                  {metrics.totalStudents > 0 
                    ? Math.round(metrics.totalMessages / metrics.totalStudents) 
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Promedio de conversaciones por estudiante</span>
                <span className="font-semibold">
                  {metrics.totalStudents > 0 
                    ? Math.round(metrics.totalConversations / metrics.totalStudents) 
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Promedio de mapas por estudiante</span>
                <span className="font-semibold">
                  {metrics.totalStudents > 0 
                    ? (metrics.totalMindMaps / metrics.totalStudents).toFixed(1) 
                    : 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TutorDashboard;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TutorTabs } from "@/components/tutor/TutorTabs";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

const TutorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
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
      await loadStudents(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (tutorId: string) => {
    try {
      const { data: relations, error: relError } = await supabase
        .from("tutor_students")
        .select("student_id")
        .eq("tutor_id", tutorId);

      if (relError) throw relError;

      if (!relations || relations.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = relations.map((r) => r.student_id);

      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, name, email, starter_completed")
        .in("id", studentIds);

      if (profError) throw profError;

      setStudents(profiles || []);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
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
            <h2 className="text-3xl font-bold">Panel de Tutor</h2>
            <p className="text-muted-foreground">Monitorea el progreso y actividad de tus estudiantes</p>
          </div>

          {user && <TutorTabs students={students} tutorId={user.id} />}
        </div>
      </main>
    </div>
  );
};

export default TutorDashboard;
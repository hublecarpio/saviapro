import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User,  UserPlus, Eye, EyeOff, X, MessageSquare, Brain, Calendar } from "lucide-react";
import { StarterProfileEditor } from "@/components/StarterProfileEditor";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface StudentMetrics {
  totalMessages: number;
  totalConversations: number;
  totalMindMaps: number;
  lastActivity: string | null;
}

const Tutor = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentMetrics, setStudentMetrics] = useState<Record<string, StudentMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      // Verificar que sea tutor
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);

      if (!roles?.some((r) => r.role === "tutor")) {
        // Si no es tutor, redirigir según su rol
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
        setStudentMetrics({});
        return;
      }

      const studentIds = relations.map((r) => r.student_id);

      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, name, email, starter_completed")
        .in("id", studentIds);

      if (profError) throw profError;

      setStudents(profiles || []);

      // Cargar métricas para cada estudiante
      const metrics: Record<string, StudentMetrics> = {};
      for (const studentId of studentIds) {
        metrics[studentId] = await loadStudentMetrics(studentId);
      }
      setStudentMetrics(metrics);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
    }
  };

  const loadStudentMetrics = async (studentId: string): Promise<StudentMetrics> => {
    try {
      // Contar mensajes
      const { count: messagesCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", studentId);

      // Contar conversaciones
      const { count: conversationsCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", studentId);

      // Contar mapas mentales
      const { count: mindMapsCount } = await supabase
        .from("mind_maps")
        .select("*", { count: "exact", head: true })
        .eq("user_id", studentId);

      // Obtener última actividad
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        totalMessages: messagesCount || 0,
        totalConversations: conversationsCount || 0,
        totalMindMaps: mindMapsCount || 0,
        lastActivity: lastMessage?.created_at || null,
      };
    } catch (error) {
      console.error("Error loading metrics:", error);
      return {
        totalMessages: 0,
        totalConversations: 0,
        totalMindMaps: 0,
        lastActivity: null,
      };
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentEmail || !newStudentPassword) {
      toast.error("Email y contraseña son obligatorios");
      return;
    }

    if (students.length >= 2) {
      toast.error("Solo puedes crear máximo 2 estudiantes");
      return;
    }

    try {
      setCreating(true);

      // Llamar a la edge function para crear el estudiante
      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          email: newStudentEmail.toLowerCase(),
          password: newStudentPassword,
          name: newStudentName || newStudentEmail.split("@")[0],
        },
      });

      if (error) {
        console.error("Error creating student:", error);
        toast.error(error.message || "Error al crear estudiante");
        return;
      }

      if (!data.success) {
        toast.error(data.error || "Error al crear estudiante");
        return;
      }

      toast.success("Estudiante creado exitosamente");
      setShowCreateDialog(false);
      setNewStudentEmail("");
      setNewStudentName("");
      setNewStudentPassword("");
      await loadStudents(user.id);
    } catch (error) {
      console.error("Error creating student:", error);
      toast.error("Error al crear estudiante");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewStudentEmail("");
    setNewStudentName("");
    setNewStudentPassword("");
    setShowPassword(false);
  };

  const handleViewProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setShowProfileEditor(true);
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
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Mis Estudiantes</h2>
              <p className="text-muted-foreground">{students.length} de 2 estudiantes</p>
            </div>
            {students.length < 2 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Estudiante
              </Button>
            )}
          </div>
          {students.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tienes estudiantes</h3>
                <p className="text-muted-foreground mb-4">Crea tu primer estudiante para comenzar</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Estudiante
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {students.map((student) => (
                <Card key={student.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{student.name}</CardTitle>
                          <CardDescription>{student.email}</CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => handleViewProfile(student.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Perfil
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${student.starter_completed ? "bg-green-500" : "bg-yellow-500"
                            }`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {student.starter_completed ? "Perfil completado" : "Perfil pendiente"}
                        </span>
                      </div>
                      
                      {/* Métricas del estudiante */}
                      {studentMetrics[student.id] && (
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                            <MessageSquare className="h-4 w-4 text-primary mb-1" />
                            <span className="text-xs text-muted-foreground">Mensajes</span>
                            <span className="text-lg font-semibold">{studentMetrics[student.id].totalMessages}</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                            <Brain className="h-4 w-4 text-primary mb-1" />
                            <span className="text-xs text-muted-foreground">Mapas</span>
                            <span className="text-lg font-semibold">{studentMetrics[student.id].totalMindMaps}</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
                            <Calendar className="h-4 w-4 text-primary mb-1" />
                            <span className="text-xs text-muted-foreground">Última actividad</span>
                            <span className="text-xs font-medium">
                              {studentMetrics[student.id].lastActivity
                                ? new Date(studentMetrics[student.id].lastActivity!).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short'
                                  })
                                : "Sin actividad"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog para crear estudiante */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseCreateDialog}>
        <DialogContent
          className="sm:max-w-[425px]"
          onPointerDownOutside={handleCloseCreateDialog}
          onEscapeKeyDown={handleCloseCreateDialog}
        >
          <button
            onClick={handleCloseCreateDialog}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            disabled={creating}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </button>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Estudiante</DialogTitle>
            <DialogDescription>Completa los datos para crear una cuenta de estudiante</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre (opcional)</Label>
              <Input
                id="name"
                placeholder="Nombre del estudiante"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@ejemplo.com"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCloseCreateDialog} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateStudent} disabled={creating}>
              {creating ? "Creando..." : "Crear Estudiante"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor de perfil */}
      {selectedStudentId && (
        <StarterProfileEditor userId={selectedStudentId} open={showProfileEditor} onOpenChange={setShowProfileEditor} />
      )}
    </div>
  );
};

export default Tutor;

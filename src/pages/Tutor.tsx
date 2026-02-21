import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { User,  UserPlus, Eye, X, MessageSquare, Brain, Calendar } from "lucide-react";
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
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentMetrics, setStudentMetrics] = useState<Record<string, StudentMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("tutor-dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tutor_students" },
        () => {
          loadStudents(user.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadStudents(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
      toast({ title: "Error", description: "Error al cargar estudiantes", variant: "destructive" });
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
    if (!newStudentEmail) {
      toast({ title: "Error", description: "Por favor ingresa un correo electrónico", variant: "destructive" });
      return;
    }

    if (students.length >= 2) {
      toast({ title: "Error", description: "Solo puedes crear máximo 2 estudiantes", variant: "destructive" });
      return;
    }

    try {
      setCreating(true);

      const normalizedEmail = newStudentEmail.toLowerCase();
            
      // Check if email already exists in profiles
      const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .limit(1);
          
      if (existingProfile && existingProfile.length > 0) {
          toast({
              title: "Email ya registrado",
              description: "Este usuario ya tiene una cuenta en el sistema",
              variant: "destructive",
          });
          setCreating(false);
          return;
      }

      // Check if email exists in invited_users
      const { data: existingInvite } = await supabase
          .from("invited_users")
          .select("used")
          .eq("email", normalizedEmail)
          .limit(1);

      if (existingInvite && existingInvite.length > 0) {
          if (existingInvite[0].used) {
              toast({
                  title: "Email ya registrado",
                  description: "Este usuario ya ha sido invitado y registrado",
                  variant: "destructive",
              });
          } else {
              toast({
                  title: "Email ya invitado",
                  description: "Este usuario ya tiene una invitación pendiente",
                  variant: "destructive",
              });
          }
          setCreating(false);
          return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({ title: "Error", description: "No hay sesión activa", variant: "destructive" });
        setCreating(false);
        return;
      }

      // Llamar a la edge function para invitar al estudiante
      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          email: newStudentEmail.toLowerCase(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error inviting student:", error);
        let errorMessage = "Error al enviar invitación";
        
        // Intentar extraer el mensaje de error de la respuesta si es un error HTTP de Supabase
        if (error.context && typeof error.context === 'object' && error.context.blob) {
            try {
                // Read the blob text
                const text = await (error.context.blob as Blob).text();
                const parsed = JSON.parse(text);
                if (parsed.error) {
                    errorMessage = parsed.error;
                }
            } catch (e) {
                // If we can't parse it, fallback to default or generic message
                console.error("Failed to parse error blob:", e);
                if (error.message && !error.message.includes("non-2xx")) {
                    errorMessage = error.message;
                }
            }
        } else if (error.message && !error.message.includes("non-2xx")) {
            errorMessage = error.message;
        }

        toast({ title: "Error", description: errorMessage, variant: "destructive" });
        return;
      }

      if (!data.success) {
        toast({ title: "Error", description: data.error || "Error al enviar invitación", variant: "destructive" });
        return;
      }

      toast({ title: "Éxito", description: "Invitación enviada al estudiante" });
      setShowCreateDialog(false);
      setNewStudentEmail("");
      await loadStudents(user.id);
    } catch (error) {
      console.error("Error inviting student:", error);
      toast({ title: "Error", description: "Error al enviar invitación", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewStudentEmail("");
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
                Invitar Estudiante
              </Button>
            )}
          </div>
          {students.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tienes estudiantes</h3>
                <p className="text-muted-foreground mb-4">Invita a tu primer estudiante para comenzar</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invitar Estudiante
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
            <DialogTitle>Invitar Nuevo Estudiante</DialogTitle>
            <DialogDescription>El estudiante recibirá un correo para crear su cuenta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="estudiante@ejemplo.com"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se enviará un correo de invitación para que el estudiante cree su cuenta.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCloseCreateDialog} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateStudent} disabled={creating}>
              {creating ? "Enviando..." : "Enviar Invitación"}
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

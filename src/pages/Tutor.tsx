import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, MessageSquare, UserPlus, LogOut, Eye } from "lucide-react";
import { StarterProfileEditor } from "@/components/StarterProfileEditor";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

const Tutor = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/");
        return;
      }

      // Verificar que sea tutor
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (!roles?.some(r => r.role === "tutor")) {
        // Si no es tutor, redirigir según su rol
        if (roles?.some(r => r.role === "admin")) {
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

      const studentIds = relations.map(r => r.student_id);

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

      // Primero agregar el email a invited_users
      const { error: inviteError } = await supabase
        .from("invited_users")
        .insert({
          email: newStudentEmail.toLowerCase(),
          created_by: user.id,
          used: false
        });

      if (inviteError) {
        if (inviteError.message.includes("duplicate")) {
          toast.error("Este correo ya está invitado");
        } else {
          throw inviteError;
        }
        return;
      }

      // Crear la cuenta del estudiante
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: newStudentEmail,
        password: newStudentPassword,
        options: {
          data: {
            name: newStudentName || newStudentEmail.split('@')[0]
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Asignar rol de estudiante
        await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "student"
          });

        // Relacionar con el tutor
        await supabase
          .from("tutor_students")
          .insert({
            tutor_id: user.id,
            student_id: authData.user.id
          });

        // Marcar email como usado
        await supabase.rpc("mark_invited_user_used", {
          user_email: newStudentEmail.toLowerCase()
        });

        toast.success("Estudiante creado exitosamente");
        setShowCreateDialog(false);
        setNewStudentEmail("");
        setNewStudentName("");
        setNewStudentPassword("");
        await loadStudents(user.id);
      }
    } catch (error) {
      console.error("Error creating student:", error);
      toast.error("Error al crear estudiante");
    } finally {
      setCreating(false);
    }
  };

  const handleViewProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setShowProfileEditor(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Panel de Tutor</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/chat")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Mi Chat
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header con botón crear */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Mis Estudiantes</h2>
              <p className="text-muted-foreground">
                {students.length} de 2 estudiantes
              </p>
            </div>
            {students.length < 2 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Estudiante
              </Button>
            )}
          </div>

          {/* Lista de estudiantes */}
          {students.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tienes estudiantes</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primer estudiante para comenzar
                </p>
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
                      <Button
                        variant="outline"
                        onClick={() => handleViewProfile(student.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Perfil
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        student.starter_completed ? "bg-green-500" : "bg-yellow-500"
                      }`} />
                      <span className="text-sm text-muted-foreground">
                        {student.starter_completed 
                          ? "Perfil completado" 
                          : "Perfil pendiente"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog para crear estudiante */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Estudiante</DialogTitle>
            <DialogDescription>
              Completa los datos para crear una cuenta de estudiante
            </DialogDescription>
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
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
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
        <StarterProfileEditor
          userId={selectedStudentId}
          open={showProfileEditor}
          onOpenChange={setShowProfileEditor}
        />
      )}
    </div>
  );
};

export default Tutor;

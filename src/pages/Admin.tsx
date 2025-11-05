import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus, Settings, LogOut } from "lucide-react";

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/");
        return;
      }

      // Verificar si tiene rol admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roles) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos de administrador",
          variant: "destructive",
        });
        navigate("/chat");
        return;
      }

      setIsAdmin(true);
      await loadMasterPrompt();
      await loadInvitedUsers();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadMasterPrompt = async () => {
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "master_prompt")
      .single();

    if (data) {
      setMasterPrompt(data.value);
    }
  };

  const loadInvitedUsers = async () => {
    const { data } = await supabase
      .from("invited_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setInvitedUsers(data);
    }
  };

  const handleSavePrompt = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("system_config")
        .update({ 
          value: masterPrompt,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq("key", "master_prompt");

      if (error) throw error;

      toast({
        title: "Guardado exitoso",
        description: "El prompt maestro ha sido actualizado",
      });
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el prompt maestro",
        variant: "destructive",
      });
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail || !newUserEmail.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("invited_users")
        .insert({
          email: newUserEmail.toLowerCase(),
          created_by: user?.id
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Email ya invitado",
            description: "Este usuario ya ha sido invitado",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Usuario invitado",
        description: `Se ha enviado una invitación a ${newUserEmail}`,
      });

      setNewUserEmail("");
      await loadInvitedUsers();
    } catch (error) {
      console.error("Error inviting user:", error);
      toast({
        title: "Error",
        description: "No se pudo invitar al usuario",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      const { error } = await supabase
        .from("invited_users")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Invitación eliminada",
        description: "La invitación ha sido eliminada",
      });

      await loadInvitedUsers();
    } catch (error) {
      console.error("Error deleting invite:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la invitación",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Panel de Administración
            </h1>
            <p className="text-muted-foreground mt-2">BIEX 4.0 - Sistema de gestión</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>

        <Tabs defaultValue="prompt" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompt">
              <Settings className="w-4 h-4 mr-2" />
              Prompt Maestro
            </TabsTrigger>
            <TabsTrigger value="users">
              <UserPlus className="w-4 h-4 mr-2" />
              Usuarios Invitados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Prompt Maestro</CardTitle>
                <CardDescription>
                  Este prompt es la base de todas las interacciones del tutor con los estudiantes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="master-prompt">Prompt Maestro</Label>
                  <Textarea
                    id="master-prompt"
                    value={masterPrompt}
                    onChange={(e) => setMasterPrompt(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Ingresa el prompt maestro que guiará las respuestas del tutor..."
                  />
                </div>
                <Button onClick={handleSavePrompt} className="w-full">
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invitar Nuevo Usuario</CardTitle>
                <CardDescription>
                  Agrega el email del estudiante que podrá registrarse en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="estudiante@ejemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleInviteUser()}
                  />
                  <Button onClick={handleInviteUser}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invitar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usuarios Invitados</CardTitle>
                <CardDescription>
                  Lista de estudiantes que pueden registrarse en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invitedUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay usuarios invitados aún
                    </p>
                  ) : (
                    invitedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{user.email}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.used ? (
                              <span className="text-green-600">
                                ✓ Usado el {new Date(user.used_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span>Pendiente de registro</span>
                            )}
                          </p>
                        </div>
                        {!user.used && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInvite(user.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

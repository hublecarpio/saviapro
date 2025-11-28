import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import { Trash2, UserPlus } from "lucide-react";
import { Loading } from "@/components/ui/loading";
const RegisterUser = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
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
            await loadInvitedUsers();
        } catch (error) {
            console.error("Error checking admin status:", error);
            navigate("/");
        } finally {
            setLoading(false);
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

            // Insertar invitación y obtener el token generado
            const { data: inviteData, error } = await supabase
                .from("invited_users")
                .insert({
                    email: newUserEmail.toLowerCase(),
                    created_by: user?.id
                })
                .select("token")
                .single();

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

            // Construir URL de registro con el token
            const registerUrl = `${window.location.origin}/register/${inviteData.token}`;

            // Llamar a la webhook con el email y la URL de registro
            try {
                await fetch("https://webhook.hubleconsulting.com/webhook/970fcfa4-6000-4858-bb42-14a592CREA", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: newUserEmail.toLowerCase(),
                        register_url: registerUrl,
                    }),
                });
            } catch (webhookError) {
                console.error("Error calling webhook:", webhookError);
                // No detenemos el proceso si falla el webhook
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

    if (loading) {
        return (
                      <Loading />
          
        );
    }

    if (!isAdmin) {
        return null;
    }
    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
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

            </div>
        </>
    );
};

export default RegisterUser;

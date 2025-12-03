import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, GraduationCap } from "lucide-react";
import { Loading } from "@/components/ui/loading";

const RegisterUser = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
    const [tutors, setTutors] = useState<any[]>([]);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [inviteType, setInviteType] = useState<"tutor" | "student">("tutor");
    const [selectedTutorId, setSelectedTutorId] = useState<string>("");
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
            await Promise.all([loadInvitedUsers(), loadTutors()]);
        } catch (error) {
            console.error("Error checking admin status:", error);
            navigate("/");
        } finally {
            setLoading(false);
        }
    };

    const loadTutors = async () => {
        try {
            const { data: tutorRoles, error: rolesError } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "tutor");

            if (rolesError) throw rolesError;

            if (tutorRoles && tutorRoles.length > 0) {
                const tutorIds = tutorRoles.map(r => r.user_id);
                const { data: tutorProfiles, error: profilesError } = await supabase
                    .from("profiles")
                    .select("*")
                    .in("id", tutorIds);

                if (profilesError) throw profilesError;
                setTutors(tutorProfiles || []);
            }
        } catch (error) {
            console.error("Error loading tutors:", error);
        }
    };

    const loadInvitedUsers = async () => {
        const { data } = await supabase
            .from("invited_users")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) {
            // Enriquecer con info del tipo de invitación
            const enrichedData = await Promise.all(
                data.map(async (invite) => {
                    if (invite.created_by) {
                        // Verificar si el creador es admin o tutor
                        const { data: creatorRole } = await supabase
                            .from("user_roles")
                            .select("role")
                            .eq("user_id", invite.created_by)
                            .maybeSingle();

                        const { data: creatorProfile } = await supabase
                            .from("profiles")
                            .select("name, email")
                            .eq("id", invite.created_by)
                            .maybeSingle();

                        return {
                            ...invite,
                            inviteType: creatorRole?.role === "admin" ? "tutor" : "student",
                            tutorName: creatorRole?.role === "tutor" ? (creatorProfile?.name || creatorProfile?.email) : null
                        };
                    }
                    return { ...invite, inviteType: "tutor", tutorName: null };
                })
            );
            setInvitedUsers(enrichedData);
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

        if (inviteType === "student" && !selectedTutorId) {
            toast({
                title: "Tutor requerido",
                description: "Debes seleccionar un tutor para el estudiante",
                variant: "destructive",
            });
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Si es estudiante, el created_by es el tutor seleccionado
            // Si es tutor, el created_by es el admin actual
            const createdBy = inviteType === "student" ? selectedTutorId : user?.id;

            // Insertar invitación y obtener el token generado
            const { data: inviteData, error } = await supabase
                .from("invited_users")
                .insert({
                    email: newUserEmail.toLowerCase(),
                    created_by: createdBy
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

            // Construir URL de registro con el token usando el dominio personalizado
            const registerUrl = `https://app.biexedu.com/register/${inviteData.token}`;

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
            }

            toast({
                title: inviteType === "tutor" ? "Tutor invitado" : "Estudiante invitado",
                description: `Se ha enviado una invitación a ${newUserEmail}`,
            });

            setNewUserEmail("");
            setSelectedTutorId("");
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
        return <Loading />;
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
                            Invita tutores o estudiantes al sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <Label>Tipo de usuario</Label>
                            <RadioGroup
                                value={inviteType}
                                onValueChange={(value) => {
                                    setInviteType(value as "tutor" | "student");
                                    setSelectedTutorId("");
                                }}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="tutor" id="tutor" />
                                    <Label htmlFor="tutor" className="cursor-pointer">Tutor</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="student" id="student" />
                                    <Label htmlFor="student" className="cursor-pointer">Estudiante</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {inviteType === "student" && (
                            <div className="space-y-2">
                                <Label>Asignar a tutor</Label>
                                <Select value={selectedTutorId} onValueChange={setSelectedTutorId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un tutor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tutors.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                No hay tutores disponibles
                                            </SelectItem>
                                        ) : (
                                            tutors.map((tutor) => (
                                                <SelectItem key={tutor.id} value={tutor.id}>
                                                    <div className="flex items-center gap-2">
                                                        <GraduationCap className="w-4 h-4" />
                                                        {tutor.name || tutor.email}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder={inviteType === "tutor" ? "tutor@ejemplo.com" : "estudiante@ejemplo.com"}
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleInviteUser()}
                            />
                            <Button onClick={handleInviteUser}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Invitar {inviteType === "tutor" ? "Tutor" : "Estudiante"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Usuarios Invitados</CardTitle>
                        <CardDescription>
                            Lista de tutores y estudiantes que pueden registrarse
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
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{user.email}</p>
                                                <Badge variant={user.inviteType === "tutor" ? "secondary" : "outline"}>
                                                    {user.inviteType === "tutor" ? "Tutor" : "Estudiante"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {user.used ? (
                                                    <span className="text-green-600">
                                                        ✓ Usado el {new Date(user.used_at).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span>
                                                        Pendiente de registro
                                                        {user.tutorName && ` • Tutor: ${user.tutorName}`}
                                                    </span>
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

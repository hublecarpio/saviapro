import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
const ListUser = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
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
            await loadRegisteredUsers();
        } catch (error) {
            console.error("Error checking admin status:", error);
            navigate("/");
        } finally {
            setLoading(false);
        }
    };





    const loadRegisteredUsers = async () => {
        try {
            // Obtener todos los perfiles
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false });

            if (profilesError) throw profilesError;

            // Obtener todos los roles
            const { data: roles, error: rolesError } = await supabase
                .from("user_roles")
                .select("*");

            if (rolesError) throw rolesError;

            // Combinar la información
            const usersWithRoles = profiles?.map(profile => {
                const userRoles = roles?.filter(r => r.user_id === profile.id) || [];
                return {
                    ...profile,
                    roles: userRoles.map(r => r.role)
                };
            }) || [];

            setRegisteredUsers(usersWithRoles);
        } catch (error) {
            console.error("Error loading registered users:", error);
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
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Usuarios Registrados</CardTitle>
                        <CardDescription>
                            Todos los usuarios que tienen cuenta en el sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {registeredUsers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No hay usuarios registrados aún
                            </p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Roles</TableHead>
                                            <TableHead>Starter Completado</TableHead>
                                            <TableHead>Fecha de Registro</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registeredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">
                                                    {user.name || "Sin nombre"}
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {user.roles.length === 0 ? (
                                                            <Badge variant="outline">Sin rol</Badge>
                                                        ) : (
                                                            user.roles.map((role: string) => (
                                                                <Badge
                                                                    key={role}
                                                                    variant={
                                                                        role === "admin" ? "default" :
                                                                            role === "tutor" ? "secondary" :
                                                                                "outline"
                                                                    }
                                                                >
                                                                    {role}
                                                                </Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {user.starter_completed ? (
                                                        <Badge variant="default" className="bg-green-600">
                                                            ✓ Completado
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">Pendiente</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(user.created_at).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ListUser;

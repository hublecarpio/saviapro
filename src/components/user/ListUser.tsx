import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ListUser = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [confirmStep, setConfirmStep] = useState(0); // 0: closed, 1: first confirm, 2: second confirm
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        checkAdminStatus();

        const channel = supabase
            .channel("list-users-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "profiles" },
                () => {
                    loadRegisteredUsers();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "user_roles" },
                () => {
                    loadRegisteredUsers();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "invited_users" },
                () => {
                    loadRegisteredUsers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false });

            if (profilesError) throw profilesError;

            const { data: roles, error: rolesError } = await supabase
                .from("user_roles")
                .select("*");

            if (rolesError) throw rolesError;

            // Obtener invitaciones para saber quién invitó a quién
            const { data: invites, error: invitesError } = await supabase
                .from("invited_users")
                .select("email, created_by");

            if (invitesError) throw invitesError;

            const usersWithRoles = profiles?.map(profile => {
                const userRoles = roles?.filter(r => r.user_id === profile.id) || [];
                // Buscar quién invitó a este usuario
                const invite = invites?.find(i => i.email?.toLowerCase() === profile.email?.toLowerCase());
                const invitedBy = invite?.created_by ? profiles?.find(p => p.id === invite.created_by) : null;
                
                return {
                    ...profile,
                    roles: userRoles.map(r => r.role),
                    invitedBy: invitedBy ? { name: invitedBy.name, email: invitedBy.email } : null
                };
            }) || [];

            setRegisteredUsers(usersWithRoles);
        } catch (error) {
            console.error("Error loading registered users:", error);
        }
    };

    const handleDeleteClick = (user: any) => {
        console.log("Delete clicked for user:", user.email);
        setUserToDelete(user);
        setConfirmStep(1);
    };

    const handleFirstConfirm = () => {
        console.log("First confirm clicked, moving to step 2");
        setConfirmStep(2);
    };

    const handleFinalDelete = async () => {
        if (!userToDelete) return;

        setDeleting(true);
        try {
            const { data, error } = await supabase.functions.invoke('delete-user', {
                body: { userId: userToDelete.id }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast({
                title: "Usuario eliminado",
                description: `${userToDelete.email} ha sido eliminado completamente del sistema`,
            });

            await loadRegisteredUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo eliminar el usuario",
                variant: "destructive",
            });
        } finally {
            setDeleting(false);
            setUserToDelete(null);
            setConfirmStep(0);
        }
    };

    const handleCancel = () => {
        setUserToDelete(null);
        setConfirmStep(0);
    };

    if (loading) {
        return <Loading />;
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
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Roles</TableHead>
                                            <TableHead className="hidden md:table-cell">Invitado por</TableHead>
                                            <TableHead className="hidden md:table-cell">Starter</TableHead>
                                            <TableHead className="hidden md:table-cell">Fecha</TableHead>
                                            <TableHead className="w-[80px]">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registeredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium max-w-[120px]">
                                                    <p className="truncate">{user.name || "Sin nombre"}</p>
                                                </TableCell>
                                                <TableCell className="max-w-[150px]">
                                                    <p className="truncate">{user.email}</p>
                                                </TableCell>
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
                                                <TableCell className="hidden md:table-cell">
                                                    {user.invitedBy ? (
                                                        <span className="text-sm">
                                                            {user.invitedBy.name || user.invitedBy.email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {user.starter_completed ? (
                                                        <Badge variant="default" className="bg-green-600">
                                                            ✓
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">-</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                                                    {new Date(user.created_at).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    {!user.roles.includes("admin") && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteClick(user)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
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

            {/* Primera confirmación */}
            <AlertDialog open={confirmStep === 1}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar a <strong>{userToDelete?.email}</strong>.
                            Esta acción eliminará todos sus datos del sistema.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
                        <Button
                            onClick={handleFirstConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Continuar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Segunda confirmación */}
            <AlertDialog open={confirmStep === 2}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">⚠️ Confirmar eliminación permanente</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>Esta acción es irreversible.</strong><br /><br />
                            Se eliminarán permanentemente:<br />
                            • Perfil y datos de <strong>{userToDelete?.email}</strong><br />
                            • Conversaciones y mensajes<br />
                            • Fichas didácticas y mapas mentales<br />
                            • Documentos subidos<br /><br />
                            ¿Estás completamente seguro?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
                        <Button
                            onClick={handleFinalDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Eliminando..." : "Eliminar permanentemente"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default ListUser;

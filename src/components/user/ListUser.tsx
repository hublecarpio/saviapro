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

    const handleDeleteClick = (user: any) => {
        setUserToDelete(user);
        setConfirmStep(1);
    };

    const handleFirstConfirm = () => {
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
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Roles</TableHead>
                                            <TableHead>Starter</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="w-[80px]">Acciones</TableHead>
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
                                                            ✓
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">-</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
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
            <AlertDialog open={confirmStep === 1} onOpenChange={(open) => !open && handleCancel()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar a <strong>{userToDelete?.email}</strong>.
                            Esta acción eliminará todos sus datos del sistema.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleFirstConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Segunda confirmación */}
            <AlertDialog open={confirmStep === 2} onOpenChange={(open) => !open && handleCancel()}>
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
                        <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleFinalDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Eliminando..." : "Eliminar permanentemente"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default ListUser;

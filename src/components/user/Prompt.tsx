import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { FileUploader } from "../FileUploader";
import { DocumentsList } from "../DocumentsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
const Prompt = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [masterPrompt, setMasterPrompt] = useState("");
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
            .maybeSingle();

        if (data) {
            setMasterPrompt(data.value);
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
            {loading ? '' : <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
                <Tabs defaultValue="prompt">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="prompt">Prompt maestro</TabsTrigger>
                        <TabsTrigger value="files">Documentos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="prompt">
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
                                        rows={16}
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
                    <TabsContent value="files">
                        <div className="space-y-4">
                            <Card>
                                <CardContent>
                                    <div className="pt-6">
                                        <Label className="font-semibold text-lg">Subir Archivos (.pdf / .docx) o Texto</Label>
                                        <FileUploader />
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <DocumentsList />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>}
        </>
    );
};

export default Prompt;

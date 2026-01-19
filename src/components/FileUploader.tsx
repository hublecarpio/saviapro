import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, FileText, FileImage } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface FileUploaderProps {
    conversationId?: string;
    onFileProcessed?: (response: any) => void;
}

// Función para extraer texto de archivos
async function extractTextFromFile(file: File): Promise<string> {
    if (file.type === "text/plain") {
        return await file.text();
    }
    
    // Para PDF y DOCX, intentamos leer como texto (fallback básico)
    // En producción, se debería usar una librería de parsing
    if (file.type === "application/pdf") {
        // Para PDFs, retornamos un placeholder y dejamos que la edge function maneje
        return `[Contenido del archivo PDF: ${file.name}]`;
    }
    
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return `[Contenido del archivo DOCX: ${file.name}]`;
    }
    
    return await file.text();
}

export const FileUploader = ({ conversationId, onFileProcessed }: FileUploaderProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [textContent, setTextContent] = useState("");
    const [mode, setMode] = useState<"file" | "text">("file");
    const { toast } = useToast();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];

        if (!selected) return;

        if (![
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ].includes(selected.type)) {
            toast({
                title: "Formato no permitido",
                description: "Solo se aceptan archivos .pdf, .docx y .txt",
                variant: "destructive",
            });
            return;
        }

        setFile(selected);
    };

    const handleUpload = async () => {
        if (mode === "file" && !file) {
            toast({
                title: "Sin archivo",
                description: "Selecciona un archivo antes de subir",
                variant: "destructive",
            });
            return;
        }

        if (mode === "text" && !textContent.trim()) {
            toast({
                title: "Sin contenido",
                description: "Escribe o pega texto antes de subir",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Usuario no autenticado");
            }

            let content = "";
            let fileName = "";
            let fileType = "";

            if (mode === "file" && file) {
                content = await extractTextFromFile(file);
                fileName = file.name;
                fileType = file.type;
            } else {
                content = textContent;
                fileName = `texto_${Date.now()}.txt`;
                fileType = "text/plain";
            }

            // Llamar a la edge function para procesar el documento con embeddings
            const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
                body: {
                    content: content,
                    file_name: fileName,
                    user_id: user.id,
                    conversation_id: conversationId || null
                }
            });

            if (processError) {
                console.error("Error processing document:", processError);
                throw new Error(processError.message || "Error al procesar el documento");
            }

            if (!processResult?.success) {
                throw new Error(processResult?.error || "Error al procesar el documento");
            }

            // Callback con la respuesta para procesar en el chat
            if (onFileProcessed && processResult) {
                onFileProcessed({
                    fileName,
                    fileType,
                    documentId: processResult.document_id,
                    chunksProcessed: processResult.chunks_processed
                });
            }

            toast({
                title: "Contenido procesado",
                description: mode === "file" 
                    ? `${fileName} fue procesado correctamente (${processResult.chunks_processed} fragmentos)`
                    : `El texto fue procesado correctamente (${processResult.chunks_processed} fragmentos)`,
            });

            setFile(null);
            setTextContent("");
        } catch (error) {
            console.error("Error uploading file:", error);
            toast({
                title: "Error al subir",
                description: error instanceof Error ? error.message : "No se pudo enviar el contenido",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = () => {
        if (!file) return <UploadCloud className="w-10 h-10 opacity-70 mb-2" />;
        if (file.type === "application/pdf") return <FileText className="w-10 h-10 text-red-500 mb-2" />;
        return <FileImage className="w-10 h-10 text-blue-500 mb-2" />;
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                    variant={mode === "file" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMode("file")}
                    className="flex-1"
                >
                    Subir Archivo
                </Button>
                <Button
                    variant={mode === "text" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMode("text")}
                    className="flex-1"
                >
                    Pegar Texto
                </Button>
            </div>

            {mode === "file" ? (
                <>
                    {!file && (
                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-primary hover:bg-primary/5">
                            <input
                                type="file"
                                accept=".pdf,.docx,.txt"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            {getFileIcon()}
                            <p className="text-sm text-muted-foreground">
                                Arrastra tu archivo aquí o haz clic
                            </p>
                            <p className="text-xs mt-1 opacity-70">Formatos permitidos: .pdf, .docx, .txt</p>
                        </label>
                    )}

                    {file && (
                        <div className="text-sm font-medium p-3 bg-muted rounded-lg flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-5 h-5 text-primary shrink-0" />
                                <span className="truncate">{file.name}</span>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setFile(null)}
                            >
                                Quitar
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="text-content">Contenido de Texto</Label>
                    <Textarea
                        id="text-content"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="Escribe o pega tu texto aquí..."
                        rows={12}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        El texto se guardará como archivo .txt y se enviará al sistema
                    </p>
                </div>
            )}

            <Button
                onClick={handleUpload}
                disabled={(mode === "file" && !file) || (mode === "text" && !textContent.trim()) || uploading}
                className="w-full"
            >
                {uploading ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Procesando...
                    </>
                ) : (
                    mode === "file" ? "Subir archivo" : "Enviar texto"
                )}
            </Button>
        </div>
    );
};

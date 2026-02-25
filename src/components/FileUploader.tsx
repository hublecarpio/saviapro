import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, FileText, FileImage } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface FileUploaderProps {
    conversationId?: string;
    onFileProcessed?: (response: any) => void;
}

// Función para extraer texto de archivos usando AI para PDFs
async function extractTextFromFile(file: File, userId?: string): Promise<{ text: string, document_id?: string, content_url?: string }> {
    if (file.type === "text/plain") {
        return { text: await file.text() };
    }
    
    // Para PDF y DOCX, usar la edge function con AI para extracción real
    if (file.type === "application/pdf" || 
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_name', file.name);
            if (userId) formData.append('user_id', userId);
            
            const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
                body: formData,
            });
            
            if (error) {
                console.error("Error extracting PDF text:", error);
                return { text: `[Error al extraer texto del archivo: ${file.name}]` };
            }
            
            if (data?.success && data?.extracted_text) {
                console.log(`Extracted ${data.text_length || data.extracted_text.length} characters from ${file.name} (method: ${data.extraction_method})`);
                return { 
                    text: data.extracted_text, 
                    document_id: data.document_id, 
                    content_url: data.content_url 
                };
            }
            
            return { text: `[No se pudo extraer texto del archivo: ${file.name}]` };
        } catch (err) {
            console.error("PDF extraction error:", err);
            return { text: `[Error de extracción: ${file.name}]` };
        }
    }
    
    return { text: await file.text() };
}

export const FileUploader = ({ conversationId, onFileProcessed }: FileUploaderProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [textContent, setTextContent] = useState("");
    const [mode, setMode] = useState<"file" | "text">("file");
    const [isDragging, setIsDragging] = useState(false);
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

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const selected = e.dataTransfer.files?.[0];

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
        try {
            if (!file && !textContent.trim()) {
                toast({
                    title: "Error",
                    description: "Por favor selecciona un archivo o escribe texto",
                    variant: "destructive",
                });
                return;
            }

            setUploading(true);
            setUploadStage("Iniciando...");
            setUploadProgress(0);

            setUploadStage("Autenticando...");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Usuario no autenticado");
            }

            let content = "";
            let generatedDocumentId: string | undefined = undefined;
            let extractedContentUrl: string | undefined = undefined;
            let originalFileName = "";
            let fileType = "";

            if (mode === "file" && file) {
                // Simulación de logs de procesamiento de IA para dar feedback al usuario
                const simulatedLogs = [
                    "Iniciando motor de IA...",
                    "Analizando estructura y metadatos del documento...",
                    "Identificando bloques de texto y tablas...",
                    "Aplicando OCR avanzado a elementos complejos...",
                    "Extrayendo y consolidando la información...",
                    "Optimizando resultados para mejor comprensión...",
                    "Finalizando extracción (esto puede tomar unos segundos)..."
                ];
                
                setUploadStage(simulatedLogs[0]);
                setUploadProgress(5); // Start with a small progress
                
                const logInterval = setInterval(() => {
                    setUploadProgress((prev) => {
                        let next = prev;
                        if (prev < 30) next = prev + Math.random() * 6;
                        else if (prev < 60) next = prev + Math.random() * 3;
                        else if (prev < 85) next = prev + Math.random() * 1.5;
                        else if (prev < 98) next = prev + Math.random() * 0.4;
                        else next = prev;
                        
                        // Update text based on progress
                        if (next < 15) setUploadStage(simulatedLogs[0]);
                        else if (next < 30) setUploadStage(simulatedLogs[1]);
                        else if (next < 45) setUploadStage(simulatedLogs[2]);
                        else if (next < 60) setUploadStage(simulatedLogs[3]);
                        else if (next < 75) setUploadStage(simulatedLogs[4]);
                        else if (next < 90) setUploadStage(simulatedLogs[5]);
                        else setUploadStage(simulatedLogs[6]);
                        
                        return next;
                    });
                }, 400); // More frequent updates for a smooth progress bar

                try {
                    const extractedTextResult = await extractTextFromFile(file, user.id);
                    clearInterval(logInterval);
                    setUploadProgress(99);
                    content = extractedTextResult.text;
                    generatedDocumentId = extractedTextResult.document_id;
                    extractedContentUrl = extractedTextResult.content_url;
                    originalFileName = file.name;
                    fileType = file.type;
                } catch (error) {
                    clearInterval(logInterval);
                    throw error;
                }
            } else {
                content = textContent;
                originalFileName = `texto_${Date.now()}.txt`;
                fileType = "text/plain";
            }
            
            // Sanitize file name
            const fileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');

            if (mode === "file" && file) {
                setUploadStage("Subiendo archivo original...");
                const s3FormData = new FormData();
                s3FormData.append('file', file);
                s3FormData.append('userId', user.id);
                s3FormData.append('conversationId', conversationId || 'global_prompt');

                const s3Response = await supabase.functions.invoke('upload-to-s3', {
                    body: s3FormData
                });

                if (s3Response.error) {
                    console.warn("S3 upload error:", s3Response.error);
                    // Decide whether to fail the whole process or continue...
                    // Here we continue for robustness as the original behavior didn't have S3 upload at all
                }
            }

            setUploadStage("Generando embeddings...");
            // Llamar a la edge function para procesar el documento con embeddings
            const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
                body: {
                    content: content,
                    file_name: fileName,
                    user_id: user.id,
                    conversation_id: conversationId || null,
                    file_type: fileType,
                    upload_mode: mode,
                    document_id: generatedDocumentId,
                    content_url: extractedContentUrl
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
            setUploadStage("");
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
                        <label 
                            className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "hover:border-primary hover:bg-primary/5 border-border"}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
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

            {uploading && (
                <div className="space-y-2 mb-2">
                    <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                        <span className="truncate mr-4">{uploadStage || (mode === "file" ? "Procesando documento..." : "Procesando texto...")}</span>
                        <span className="shrink-0">{Math.min(Math.round(uploadProgress), 100)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2 w-full transition-all duration-300" />
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
                        {mode === "file" ? "Procesando..." : "Enviando..."}
                    </>
                ) : (
                    mode === "file" ? "Subir archivo" : "Enviar texto"
                )}
            </Button>
        </div>
    );
};

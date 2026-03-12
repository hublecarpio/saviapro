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
    uploadTarget: "educational" | "pedagogical";
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

export const FileUploader = ({ conversationId, onFileProcessed, uploadTarget }: FileUploaderProps) => {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [textContent, setTextContent] = useState("");
    const [mode, setMode] = useState<"file" | "text">("file");
    const [isDragging, setIsDragging] = useState(false);
    const { toast } = useToast();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);

        if (selectedFiles.length === 0) return;

        const validFiles = selectedFiles.filter(f => [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ].includes(f.type));

        if (validFiles.length !== selectedFiles.length) {
            toast({
                title: "Algunos formatos no permitidos",
                description: "Solo se aceptan archivos .pdf, .docx y .txt. Se han ignorado los archivos no compatibles.",
                variant: "destructive",
            });
        }

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
        }
        
        e.target.value = "";
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
        const droppedFiles = Array.from(e.dataTransfer.files || []);

        if (droppedFiles.length === 0) return;

        const validFiles = droppedFiles.filter(f => [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ].includes(f.type));

        if (validFiles.length !== droppedFiles.length) {
            toast({
                title: "Algunos formatos no permitidos",
                description: "Solo se aceptan archivos .pdf, .docx y .txt. Se han ignorado los archivos no compatibles.",
                variant: "destructive",
            });
        }

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
        }
    };
    
    const removeFile = (indexToRemove: number) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleUpload = async () => {
        console.log(`[FileUploader] handleUpload started. mode=${mode}, uploadTarget=${uploadTarget}, files=${files.length}`);

        if (mode === "file" && files.length === 0) {
            toast({
                title: "Sin archivos",
                description: "Selecciona al menos un archivo antes de subir",
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
            setUploading(true);
            setUploadStage("Iniciando...");
            setUploadProgress(0);

            setUploadStage("Autenticando...");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Usuario no autenticado");
            }

            if (mode === "file" && files.length > 0) {
                let successCount = 0;
                let totalProcessedChunks = 0;
                
                for (let i = 0; i < files.length; i++) {
                    const currentFile = files[i];
                    
                    const simulatedLogs = [
                        `(${i+1}/${files.length}) Iniciando motor de IA para ${currentFile.name}...`,
                        `(${i+1}/${files.length}) Analizando estructura y metadatos...`,
                        `(${i+1}/${files.length}) Identificando bloques de texto y tablas...`,
                        `(${i+1}/${files.length}) Aplicando OCR avanzado...`,
                        `(${i+1}/${files.length}) Extrayendo información...`,
                        `(${i+1}/${files.length}) Optimizando resultados...`,
                        `(${i+1}/${files.length}) Finalizando extracción...`
                    ];
                    
                    setUploadStage(simulatedLogs[0]);
                    setUploadProgress(5);
                    
                    const logInterval = setInterval(() => {
                        setUploadProgress((prev) => {
                            let next = prev;
                            if (prev < 30) next = prev + Math.random() * 6;
                            else if (prev < 60) next = prev + Math.random() * 3;
                            else if (prev < 85) next = prev + Math.random() * 1.5;
                            else if (prev < 98) next = prev + Math.random() * 0.4;
                            else next = prev;
                            
                            if (next < 15) setUploadStage(simulatedLogs[0]);
                            else if (next < 30) setUploadStage(simulatedLogs[1]);
                            else if (next < 45) setUploadStage(simulatedLogs[2]);
                            else if (next < 60) setUploadStage(simulatedLogs[3]);
                            else if (next < 75) setUploadStage(simulatedLogs[4]);
                            else if (next < 90) setUploadStage(simulatedLogs[5]);
                            else setUploadStage(simulatedLogs[6]);
                            
                            return next;
                        });
                    }, 400);

                    try {
                        const extractedTextResult = await extractTextFromFile(currentFile, user.id);
                        clearInterval(logInterval);
                        setUploadProgress(99);
                        const content = extractedTextResult.text;
                        const generatedDocumentId = extractedTextResult.document_id;
                        const extractedContentUrl = extractedTextResult.content_url;
                        const originalFileName = currentFile.name;
                        const fileType = currentFile.type;
                        
                        const fileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');

                        if (uploadTarget === "pedagogical") {
                            console.log(`[FileUploader] uploadTarget=${uploadTarget}, calling process-pedagogical-doc for ${fileName}`);
                            setUploadStage(`(${i+1}/${files.length}) Guardando documento pedagógico...`);

                            const { data: processResult, error: processError } = await supabase.functions.invoke('process-pedagogical-doc', {
                                body: {
                                    content: content,
                                    file_name: originalFileName,
                                    user_id: user.id,
                                    file_type: fileType,
                                    content_url: extractedContentUrl
                                }
                            });

                            console.log(`[FileUploader] process-pedagogical-doc response:`, { processResult, processError });

                            if (processError || !processResult?.success) {
                                console.error(`[FileUploader] ❌ Error processing pedagogical doc ${fileName}:`, processError || processResult?.error);
                                toast({
                                    title: "Error procesando documento",
                                    description: `Hubo un error al procesar ${fileName}`,
                                    variant: "destructive",
                                });
                                continue;
                            }

                            if (onFileProcessed && processResult) {
                                onFileProcessed({
                                    fileName,
                                    fileType,
                                    documentId: processResult.document_id,
                                    chunksProcessed: 0
                                });
                            }

                            successCount++;
                        } else {
                            setUploadStage(`(${i+1}/${files.length}) Subiendo archivo original...`);
                            const s3FormData = new FormData();
                            s3FormData.append('file', currentFile);
                            s3FormData.append('userId', user.id);
                            s3FormData.append('conversationId', conversationId || 'global_prompt');

                            const s3Response = await supabase.functions.invoke('upload-to-s3', {
                                body: s3FormData
                            });

                            if (s3Response.error) {
                                console.warn("S3 upload error:", s3Response.error);
                            }

                            setUploadStage(`(${i+1}/${files.length}) Generando embeddings...`);
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

                            if (processError || !processResult?.success) {
                                console.error(`Error processing document ${fileName}:`, processError || processResult?.error);
                                toast({
                                    title: "Error procesando archivo",
                                    description: `Hubo un error al procesar ${fileName}`,
                                    variant: "destructive",
                                });
                                continue;
                            }

                            if (onFileProcessed && processResult) {
                                onFileProcessed({
                                    fileName,
                                    fileType,
                                    documentId: processResult.document_id,
                                    chunksProcessed: processResult.chunks_processed
                                });
                            }

                            successCount++;
                            totalProcessedChunks += (processResult.chunks_processed || 0);
                        }

                    } catch (error) {
                        clearInterval(logInterval);
                        console.error(`Error uploading file ${currentFile.name}:`, error);
                        toast({
                            title: "Error procesando archivo",
                            description: `Hubo un error al procesar ${currentFile.name}`,
                            variant: "destructive",
                        });
                    }
                }

                if (successCount > 0) {
                    toast({
                        title: "Archivos procesados",
                        description: uploadTarget === "pedagogical"
                            ? `Se procesaron correctamente ${successCount} de ${files.length} archivos como documentos pedagógicos.`
                            : `Se procesaron correctamente ${successCount} de ${files.length} archivos (${totalProcessedChunks} fragmentos).`,
                    });
                    setFiles([]);
                }
            } else if (mode === "text") {
                const content = textContent;
                const originalFileName = `texto_${Date.now()}.txt`;
                const fileType = "text/plain";
                const fileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');

                if (uploadTarget === "pedagogical") {
                    console.log(`[FileUploader] uploadTarget=${uploadTarget}, calling process-pedagogical-doc for text mode`);
                    setUploadStage("Guardando documento pedagógico...");

                    const { data: processResult, error: processError } = await supabase.functions.invoke('process-pedagogical-doc', {
                        body: {
                            content: content,
                            file_name: originalFileName,
                            user_id: user.id,
                            file_type: fileType,
                            content_url: undefined
                        }
                    });

                    console.log(`[FileUploader] process-pedagogical-doc response:`, { processResult, processError });

                    if (processError) {
                        throw new Error(processError.message || "Error al procesar el documento pedagógico");
                    }
                    if (!processResult?.success) {
                        throw new Error(processResult?.error || "Error al procesar el documento pedagógico");
                    }

                    if (onFileProcessed && processResult) {
                        onFileProcessed({
                            fileName,
                            fileType,
                            documentId: processResult.document_id,
                            chunksProcessed: 0
                        });
                    }

                    toast({
                        title: "Contenido procesado",
                        description: "Documento pedagógico procesado correctamente",
                    });

                    setTextContent("");
                } else {
                    setUploadStage("Generando embeddings...");
                    const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
                        body: {
                            content: content,
                            file_name: fileName,
                            user_id: user.id,
                            conversation_id: conversationId || null,
                            file_type: fileType,
                            upload_mode: mode,
                            document_id: undefined,
                            content_url: undefined
                        }
                    });

                    if (processError) {
                        throw new Error(processError.message || "Error al procesar el documento");
                    }

                    if (!processResult?.success) {
                        throw new Error(processResult?.error || "Error al procesar el documento");
                    }

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
                        description: `El texto fue procesado correctamente (${processResult.chunks_processed} fragmentos)`,
                    });

                    setTextContent("");
                }
            }
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
            setUploadProgress(0);
        }
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
                    Subir Archivos
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
                    <label 
                        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "hover:border-primary hover:bg-primary/5 border-border"}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.docx,.txt"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <UploadCloud className="w-10 h-10 opacity-70 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            Arrastra tus archivos aquí o haz clic
                        </p>
                        <p className="text-xs mt-1 opacity-70">Formatos permitidos: .pdf, .docx, .txt</p>
                    </label>

                    {files.length > 0 && (
                        <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                            {files.map((file, index) => (
                                <div key={index} className="text-sm font-medium p-3 bg-muted rounded-lg flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                        {file.type === "application/pdf" ? (
                                            <FileText className="w-5 h-5 text-red-500 shrink-0" />
                                        ) : (
                                            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                        )}
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => removeFile(index)}
                                    >
                                        Quitar
                                    </Button>
                                </div>
                            ))}
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
                        <span className="truncate mr-4">{uploadStage || (mode === "file" ? "Procesando documentos..." : "Procesando texto...")}</span>
                        <span className="shrink-0">{Math.min(Math.round(uploadProgress), 100)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2 w-full transition-all duration-300" />
                </div>
            )}

            <Button
                onClick={handleUpload}
                disabled={(mode === "file" && files.length === 0) || (mode === "text" && !textContent.trim()) || uploading}
                className="w-full"
            >
                {uploading ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        {mode === "file" ? "Procesando..." : "Enviando..."}
                    </>
                ) : (
                    mode === "file" ? `Subir ${files.length > 0 ? files.length : ''} ${files.length === 1 ? 'archivo' : 'archivos'}`.trim() : "Enviar texto"
                )}
            </Button>
        </div>
    );
};

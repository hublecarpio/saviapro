import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const FileUploader = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [textContent, setTextContent] = useState("");
    const [mode, setMode] = useState<"file" | "text">("file");
    const { toast } = useToast();

    const handleFileSelect = (e) => {
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
            const formData = new FormData();
            let fileType = "";
            let fileName = "";

            if (mode === "file") {
                formData.append("data0", file);
                fileType = file.type;
                fileName = file.name;
            } else {
                // Convertir texto a archivo .txt
                const blob = new Blob([textContent], { type: "text/plain" });
                const textFile = new File([blob], `texto_${Date.now()}.txt`, { type: "text/plain" });
                formData.append("data0", textFile);
                fileType = "text/plain";
                fileName = textFile.name;
            }

            // Agregar metadata del tipo de archivo
            formData.append("fileType", fileType);
            formData.append("fileName", fileName);

            const res = await fetch(
                "https://webhook.hubleconsulting.com/webhook/cedfe458-666f-400d-a0b7-e3c3bb625378",
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!res.ok) throw new Error("Error en el envío");
            
            toast({
                title: "Contenido enviado",
                description: mode === "file" 
                    ? `${file.name} fue subido correctamente`
                    : "El texto fue enviado correctamente",
            });

            setFile(null);
            setTextContent("");
        } catch (error) {
            toast({
                title: "Error al subir",
                description: "No se pudo enviar el contenido",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Selector de modo */}
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
                    {/* Caja Drag & Drop */}
                    {!file && (
                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-primary hover:bg-primary/5">
                            <input
                                type="file"
                                accept=".pdf,.docx,.txt"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <UploadCloud className="w-10 h-10 opacity-70 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Arrastra tu archivo aquí o haz clic
                            </p>
                            <p className="text-xs mt-1 opacity-70">Formatos permitidos: .pdf, .docx, .txt</p>
                        </label>
                    )}

                    {file && (
                        <div className="text-sm font-medium p-2 bg-muted rounded-lg flex justify-between items-center">
                            <span>{file.name}</span>
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
                        Subiendo...
                    </>
                ) : (
                    mode === "file" ? "Subir archivo" : "Enviar texto"
                )}
            </Button>
        </div>
    );
};

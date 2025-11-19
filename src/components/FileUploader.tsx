import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";

export const FileUploader = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
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
        if (!file) {
            toast({
                title: "Sin archivo",
                description: "Selecciona un archivo antes de subir",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append("data0", file);

            const res = await fetch(
                "https://webhook.hubleconsulting.com/webhook/cedfe458-666f-400d-a0b7-e3c3bb625378",
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!res.ok) throw new Error("Error en el envío");
            console.log(res);
            toast({
                title: "Archivo enviado",
                description: `${file.name} fue subido correctamente`,
            });

            setFile(null);
        } catch (error) {
            toast({
                title: "Error al subir",
                description: "No se pudo enviar el archivo",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Caja Drag & Drop */}
            {!file && (<label
                className="
                    flex flex-col items-center justify-center
                    w-full h-40 border-2 border-dashed rounded-xl
                    cursor-pointer transition-all
                    hover:border-primary hover:bg-primary/5
                "
            >
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
            </label>)}

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

            <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full"
            >
                {uploading ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Subiendo...
                    </>
                ) : (
                    "Subir archivo"
                )}
            </Button>
        </div>
    );
};

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

interface MindMap {
  id: string;
  html_content: string;
  tema: string;
  created_at: string;
}

const MindMap = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleDownload = (mindMap: MindMap) => {
    try {
      // Crear un contenedor temporal para el HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = mindMap.html_content;
      tempDiv.style.width = "800px";
      tempDiv.style.padding = "20px";
      document.body.appendChild(tempDiv);

      // Configurar opciones de html2pdf
      const opt = {
        margin: 10,
        filename: `mapa-mental-${mindMap.tema.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "landscape" as const }
      };

      // Generar PDF
      html2pdf()
        .from(tempDiv)
        .set(opt)
        .save()
        .then(() => {
          document.body.removeChild(tempDiv);
          toast.success("Mapa mental descargado en PDF");
        })
        .catch((error: Error) => {
          console.error("Error generating PDF:", error);
          document.body.removeChild(tempDiv);
          toast.error("Error generando PDF");
        });
    } catch (error) {
      console.error("Error downloading mind map:", error);
      toast.error("Error descargando mapa mental");
    }
  };

  useEffect(() => {
    const loadMindMaps = async () => {
      if (!conversationId) return;

      setIsLoading(true);
      const { data, error } = await supabase
        .from("mind_maps")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading mind maps:", error);
        toast.error("Error cargando mapas mentales");
      } else {
        setMindMaps(data || []);
      }
      setIsLoading(false);
    };

    loadMindMaps();
  }, [conversationId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mindMaps.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <h1 className="text-2xl font-bold text-foreground mb-4">No hay mapas mentales</h1>
        <p className="text-muted-foreground mb-6">
          No se encontraron mapas mentales para esta conversación.
        </p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Mapas Mentales</h1>
            <p className="text-sm text-muted-foreground">{mindMaps.length} mapa(s) encontrado(s)</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {mindMaps.map((mindMap) => (
            <div
              key={mindMap.id}
              className="bg-card rounded-xl border shadow-sm overflow-hidden"
            >
              <div className="p-4 border-b bg-card/50 flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">Tema: {mindMap.tema}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Creado: {new Date(mindMap.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={() => handleDownload(mindMap)}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </div>
              <div className="bg-white">
                <iframe
                  srcDoc={mindMap.html_content}
                  className="w-full h-[600px] border-0"
                  title={`Mapa mental: ${mindMap.tema}`}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default MindMap;

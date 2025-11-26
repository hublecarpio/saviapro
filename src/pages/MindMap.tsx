import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

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
              <div className="p-4 border-b bg-card/50">
                <h2 className="font-semibold text-foreground">Tema: {mindMap.tema}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Creado: {new Date(mindMap.created_at).toLocaleString()}
                </p>
              </div>
              <div className="p-6 bg-background/50">
                <div
                  className="mind-map-content w-full overflow-auto bg-white rounded-lg p-4"
                  dangerouslySetInnerHTML={{ __html: mindMap.html_content }}
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

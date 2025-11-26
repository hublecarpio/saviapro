import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Brain, ExternalLink, X } from "lucide-react";

interface MindMapDisplayProps {
  conversationId: string;
}

interface MindMap {
  id: string;
  html_content: string;
  tema: string;
  created_at: string;
}

export const MindMapDisplay = ({ conversationId }: MindMapDisplayProps) => {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMindMap, setSelectedMindMap] = useState<MindMap | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadMindMaps = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("mind_maps")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMindMaps(data);
      }
      setIsLoading(false);
    };

    loadMindMaps();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`mind-maps-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mind_maps",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMindMaps((prev) => [payload.new as MindMap, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleOpenInNewPage = () => {
    navigate(`/mindmap/${conversationId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mindMaps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-3 w-full">
      {mindMaps.map((mindMap) => (
        <div
          key={mindMap.id}
          className="group relative rounded-lg border border-border/50 bg-card/30 overflow-hidden hover:border-primary/50 transition-all w-full"
        >
          {/* Preview compacto del mapa */}
          <div className="relative h-32 md:h-40 overflow-hidden bg-background/50">
            <iframe
              srcDoc={mindMap.html_content}
              className="w-full h-full border-0 pointer-events-none scale-75 origin-top-left"
              title={`Preview: ${mindMap.tema}`}
              sandbox="allow-scripts allow-same-origin"
              style={{ width: '133%', height: '133%' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>

          {/* Info y botones */}
          <div className="flex items-center gap-3 p-2 md:p-3">
            <Brain className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-foreground truncate">
                {mindMap.tema}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(mindMap.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Dialog open={isDialogOpen && selectedMindMap?.id === mindMap.id} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setSelectedMindMap(null);
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedMindMap(mindMap);
                      setIsDialogOpen(true);
                    }}
                  >
                    Ver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] p-3 md:p-6">
                  <DialogHeader>
                    <DialogTitle className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <span className="text-sm md:text-base truncate">{selectedMindMap?.tema}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenInNewPage}
                        className="gap-2 w-full md:w-auto"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir en página
                      </Button>
                    </DialogTitle>
                  </DialogHeader>
                  {selectedMindMap && (
                    <iframe
                      srcDoc={selectedMindMap.html_content}
                      className="w-full h-[400px] md:h-[600px] border-0 rounded-lg"
                      title={`Mapa mental: ${selectedMindMap.tema}`}
                      sandbox="allow-scripts allow-same-origin"
                    />
                  )}
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleOpenInNewPage}
                title="Abrir en página completa"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

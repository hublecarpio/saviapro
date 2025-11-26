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
    <div className="space-y-3 mt-4">
      {mindMaps.map((mindMap) => (
        <div
          key={mindMap.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50"
        >
          <Brain className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Mapa Mental: {mindMap.tema}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(mindMap.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Dialog open={isDialogOpen && selectedMindMap?.id === mindMap.id} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setSelectedMindMap(null);
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMindMap(mindMap);
                    setIsDialogOpen(true);
                  }}
                >
                  Ver
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Mapa Mental: {selectedMindMap?.tema}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenInNewPage}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir en página
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                {selectedMindMap && (
                  <div
                    className="mind-map-content w-full overflow-auto bg-white rounded-lg p-4"
                    dangerouslySetInnerHTML={{ __html: selectedMindMap.html_content }}
                  />
                )}
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewPage}
              title="Abrir en página completa"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

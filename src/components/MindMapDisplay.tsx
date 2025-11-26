import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
    <div className="space-y-4 mt-4">
      {mindMaps.map((mindMap) => (
        <Card key={mindMap.id} className="p-4 bg-card/50 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Mapa Mental: {mindMap.tema}
          </h3>
          <div
            className="mind-map-content w-full overflow-auto"
            dangerouslySetInnerHTML={{ __html: mindMap.html_content }}
          />
        </Card>
      ))}
    </div>
  );
};

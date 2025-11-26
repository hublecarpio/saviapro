import { Video, Podcast, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  hasMessages: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onGenerateMindMap: () => void;
}

export const ChatToolsSidebar = ({
  isLoading,
  hasMessages,
  onGenerateVideo,
  onGeneratePodcast,
  onGenerateMindMap,
}: ChatToolsSidebarProps) => {
  return (
    <aside className="fixed right-0 top-[64px] h-[calc(100vh-64px)] w-16 md:w-20 border-l bg-card/30 backdrop-blur-sm flex flex-col gap-3 py-6 items-center shrink-0 z-20 overflow-y-auto">
      {hasMessages && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateVideo}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar video resumen"
          >
            <Video className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Video</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onGeneratePodcast}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar podcast resumen"
          >
            <Podcast className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Podcast</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateMindMap}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar mapa mental"
          >
            <Brain className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Mapas</span>
          </Button>
        </>
      )}
    </aside>
  );
};

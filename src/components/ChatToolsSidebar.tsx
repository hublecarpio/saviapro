import { Video, Podcast, Brain, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  hasMessages: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestMindMap: () => void;
  onRequestInforme: () => void;
}

export const ChatToolsSidebar = ({
  isLoading,
  hasMessages,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestMindMap,
  onRequestInforme,
}: ChatToolsSidebarProps) => {
  return (
    <aside className="hidden md:flex fixed right-0 top-[64px] h-[calc(100vh-64px)] w-20 border-l bg-card/30 backdrop-blur-sm flex-col gap-3 py-6 items-center shrink-0 z-20 overflow-y-auto">
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
            onClick={onRequestMindMap}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Solicitar mapa mental"
          >
            <Brain className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Mapas</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRequestInforme}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Solicitar informe"
          >
            <FileText className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Informe</span>
          </Button>
        </>
      )}
    </aside>
  );
};

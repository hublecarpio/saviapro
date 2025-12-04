import { Video, Podcast, Brain, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  hasMessages: boolean;
  isGeneratingMindMap?: boolean;
  isGeneratingInforme?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingPodcast?: boolean;
  isGeneratingFichas?: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestMindMap: () => void;
  onRequestInforme: () => void;
  onGenerateFichas: () => void;
}

export const ChatToolsSidebar = ({
  isLoading,
  hasMessages,
  isGeneratingMindMap,
  isGeneratingInforme,
  isGeneratingVideo,
  isGeneratingPodcast,
  isGeneratingFichas,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestMindMap,
  onRequestInforme,
  onGenerateFichas,
}: ChatToolsSidebarProps) => {
  return (
    <aside className="hidden md:flex fixed right-0 top-[64px] h-[calc(100vh-64px)] w-20 border-l bg-card/30 backdrop-blur-sm flex-col gap-3 py-6 items-center shrink-0 z-20 overflow-y-auto">
      {hasMessages && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateVideo}
            disabled={isLoading || isGeneratingVideo}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar video resumen"
          >
            <Video className={`h-5 w-5 transition-colors ${isGeneratingVideo ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <span className={`text-[9px] font-medium ${isGeneratingVideo ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>Video</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onGeneratePodcast}
            disabled={isLoading || isGeneratingPodcast}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar podcast resumen"
          >
            <Podcast className={`h-5 w-5 transition-colors ${isGeneratingPodcast ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <span className={`text-[9px] font-medium ${isGeneratingPodcast ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>Podcast</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRequestMindMap}
            disabled={isLoading || isGeneratingMindMap}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Solicitar mapa mental"
          >
            <Brain className={`h-5 w-5 transition-colors ${isGeneratingMindMap ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <span className={`text-[9px] font-medium ${isGeneratingMindMap ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>Mapas</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRequestInforme}
            disabled={isLoading || isGeneratingInforme}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Solicitar informe"
          >
            <FileText className={`h-5 w-5 transition-colors ${isGeneratingInforme ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <span className={`text-[9px] font-medium ${isGeneratingInforme ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>Informe</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateFichas}
            disabled={isLoading || isGeneratingFichas}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar fichas didácticas"
          >
            <BookOpen className={`h-5 w-5 transition-colors ${isGeneratingFichas ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-foreground'}`} />
            <span className={`text-[9px] font-medium ${isGeneratingFichas ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>Fichas</span>
          </Button>
        </>
      )}
    </aside>
  );
};

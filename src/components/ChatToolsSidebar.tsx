import { Video, Podcast, Brain, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SofiaThinking } from "@/components/SofiaThinking";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  hasMessages: boolean;
  isGeneratingMindMap?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingPodcast?: boolean;
  isGeneratingFichas?: boolean;
  isGeneratingInforme?: boolean;
  hasVideoGenerated?: boolean;
  hasPodcastGenerated?: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestMindMap: () => void;
  onGenerateFichas: () => void;
  onRequestInforme: () => void;
}

export const ChatToolsSidebar = ({
  isLoading,
  hasMessages,
  isGeneratingMindMap,
  isGeneratingVideo,
  isGeneratingPodcast,
  isGeneratingFichas,
  isGeneratingInforme,
  hasVideoGenerated,
  hasPodcastGenerated,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestMindMap,
  onGenerateFichas,
  onRequestInforme,
}: ChatToolsSidebarProps) => {
  return (
    <aside className="hidden md:flex fixed right-0 top-[64px] h-[calc(100vh-64px)] w-20 border-l bg-card/30 backdrop-blur-sm flex-col gap-3 py-6 items-center shrink-0 z-20 overflow-y-auto">
      {hasMessages && (
        <>
          {isGeneratingVideo ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 bg-accent/30">
              <SofiaThinking />
              <span className="text-[8px] font-medium text-primary">Generando</span>
            </div>
          ) : hasVideoGenerated ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 bg-muted/50 opacity-50 cursor-not-allowed" title="Ya se generó un video en esta conversación">
              <Video className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">Generado</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onGenerateVideo}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
              title="Generar video resumen"
            >
              <Video className="h-5 w-5 transition-colors text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Video</span>
            </Button>
          )}

          {isGeneratingPodcast ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 bg-accent/30">
              <SofiaThinking />
              <span className="text-[8px] font-medium text-primary">Generando</span>
            </div>
          ) : hasPodcastGenerated ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 bg-muted/50 opacity-50 cursor-not-allowed" title="Ya se generó un podcast en esta conversación">
              <Podcast className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">Generado</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onGeneratePodcast}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
              title="Generar podcast resumen"
            >
              <Podcast className="h-5 w-5 transition-colors text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Podcast</span>
            </Button>
          )}

          {isGeneratingMindMap ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 bg-accent/30">
              <SofiaThinking />
              <span className="text-[8px] font-medium text-primary">Generando</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRequestMindMap}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
              title="Solicitar mapa mental"
            >
              <Brain className="h-5 w-5 transition-colors text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Mapas</span>
            </Button>
          )}


          {isGeneratingFichas ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 bg-accent/30">
              <SofiaThinking />
              <span className="text-[8px] font-medium text-primary">Generando</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onGenerateFichas}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
              title="Generar fichas didácticas"
            >
              <BookOpen className="h-5 w-5 transition-colors text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Fichas</span>
            </Button>
          )}

          {isGeneratingInforme ? (
            <div className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 bg-accent/30">
              <SofiaThinking />
              <span className="text-[8px] font-medium text-primary">Generando</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRequestInforme}
              disabled={isLoading}
              className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
              title="Generar informe escrito"
            >
              <FileText className="h-5 w-5 transition-colors text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Informe</span>
            </Button>
          )}
        </>
      )}
    </aside>
  );
};

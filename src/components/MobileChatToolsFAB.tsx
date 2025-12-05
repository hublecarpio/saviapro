import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Podcast, Brain, FileText, BookOpen, Plus, X } from "lucide-react";
import { SofiaThinking } from "@/components/SofiaThinking";

interface MobileChatToolsFABProps {
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

export const MobileChatToolsFAB = ({
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
}: MobileChatToolsFABProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasMessages) return null;

  const tools = [
    { icon: Video, label: "Video", onClick: onGenerateVideo, isGenerating: isGeneratingVideo },
    { icon: Podcast, label: "Podcast", onClick: onGeneratePodcast, isGenerating: isGeneratingPodcast },
    { icon: Brain, label: "Mapas", onClick: onRequestMindMap, isGenerating: isGeneratingMindMap },
    { icon: FileText, label: "Informe", onClick: onRequestInforme, isGenerating: isGeneratingInforme },
    { icon: BookOpen, label: "Fichas", onClick: onGenerateFichas, isGenerating: isGeneratingFichas },
  ];

  const handleToolClick = (onClick: () => void) => {
    onClick();
    setIsExpanded(false);
  };

  return (
    <>
      {/* Backdrop cuando está expandido */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/10 z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Container de botones */}
      <div className="fixed bottom-20 right-3 z-50 md:hidden flex flex-col-reverse gap-2">
        {/* Botones expandidos */}
        {isExpanded &&
          tools.map((tool, index) => {
            const Icon = tool.icon;
            const isInformeGenerating = tool.label === "Informe" && tool.isGenerating;
            
            if (isInformeGenerating) {
              return (
                <div
                  key={tool.label}
                  className="h-9 px-3 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-sm flex items-center gap-2 animate-in slide-in-from-right-2 fade-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="w-6 h-6">
                    <SofiaThinking />
                  </div>
                  <span className="text-xs font-medium text-primary">Generando</span>
                </div>
              );
            }
            
            return (
              <Button
                key={tool.label}
                onClick={() => handleToolClick(tool.onClick)}
                disabled={isLoading || tool.isGenerating}
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-full bg-background/95 backdrop-blur-sm border-border shadow-sm hover:bg-accent hover:scale-105 transition-all duration-200 animate-in slide-in-from-right-2 fade-in"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Icon className={`h-4 w-4 mr-2 ${tool.isGenerating ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${tool.isGenerating ? 'text-primary' : ''}`}>{tool.label}</span>
              </Button>
            );
          })}

        {/* Botón principal */}
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isLoading}
          size="sm"
          className={`h-11 w-11 rounded-full shadow-lg transition-all duration-300 ${
            isExpanded
              ? "bg-muted hover:bg-muted/90 rotate-45"
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {isExpanded ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </Button>
      </div>
    </>
  );
};

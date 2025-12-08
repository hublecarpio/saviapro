import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Podcast, Brain, BookOpen, Plus, X } from "lucide-react";
import { SofiaThinking } from "@/components/SofiaThinking";

interface MobileChatToolsFABProps {
  isLoading: boolean;
  hasMessages: boolean;
  isGeneratingMindMap?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingPodcast?: boolean;
  isGeneratingFichas?: boolean;
  hasVideoGenerated?: boolean;
  hasPodcastGenerated?: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestMindMap: () => void;
  onGenerateFichas: () => void;
}

export const MobileChatToolsFAB = ({
  isLoading,
  hasMessages,
  isGeneratingMindMap,
  isGeneratingVideo,
  isGeneratingPodcast,
  isGeneratingFichas,
  hasVideoGenerated,
  hasPodcastGenerated,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestMindMap,
  onGenerateFichas,
}: MobileChatToolsFABProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasMessages) return null;

  const tools = [
    { icon: Video, label: "Video", onClick: onGenerateVideo, isGenerating: isGeneratingVideo, isGenerated: hasVideoGenerated },
    { icon: Podcast, label: "Podcast", onClick: onGeneratePodcast, isGenerating: isGeneratingPodcast, isGenerated: hasPodcastGenerated },
    { icon: Brain, label: "Mapas", onClick: onRequestMindMap, isGenerating: isGeneratingMindMap, isGenerated: false },
    { icon: BookOpen, label: "Fichas", onClick: onGenerateFichas, isGenerating: isGeneratingFichas, isGenerated: false },
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
            
            // Show Sofia thinking for any generating tool
            if (tool.isGenerating) {
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

            // Show disabled state for already generated tools
            if (tool.isGenerated) {
              return (
                <div
                  key={tool.label}
                  className="h-9 px-3 rounded-full bg-muted/50 border border-border shadow-sm flex items-center gap-2 opacity-50 cursor-not-allowed animate-in slide-in-from-right-2 fade-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Generado</span>
                </div>
              );
            }
            
            return (
              <Button
                key={tool.label}
                onClick={() => handleToolClick(tool.onClick)}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-full bg-background/95 backdrop-blur-sm border-border shadow-sm hover:bg-accent hover:scale-105 transition-all duration-200 animate-in slide-in-from-right-2 fade-in"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-xs font-medium">{tool.label}</span>
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

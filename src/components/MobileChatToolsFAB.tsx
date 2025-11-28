import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Podcast, Brain, FileText, BookOpen, Sparkles, X } from "lucide-react";

interface MobileChatToolsFABProps {
  isLoading: boolean;
  hasMessages: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestMindMap: () => void;
  onRequestInforme: () => void;
  onGenerateFichas: () => void;
}

export const MobileChatToolsFAB = ({
  isLoading,
  hasMessages,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestMindMap,
  onRequestInforme,
  onGenerateFichas,
}: MobileChatToolsFABProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasMessages) return null;

  const tools = [
    {
      icon: Video,
      label: "Video",
      onClick: onGenerateVideo,
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Podcast,
      label: "Podcast",
      onClick: onGeneratePodcast,
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Brain,
      label: "Mapas",
      onClick: onRequestMindMap,
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: FileText,
      label: "Informe",
      onClick: onRequestInforme,
      color: "from-orange-500 to-amber-500",
    },
    {
      icon: BookOpen,
      label: "Fichas",
      onClick: onGenerateFichas,
      color: "from-indigo-500 to-purple-500",
    },
  ];

  const handleToolClick = (onClick: () => void) => {
    onClick();
    setIsExpanded(false);
  };

  return (
    <>
      {/* Backdrop oscuro cuando está expandido */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Botones expandidos */}
      <div className="fixed bottom-24 right-4 z-50 md:hidden flex flex-col-reverse gap-3">
        {isExpanded &&
          tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.label}
                className="animate-in slide-in-from-bottom-2 fade-in duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Button
                  onClick={() => handleToolClick(tool.onClick)}
                  disabled={isLoading}
                  className={`h-14 px-6 rounded-full bg-gradient-to-r ${tool.color} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-3 group`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tool.label}</span>
                </Button>
              </div>
            );
          })}

        {/* Botón principal flotante */}
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isLoading}
          className={`h-16 w-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 ${
            isExpanded
              ? "bg-destructive hover:bg-destructive/90 rotate-0"
              : "bg-gradient-to-br from-primary via-secondary to-primary hover:from-primary/90 hover:via-secondary/90 hover:to-primary/90"
          }`}
        >
          {isExpanded ? (
            <X className="h-7 w-7 text-white" />
          ) : (
            <Sparkles className="h-7 w-7 text-white animate-pulse" />
          )}
        </Button>
      </div>
    </>
  );
};

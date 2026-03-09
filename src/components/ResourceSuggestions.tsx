import { Brain, BookOpen, Video, Podcast, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResourceSuggestionsProps {
  resources: string[];
  hasVideoGenerated: boolean;
  hasPodcastGenerated: boolean;
  isLoading: boolean;
  onRequestMindMap: () => void;
  onGenerateFichas: () => void;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
  onRequestInforme: () => void;
}

const resourceConfig: Record<string, { icon: React.ElementType; label: string }> = {
  mind_map: { icon: Brain,     label: "Mapa mental"   },
  fichas:   { icon: BookOpen,  label: "Fichas"         },
  video:    { icon: Video,     label: "Video resumen"  },
  podcast:  { icon: Podcast,   label: "Podcast"        },
  informe:  { icon: FileText,  label: "Informe"        },
};

export const ResourceSuggestions = ({
  resources,
  hasVideoGenerated,
  hasPodcastGenerated,
  isLoading,
  onRequestMindMap,
  onGenerateFichas,
  onGenerateVideo,
  onGeneratePodcast,
  onRequestInforme,
}: ResourceSuggestionsProps) => {
  if (!resources || resources.length === 0) return null;

  const handlers: Record<string, () => void> = {
    mind_map: onRequestMindMap,
    fichas:   onGenerateFichas,
    video:    onGenerateVideo,
    podcast:  onGeneratePodcast,
    informe:  onRequestInforme,
  };

  const isDisabled = (key: string) => {
    if (key === "video"   && hasVideoGenerated)   return true;
    if (key === "podcast" && hasPodcastGenerated) return true;
    return false;
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
      <span className="text-[11px] text-muted-foreground/70 w-full mb-0.5">
        Sofia sugiere:
      </span>
      {resources.map((key) => {
        const config = resourceConfig[key];
        if (!config) return null;
        const Icon = config.icon;
        const disabled = isLoading || isDisabled(key);

        return (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={handlers[key]}
            disabled={disabled}
            className="text-[11px] gap-1 h-7 px-2.5 rounded-full border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </Button>
        );
      })}
    </div>
  );
};

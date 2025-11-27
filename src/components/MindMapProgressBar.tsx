import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Brain } from "lucide-react";

interface MindMapProgressBarProps {
  isGenerating: boolean;
  onComplete?: () => void;
}

export const MindMapProgressBar = ({ isGenerating, onComplete }: MindMapProgressBarProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      return;
    }

    // Simular progreso con intervalos realistas
    const stages = [
      { progress: 15, delay: 500, label: "Analizando contenido..." },
      { progress: 35, delay: 800, label: "Identificando conceptos clave..." },
      { progress: 55, delay: 1000, label: "Estructurando relaciones..." },
      { progress: 75, delay: 1200, label: "Generando visualización..." },
      { progress: 95, delay: 800, label: "Finalizando mapa..." },
      { progress: 100, delay: 500, label: "¡Listo!" }
    ];

    let currentStage = 0;
    
    const runStage = () => {
      if (currentStage >= stages.length || !isGenerating) {
        if (currentStage >= stages.length && onComplete) {
          onComplete();
        }
        return;
      }

      const stage = stages[currentStage];
      setProgress(stage.progress);
      currentStage++;

      setTimeout(runStage, stage.delay);
    };

    runStage();

  }, [isGenerating, onComplete]);

  if (!isGenerating && progress === 0) return null;

  return (
    <div className="flex justify-start w-full mb-4">
      <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Brain className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">
            Generando mapa mental...
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {progress}% completado
        </p>
      </div>
    </div>
  );
};

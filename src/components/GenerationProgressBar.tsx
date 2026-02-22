import { useState, useEffect } from 'react';
import { Brain, Video, Podcast, BookOpen, FileText } from 'lucide-react';

interface GenerationProgressBarProps {
  isGenerating: boolean;
  type: 'mindmap' | 'video' | 'podcast' | 'fichas' | 'informe';
  label: string;
  subLabel: string;
}

export function GenerationProgressBar({ isGenerating, type, label, subLabel }: GenerationProgressBarProps) {
  const [internalState, setInternalState] = useState<'idle' | 'generating' | 'completing'>('idle');
  const [progress, setProgress] = useState(0);

  // 1. Manejo del estado interno para poder mostrar el 100% antes de desaparecer
  useEffect(() => {
    if (isGenerating && internalState === 'idle') {
      setInternalState('generating');
      setProgress(0);
    } else if (!isGenerating && internalState === 'generating') {
      setInternalState('completing');
      setProgress(100);
      const timer = setTimeout(() => {
        setInternalState('idle');
      }, 2000); // 2 segundos mostrando el 100% para que se aprecie
      return () => clearTimeout(timer);
    }
  }, [isGenerating, internalState]);

  // 2. Simulador de progreso
  useEffect(() => {
    if (internalState !== 'generating') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return prev; // Se queda en 98% hasta que llegue el evento
        if (prev < 30) return prev + Math.random() * 6; // Rápido al inicio
        if (prev < 60) return prev + Math.random() * 3;
        if (prev < 85) return prev + Math.random() * 1.2;
        if (prev < 98) return prev + Math.random() * 0.4; // Muy lento al final
        return prev;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [internalState]);

  if (internalState === 'idle') return null;

  const getIcon = () => {
    switch (type) {
      case 'mindmap': return <Brain className="h-5 w-5 text-primary animate-pulse" />;
      case 'video': return <Video className="h-5 w-5 text-primary animate-pulse" />;
      case 'podcast': return <Podcast className="h-5 w-5 text-primary animate-pulse" />;
      case 'fichas': return <BookOpen className="h-5 w-5 text-primary animate-pulse" />;
      case 'informe': return <FileText className="h-5 w-5 text-primary animate-pulse" />;
      default: return <Brain className="h-5 w-5 text-primary animate-pulse" />;
    }
  };

  return (
    <div className="flex justify-start w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl p-4 shadow-sm min-w-[280px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-foreground truncate mr-2">
                {internalState === 'completing' ? '¡Archivo generado!' : label}
              </span>
              <span className="text-xs text-muted-foreground font-mono font-medium shrink-0">
                {Math.min(Math.round(progress), 100)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`bg-primary h-2 rounded-full transition-all ease-out ${internalState === 'completing' ? 'duration-500' : 'duration-[400ms]'}`}
                style={{ width: `${Math.min(progress, 100)}%` }} 
              />
            </div>
          </div>
        </div>
        <p className={`text-xs text-muted-foreground ml-[3.25rem] ${internalState === 'generating' ? 'animate-pulse' : ''}`}>
          {internalState === 'completing' ? 'Mostrando en la conversación...' : subLabel}
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Ficha {
  pregunta: string;
  respuesta: string;
  orden: number;
}

interface FichasDidacticasProps {
  conversationId: string;
  fichasSetId: string;
  onClose: () => void;
}

export const FichasDidacticas = ({ conversationId, fichasSetId, onClose }: FichasDidacticasProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFichas();
  }, [conversationId, fichasSetId]);

  const loadFichas = async () => {
    try {
      setLoading(true);
      
      // Cargar TODAS las fichas de la conversación y buscar el set específico
      const { data, error } = await supabase
        .from("fichas_didacticas")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .order("orden", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Agrupar fichas por timestamp (normalizado a minuto)
        const grouped = new Map<string, typeof data>();
        data.forEach(ficha => {
          const timestamp = new Date(ficha.created_at);
          timestamp.setSeconds(0, 0);
          const key = timestamp.toISOString();
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(ficha);
        });

        // Buscar el set que contiene la ficha con fichasSetId
        for (const [, fichasGroup] of grouped.entries()) {
          if (fichasGroup.some(f => f.id === fichasSetId)) {
            setFichas(fichasGroup as Ficha[]);
            return;
          }
        }

        toast.error("No se encontraron fichas para este set");
        onClose();
      } else {
        toast.error("No se encontraron fichas");
        onClose();
      }
    } catch (error) {
      console.error("Error cargando fichas:", error);
      toast.error("Error al cargar las fichas");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < fichas.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-background border border-border rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Cargando fichas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (fichas.length === 0) {
    return null;
  }

  const currentFicha = fichas[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">📚 Fichas Didácticas</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Card Container */}
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div
            className="relative w-full max-w-lg h-80 cursor-pointer"
            style={{ perspective: "1000px" }}
            onClick={handleFlip}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 preserve-3d ${
                isFlipped ? "rotate-y-180" : ""
              }`}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Frente - Pregunta */}
              <div
                className="absolute inset-0 backface-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl p-8 flex flex-col items-center justify-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="text-sm text-primary font-semibold mb-4">
                  Pregunta {currentIndex + 1} de {fichas.length}
                </div>
                <p className="text-2xl font-bold text-center text-foreground">
                  {currentFicha.pregunta}
                </p>
                <div className="mt-6 text-sm text-muted-foreground">
                  Haz clic para ver la respuesta
                </div>
              </div>

              {/* Reverso - Respuesta */}
              <div
                className="absolute inset-0 backface-hidden bg-gradient-to-br from-secondary/10 to-secondary/5 border-2 border-secondary/20 rounded-2xl p-8 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="text-sm text-secondary font-semibold mb-4">Respuesta</div>
                <p className="text-lg text-center text-foreground leading-relaxed">
                  {currentFicha.respuesta}
                </p>
                <div className="mt-6 text-sm text-muted-foreground">
                  Haz clic para ver la pregunta
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con navegación */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="text-sm text-muted-foreground font-medium">
            {currentIndex + 1} / {fichas.length}
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === fichas.length - 1}
            className="gap-2"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

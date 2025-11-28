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
  onClose: () => void;
}

export const FichasDidacticas = ({ conversationId, onClose }: FichasDidacticasProps) => {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadFichas();
  }, [conversationId]);

  const loadFichas = async () => {
    try {
      setLoading(true);
      
      // Intentar cargar fichas existentes
      const { data, error } = await supabase
        .from("fichas_didacticas")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("orden", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setFichas(data as Ficha[]);
      } else {
        // No hay fichas, generarlas
        await generateFichas();
      }
    } catch (error) {
      console.error("Error cargando fichas:", error);
      toast.error("Error al cargar las fichas");
    } finally {
      setLoading(false);
    }
  };

  const generateFichas = async () => {
    try {
      setGenerating(true);
      
      // Obtener mensajes de la conversación
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("message, role")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      if (!messages || messages.length === 0) {
        toast.error("No hay contenido en esta conversación para generar fichas");
        onClose();
        return;
      }

      // Construir el contenido del chat
      const contenidoChat = messages
        .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.message}`)
        .join("\n\n");

      // Llamar al edge function
      const { data, error } = await supabase.functions.invoke("generar-fichas", {
        body: {
          conversation_id: conversationId,
          contenido_chat: contenidoChat,
        },
      });

      if (error) {
        console.error("Error generando fichas:", error);
        
        if (error.message.includes("429")) {
          toast.error("Límite de peticiones excedido. Intenta de nuevo en unos momentos.");
        } else if (error.message.includes("402")) {
          toast.error("Se requiere agregar créditos a tu cuenta de Lovable AI.");
        } else {
          toast.error("Error al generar las fichas");
        }
        return;
      }

      if (data?.success && data.fichas) {
        setFichas(data.fichas);
        toast.success("¡Fichas generadas exitosamente!");
      }
    } catch (error) {
      console.error("Error generando fichas:", error);
      toast.error("Error al generar las fichas");
    } finally {
      setGenerating(false);
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

  if (loading || generating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-background border border-border rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {loading ? "Cargando fichas..." : "Generando fichas didácticas..."}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {generating && "Esto puede tomar unos segundos"}
            </p>
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

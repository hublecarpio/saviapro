import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Loader2, Check, XCircle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PreguntaQuiz {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
  orden: number;
}

interface FichasDidacticasProps {
  conversationId: string;
  fichasSetId: string;
  onClose: () => void;
}

export const FichasDidacticas = ({ conversationId, fichasSetId, onClose }: FichasDidacticasProps) => {
  const [preguntas, setPreguntas] = useState<PreguntaQuiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(new Map());
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadPreguntas();
  }, [conversationId, fichasSetId]);

  const loadPreguntas = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("fichas_didacticas")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .order("orden", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Agrupar por timestamp (normalizado a minuto)
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
            // Filtrar solo las que tienen opciones (formato quiz)
            const quizPreguntas = fichasGroup
              .filter(f => f.opciones && Array.isArray(f.opciones) && f.opciones.length === 4)
              .map(f => ({
                id: f.id,
                pregunta: f.pregunta,
                opciones: f.opciones as string[],
                respuesta_correcta: f.respuesta_correcta as number,
                orden: f.orden
              }));
            
            if (quizPreguntas.length > 0) {
              setPreguntas(quizPreguntas);
              return;
            }
          }
        }

        toast.error("No se encontraron preguntas para este quiz");
        onClose();
      } else {
        toast.error("No se encontraron preguntas");
        onClose();
      }
    } catch (error) {
      console.error("Error cargando preguntas:", error);
      toast.error("Error al cargar las preguntas");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (answerIndex: number) => {
    if (showResults) return;
    
    const newAnswers = new Map(selectedAnswers);
    newAnswers.set(currentIndex, answerIndex);
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < preguntas.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFinishQuiz = async () => {
    // Guardar resultados del quiz en la base de datos
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sesión expirada");
        return;
      }

      const resultsToInsert = preguntas.map((pregunta, index) => ({
        user_id: session.user.id,
        conversation_id: conversationId,
        ficha_id: pregunta.id,
        selected_option: selectedAnswers.get(index) ?? -1,
        is_correct: selectedAnswers.get(index) === pregunta.respuesta_correcta,
      }));

      const { error } = await supabase
        .from("quiz_results")
        .insert(resultsToInsert);

      if (error) {
        console.error("Error guardando resultados:", error);
        // No mostramos error al usuario, los resultados se muestran igual
      }
    } catch (error) {
      console.error("Error guardando resultados:", error);
    }

    setShowResults(true);
  };

  const handleRestartQuiz = () => {
    setSelectedAnswers(new Map());
    setCurrentIndex(0);
    setShowResults(false);
  };

  const calculateScore = () => {
    let correct = 0;
    preguntas.forEach((pregunta, index) => {
      if (selectedAnswers.get(index) === pregunta.respuesta_correcta) {
        correct++;
      }
    });
    return correct;
  };

  const allAnswered = preguntas.length > 0 && selectedAnswers.size === preguntas.length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-background border border-border rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Cargando quiz...</p>
          </div>
        </div>
      </div>
    );
  }

  if (preguntas.length === 0) {
    return null;
  }

  // Vista de resultados finales
  if (showResults) {
    const score = calculateScore();
    const percentage = Math.round((score / preguntas.length) * 100);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h2 className="text-xl font-semibold">📊 Resultados del Quiz</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Score Summary */}
          <div className="p-6 text-center border-b border-border shrink-0">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
              <Trophy className={cn(
                "h-12 w-12",
                percentage >= 70 ? "text-yellow-500" : percentage >= 50 ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-2">
              {score} / {preguntas.length}
            </h3>
            <p className="text-lg text-muted-foreground">
              {percentage >= 70 ? "¡Excelente trabajo!" : percentage >= 50 ? "¡Buen intento!" : "Sigue practicando"}
            </p>
            <div className="w-full bg-muted rounded-full h-3 mt-4">
              <div 
                className={cn(
                  "h-3 rounded-full transition-all",
                  percentage >= 70 ? "bg-green-500" : percentage >= 50 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Detailed Results - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {preguntas.map((pregunta, index) => {
              const userAnswer = selectedAnswers.get(index);
              const isCorrect = userAnswer === pregunta.respuesta_correcta;
              
              return (
                <div 
                  key={pregunta.id}
                  className={cn(
                    "p-4 rounded-lg border-2",
                    isCorrect ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                      isCorrect ? "bg-green-500" : "bg-red-500"
                    )}>
                      {isCorrect ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <XCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-2">
                        {index + 1}. {pregunta.pregunta}
                      </p>
                      <div className="space-y-1 text-sm">
                        {userAnswer !== undefined && userAnswer !== pregunta.respuesta_correcta && (
                          <p className="text-red-600">
                            Tu respuesta: {pregunta.opciones[userAnswer]}
                          </p>
                        )}
                        <p className="text-green-600 font-medium">
                          Correcta: {pregunta.opciones[pregunta.respuesta_correcta]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 p-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={handleRestartQuiz}>
              Reintentar Quiz
            </Button>
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentPregunta = preguntas[currentIndex];
  const selectedAnswer = selectedAnswers.get(currentIndex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">🧠 Quiz</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Pregunta {currentIndex + 1} de {preguntas.length}</span>
            <span>{selectedAnswers.size} respondidas</span>
          </div>
          <div className="flex gap-1">
            {preguntas.map((_, index) => (
              <div 
                key={index}
                className={cn(
                  "flex-1 h-2 rounded-full transition-colors",
                  index === currentIndex 
                    ? "bg-primary" 
                    : selectedAnswers.has(index) 
                      ? "bg-primary/50" 
                      : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-foreground mb-6">
            {currentPregunta.pregunta}
          </h3>

          {/* Options */}
          <div className="space-y-3">
            {currentPregunta.opciones.map((opcion, index) => (
              <button
                key={index}
                onClick={() => handleSelectAnswer(index)}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all",
                  "hover:border-primary/50 hover:bg-primary/5",
                  selectedAnswer === index
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    selectedAnswer === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-foreground">{opcion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer with navigation */}
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

          {currentIndex === preguntas.length - 1 ? (
            <Button
              onClick={handleFinishQuiz}
              disabled={!allAnswered}
              className="gap-2"
            >
              Ver Resultados
              <Trophy className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleNext}
              className="gap-2"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

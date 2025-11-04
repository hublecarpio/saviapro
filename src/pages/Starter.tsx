import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  question: string;
  type: "number" | "textarea" | "single" | "multiple" | "ranking";
  icon: string;
  placeholder?: string;
  max?: number;
  min?: number;
  options?: QuestionOption[];
}

interface StarterData {
  [key: string]: string | number | string[] | undefined;
}

const Starter = () => {
  const [step, setStep] = useState(0);
  const [ageGroup, setAgeGroup] = useState<"7-12" | "12-17" | null>(null);
  const [starterData, setStarterData] = useState<StarterData>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [multipleChoices, setMultipleChoices] = useState<string[]>([]);
  const [showInteraction, setShowInteraction] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Preguntas para 7-12 años
  const questions712: Question[] = [
    {
      id: "age",
      question: "¿Cuántos años tienes?",
      type: "number",
      icon: "🎂"
    },
    {
      id: "description",
      question: "NOS CONOCEMOS!! Cuéntame sobre ti 🎯",
      placeholder: "Por ejemplo: Soy Salvador, tengo 9 años, curso el 4to grado de primaria...",
      type: "textarea",
      icon: "👋"
    },
    {
      id: "uniqueData",
      question: "TUS DATOS INTERESANTES:",
      placeholder: "Cuéntame algo que creas que debo saber para ser el mejor tutor para ti...",
      type: "textarea",
      icon: "⭐"
    },
    {
      id: "learningStyle",
      question: "¿Qué te ayuda más a entender? (Elige 2 que más te gusten)",
      type: "multiple",
      max: 2,
      options: [
        { value: "audio", label: "Escuchar explicaciones y cuentos 🔊" },
        { value: "visual", label: "Ver dibujos y videos 🎨" },
        { value: "hands", label: "Hacer actividades con las manos ✋" },
        { value: "reading", label: "Leer y escribir en mi cuaderno 📖" },
        { value: "games", label: "Jugar y moverme mientras aprendo 🎮" },
        { value: "friends", label: "Trabajar con amigos 👫" }
      ],
      icon: "📚"
    },
    {
      id: "challenges",
      question: "Cuando algo es difícil, tú: (Elige 2)",
      type: "multiple",
      max: 2,
      options: [
        { value: "ask", label: "Preguntas a alguien de inmediato ❓" },
        { value: "solo", label: "Intentas resolverlo solo un rato 🧠" },
        { value: "clues", label: "Buscas pistas o ejemplos 🔍" },
        { value: "rest", label: "Descansas y lo intentas después ⏸️" }
      ],
      icon: "💪"
    },
    {
      id: "contentPreference",
      question: "Ordena del 1 al 4 (1 = me gusta más, 4 = me gusta menos):",
      type: "ranking",
      options: [
        { value: "videos", label: "Videos divertidos con animaciones 🎥" },
        { value: "games", label: "Juegos y actividades para hacer 🎯" },
        { value: "audio", label: "Audios e historias para escuchar 🎧" },
        { value: "texts", label: "Textos cortos con dibujos 📝" }
      ],
      icon: "🎯"
    },
    {
      id: "studyTime",
      question: "¿Cuánto tiempo te gusta estudiar seguido?",
      type: "single",
      options: [
        { value: "15-20", label: "15-20 minutos (como un episodio de dibujos)" },
        { value: "25-35", label: "25-35 minutos (como una clase en el colegio)" },
        { value: "40-50", label: "40-50 minutos (como hacer la tarea)" },
        { value: "depends", label: "Depende de lo divertido que sea" }
      ],
      icon: "⏱️"
    },
    {
      id: "interests",
      question: "¿Qué temas te parecen más interesantes? (Elige 3)",
      type: "multiple",
      max: 3,
      options: [
        { value: "ships", label: "Barcos y el mar ⚓" },
        { value: "countries", label: "Países y culturas del mundo 🌍" },
        { value: "animals", label: "Animales y naturaleza 🐠" },
        { value: "stories", label: "Historias y aventuras 📚" },
        { value: "how", label: "Cómo funcionan las cosas 🔧" },
        { value: "puzzles", label: "Juegos y acertijos 🧩" }
      ],
      icon: "🌟"
    },
    {
      id: "learningGoal",
      question: "¿Para qué quieres aprender conmigo? (Elige 3)",
      type: "multiple",
      max: 3,
      options: [
        { value: "interesting", label: "Para saber más cosas interesantes" },
        { value: "school", label: "Para mejorar en el colegio" },
        { value: "smart", label: "Para ser más listo" },
        { value: "enjoy", label: "Porque me gusta aprender" },
        { value: "friends", label: "Para contarle a mis amigos" }
      ],
      icon: "🎓"
    },
    {
      id: "feelings",
      question: "Cuando no entiendo algo, me siento:",
      type: "single",
      options: [
        { value: "calm", label: "😊 Tranquilo, sé que lo lograré" },
        { value: "confused", label: "😐 Un poco confundido, pero intento" },
        { value: "frustrated", label: "😟 Frustrado, quiero rendirme" },
        { value: "help", label: "😊 Pido ayuda rápido" }
      ],
      icon: "💭"
    },
    {
      id: "explanationStyle",
      question: "Me gusta que me expliquen: (Elige 2)",
      type: "multiple",
      max: 2,
      options: [
        { value: "examples", label: "Con muchos ejemplos y paciencia" },
        { value: "direct", label: "Directo al punto, sin tanto rollo" },
        { value: "game", label: "Como si fuera un juego" },
        { value: "adventure", label: "Como si fuera una aventura" }
      ],
      icon: "🎈"
    },
    {
      id: "language",
      question: "¿En qué idioma te gustaría conversar conmigo?",
      type: "single",
      options: [
        { value: "english", label: "Inglés" },
        { value: "spanish", label: "Español" },
        { value: "both", label: "Ambas" }
      ],
      icon: "🌐"
    }
  ];

  // Preguntas para 12-17 años
  const questions1217: Question[] = [
    {
      id: "age",
      question: "¿Cuántos años tienes?",
      type: "number",
      icon: "🚀"
    },
    {
      id: "description",
      question: "PRESENTACIÓN PERSONAL - Cuéntame brevemente sobre ti para conocerte mejor",
      placeholder: "Por ejemplo: Soy María, tengo 15 años, curso 3ero de secundaria...",
      type: "textarea",
      icon: "👤"
    },
    {
      id: "uniqueCharacteristics",
      question: "TUS CARACTERÍSTICAS ÚNICAS - Comparte algo importante que deba saber para ser tu mejor tutor",
      placeholder: "Por ejemplo: Tengo TDAH diagnosticado, pero tomo medicación...",
      type: "textarea",
      icon: "✨"
    },
    {
      id: "learningStyle",
      question: "¿Cómo aprendes más efectivamente? (Elige tus 2 métodos preferidos)",
      type: "multiple",
      max: 2,
      options: [
        { value: "auditory", label: "Auditivo - escuchando explicaciones, podcasts o discusiones" },
        { value: "visual", label: "Visual - viendo diagramas, infografías y videos explicativos" },
        { value: "kinesthetic", label: "Kinestésico - haciendo ejercicios prácticos y simulaciones" },
        { value: "reading", label: "Lectura/Escritura - leyendo textos y tomando apuntes" },
        { value: "social", label: "Social - discutiendo y colaborando con otros" },
        { value: "reflective", label: "Reflexivo - procesando información individualmente" }
      ],
      icon: "🧠"
    },
    {
      id: "problemApproach",
      question: "Cuando enfrentas un problema complejo, tu enfoque natural es:",
      type: "single",
      options: [
        { value: "analytical", label: "Analítico - descomponerlo en partes más pequeñas" },
        { value: "global", label: "Global - ver el panorama general y conexiones" },
        { value: "methodical", label: "Metódico - seguir pasos lógicos y ordenados" },
        { value: "intuitive", label: "Intuitivo - confiar en tu instinto y creatividad" },
        { value: "collaborative", label: "Colaborativo - buscar perspectivas de otros" },
        { value: "experimental", label: "Experimental - probar diferentes soluciones" }
      ],
      icon: "🎯"
    },
    {
      id: "contentPreference",
      question: "Ordena por preferencia (1 = tu favorito, 6 = menos preferido):",
      type: "ranking",
      options: [
        { value: "videos", label: "Videos tutoriales y explicaciones visuales 🎥" },
        { value: "exercises", label: "Ejercicios interactivos y casos prácticos 🎯" },
        { value: "audio", label: "Contenido auditivo y podcasts 🎧" },
        { value: "texts", label: "Textos profundos y artículos especializados 📚" },
        { value: "infographics", label: "Infografías y mapas conceptuales 🗺️" },
        { value: "dialogues", label: "Diálogos guiados y debates socráticos 💬" }
      ],
      icon: "📊"
    },
    {
      id: "challengeTolerance",
      question: "¿Cómo manejas los desafíos difíciles?",
      type: "single",
      options: [
        { value: "low", label: "Baja tolerancia - prefiero retos graduales con apoyo constante" },
        { value: "medium", label: "Tolerancia media - manejo desafíos con orientación moderada" },
        { value: "high", label: "Alta tolerancia - disfruto resolver problemas complejos solo" },
        { value: "variable", label: "Variable - depende del tema y mi estado de ánimo" }
      ],
      icon: "💪"
    },
    {
      id: "sessionDuration",
      question: "Duración ideal de nuestras sesiones:",
      type: "single",
      options: [
        { value: "25-35", label: "Cortas (25-35 min) - sesiones intensas y focalizadas" },
        { value: "40-55", label: "Moderadas (40-55 min) - equilibrio perfecto" },
        { value: "60-80", label: "Extendidas (60-80 min) - inmersión completa" },
        { value: "flexible", label: "Flexible - según la complejidad del tema" }
      ],
      icon: "⏱️"
    },
    {
      id: "learningGoals",
      question: "Metas de aprendizaje para los próximos 6 meses:",
      placeholder: "Describe qué esperas lograr - preparación académica, proyectos personales, desarrollo de habilidades",
      type: "textarea",
      icon: "🎯"
    },
    {
      id: "passionateTopics",
      question: "Temas que realmente te apasionan: (Elige 3-5)",
      type: "multiple",
      max: 5,
      min: 3,
      options: [
        { value: "law", label: "Derecho internacional y relaciones globales" },
        { value: "politics", label: "Ciencias políticas y geopolítica" },
        { value: "history", label: "Historia y análisis de contextos" },
        { value: "tech", label: "Tecnología e innovación disruptiva" },
        { value: "environment", label: "Medio ambiente y sostenibilidad" },
        { value: "economy", label: "Economía y comercio internacional" },
        { value: "security", label: "Seguridad y defensa global" },
        { value: "cultures", label: "Culturas y sociedades contemporáneas" }
      ],
      icon: "🌟"
    },
    {
      id: "knowledgeContext",
      question: "¿Para qué contexto principal usarás este conocimiento?",
      type: "single",
      options: [
        { value: "academic", label: "Académico - para mis estudios y preparación" },
        { value: "professional", label: "Profesional - desarrollo de carrera futura" },
        { value: "personal", label: "Personal - crecimiento y cultura general" },
        { value: "projects", label: "Proyectos - aplicaciones específicas" },
        { value: "mixed", label: "Mixto - múltiples propósitos" }
      ],
      icon: "🎓"
    },
    {
      id: "communicationStyle",
      question: "¿Cómo prefieres que me comunique contigo?",
      type: "single",
      options: [
        { value: "direct", label: "Directo - lenguaje técnico y preciso" },
        { value: "narrative", label: "Narrativo - explicaciones con contexto y ejemplos" },
        { value: "collaborative", label: "Colaborativo - como un compañero de aprendizaje" },
        { value: "structured", label: "Estructurado - enfoque metódico y organizado" }
      ],
      icon: "💬"
    },
    {
      id: "autonomyLevel",
      question: "Nivel de autonomía que deseas en el aprendizaje:",
      type: "single",
      options: [
        { value: "guided", label: "Guiado - prefiero que dirijas el proceso" },
        { value: "collaborative", label: "Colaborativo - decisiones compartidas" },
        { value: "autonomous", label: "Autónomo - yo tomo las decisiones principales" },
        { value: "adaptive", label: "Adaptativo - que ajustes según mi progreso" }
      ],
      icon: "🎨"
    },
    {
      id: "language",
      question: "Idioma preferido para nuestras conversaciones:",
      type: "single",
      options: [
        { value: "spanish", label: "Español" },
        { value: "english", label: "Inglés" },
        { value: "both", label: "Ambos - intercambiando según el tema" }
      ],
      icon: "🌐"
    }
  ];

  const questions: Question[] = ageGroup === "7-12" ? questions712 : questions1217;
  const currentQuestion = questions[step];

  const getInteractionMessage = (questionId: string, answer: any) => {
    const interactions: Record<string, string[]> = {
      description: [
        "¡Genial conocerte! 🌟 Cada persona es única y especial.",
        "¡Qué interesante! 🎉 Me encanta saber más sobre ti.",
        "¡Excelente! 👏 Vamos a aprender muchísimo juntos."
      ],
      interests: [
        "¡Wow! Esos temas son fascinantes 🚀 Hay tanto por descubrir.",
        "¡Excelente elección! 🌟 Vamos a explorar juntos esos temas.",
        "¡Me encanta! 🎯 Aprenderemos cosas increíbles."
      ],
      learningStyle: [
        "¡Perfecto! 📚 Ahora sé cómo ayudarte mejor a aprender.",
        "¡Genial! 🎨 Vamos a usar tu forma favorita de aprender.",
        "¡Excelente! 🎯 Tu estilo de aprendizaje es único."
      ]
    };

    const messages = interactions[questionId] || [
      "¡Muy bien! ✨ Sigamos conociendonos.",
      "¡Perfecto! 🎯 Cada respuesta me ayuda a conocerte mejor.",
      "¡Genial! 🌟 Vamos avanzando."
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  };

  const handleNext = async () => {
    if (!currentAnswer && multipleChoices.length === 0) return;

    let value: string | number | string[] = currentAnswer;
    if (currentQuestion.type === "multiple" || currentQuestion.type === "ranking") {
      value = multipleChoices;
    } else if (currentQuestion.type === "number") {
      const age = parseInt(currentAnswer);
      if (age >= 7 && age <= 12) {
        setAgeGroup("7-12");
      } else if (age >= 12 && age <= 17) {
        setAgeGroup("12-17");
      }
      value = age;
    }

    setStarterData({ ...starterData, [currentQuestion.id]: value });

    // Mostrar interacción
    setShowInteraction(true);
    setInteractionMessage(getInteractionMessage(currentQuestion.id, value));

    setTimeout(() => {
      setShowInteraction(false);
      setCurrentAnswer("");
      setMultipleChoices([]);

      if (step < questions.length - 1) {
        setStep(step + 1);
      } else {
        // Enviar datos al servidor
        handleSubmit();
      }
    }, 2500);
  };

  const handleSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión primero",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Enviar al webhook
      await supabase.functions.invoke("webhook-integration", {
        body: {
          user_id: user.id,
          type: "starter_profile",
          data: starterData
        }
      });

      // Marcar starter como completado
      await supabase
        .from("profiles")
        .update({ starter_completed: true })
        .eq("id", user.id);

      toast({
        title: "¡Perfecto! ✨",
        description: "Tu perfil ha sido creado. ¡Comencemos a aprender juntos!",
      });

      // Verificar si es admin o estudiante
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roles?.some(r => r.role === "admin")) {
        navigate("/admin");
      } else {
        navigate("/chat");
      }
    } catch (error) {
      console.error("Error al enviar starter:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al crear tu perfil",
        variant: "destructive",
      });
    }
  };

  const handleMultipleChoice = (value: string) => {
    if (multipleChoices.includes(value)) {
      setMultipleChoices(multipleChoices.filter(v => v !== value));
    } else {
      const max = currentQuestion.max || 999;
      if (multipleChoices.length < max) {
        setMultipleChoices([...multipleChoices, value]);
      }
    }
  };

  const handleRankingChange = (value: string, rank: number) => {
    const newRanking = [...multipleChoices];
    newRanking[rank - 1] = value;
    setMultipleChoices(newRanking);
  };

  const canProceed = () => {
    if (currentQuestion.type === "multiple") {
      const min = currentQuestion.min || currentQuestion.max || 1;
      return multipleChoices.length >= min;
    }
    if (currentQuestion.type === "ranking") {
      return multipleChoices.filter(Boolean).length === currentQuestion.options.length;
    }
    return currentAnswer.trim() !== "";
  };

  if (showInteraction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center animate-in fade-in zoom-in duration-500">
          <div className="text-6xl mb-6">✨</div>
          <p className="text-2xl font-medium text-foreground">{interactionMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Pregunta {step + 1} de {questions.length}
          </p>
        </div>

        {/* Question card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{currentQuestion.icon}</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {currentQuestion.question}
            </h2>
          </div>

          {/* Answer input based on type */}
          <div className="space-y-4">
            {currentQuestion.type === "number" && (
              <Input
                type="number"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Tu edad"
                className="text-lg text-center"
                min={7}
                max={17}
              />
            )}

            {currentQuestion.type === "textarea" && (
              <Textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="min-h-[150px] text-base"
              />
            )}

            {currentQuestion.type === "single" && (
              <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer}>
                <div className="space-y-3">
                  {currentQuestion.options?.map((option) => (
                    <div key={option.value} className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {currentQuestion.type === "multiple" && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option) => (
                  <div 
                    key={option.value}
                    onClick={() => handleMultipleChoice(option.value)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      multipleChoices.includes(option.value)
                        ? "bg-primary/10 border-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        multipleChoices.includes(option.value)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground"
                      }`}>
                        {multipleChoices.includes(option.value) && (
                          <div className="text-primary-foreground text-xs">✓</div>
                        )}
                      </div>
                      <Label className="flex-1 cursor-pointer text-base">
                        {option.label}
                      </Label>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-center">
                  Seleccionadas: {multipleChoices.length} / {currentQuestion.max}
                </p>
              </div>
            )}

            {currentQuestion.type === "ranking" && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, index) => (
                  <div key={option.value} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                    <Input
                      type="number"
                      min={1}
                      max={currentQuestion.options.length}
                      placeholder="#"
                      className="w-16 text-center"
                      value={multipleChoices.findIndex(v => v === option.value) + 1 || ""}
                      onChange={(e) => {
                        const rank = parseInt(e.target.value);
                        if (rank >= 1 && rank <= currentQuestion.options.length) {
                          handleRankingChange(option.value, rank);
                        }
                      }}
                    />
                    <Label className="flex-1 text-base">{option.label}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-4 mt-8">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
              >
                ← Anterior
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1"
            >
              {step === questions.length - 1 ? "Finalizar ✨" : "Siguiente →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Starter;
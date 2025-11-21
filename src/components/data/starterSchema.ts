// src/data/starterSchema.ts

export interface StarterOption {
  value: string;
  label: string;
}

export interface StarterQuestion {
  id: string;
  question: string;
  type: "number" | "textarea" | "single" | "multiple" | "ranking";
  icon?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: StarterOption[];
  group: "basic" | "learning" | "interests";
}

export const starterSchema: Record<string, StarterQuestion[]> = {
  "7-12": [
    // ---------------- BASIC ----------------
    {
      id: "age",
      question: "¿Cuántos años tienes?",
      type: "number",
      group: "basic",
    },
    {
      id: "description",
      question: "NOS CONOCEMOS!! Cuéntame sobre ti 🎯",
      type: "textarea",
      placeholder:
        "Por ejemplo: Soy Salvador, tengo 9 años, curso el 4to grado...",
      group: "basic",
    },
    {
      id: "uniqueData",
      question: "TUS DATOS INTERESANTES:",
      type: "textarea",
      placeholder:
        "Cuéntame algo que creas que debo saber para ser el mejor tutor...",
      group: "basic",
    },

    // ---------------- LEARNING ----------------
    {
      id: "learningStyle",
      question: "¿Qué te ayuda más a entender? (Elige 2)",
      type: "multiple",
      max: 2,
      group: "learning",
      options: [
        { value: "audio", label: "Escuchar explicaciones 🔊" },
        { value: "visual", label: "Ver dibujos/videos 🎨" },
        { value: "hands", label: "Hacer actividades ✋" },
        { value: "reading", label: "Leer y escribir 📖" },
        { value: "games", label: "Jugar y moverme 🎮" },
        { value: "friends", label: "Trabajar con amigos 👫" },
      ],
    },
    {
      id: "challenges",
      question: "Cuando algo es difícil, tú: (Elige 2)",
      type: "multiple",
      max: 2,
      group: "learning",
      options: [
        { value: "ask", label: "Preguntas a alguien ❓" },
        { value: "solo", label: "Intentas solo 🧠" },
        { value: "clues", label: "Buscas pistas 🔍" },
        { value: "rest", label: "Descansas ⏸️" },
      ],
    },
    {
      id: "contentPreference",
      question: "Ordena del 1 al 4:",
      type: "ranking",
      group: "learning",
      options: [
        { value: "videos", label: "Videos divertidos 🎥" },
        { value: "games", label: "Juegos 🎯" },
        { value: "audio", label: "Audios e historias 🎧" },
        { value: "texts", label: "Textos con dibujos 📝" },
      ],
    },
    {
      id: "studyTime",
      question: "¿Cuánto tiempo te gusta estudiar?",
      type: "single",
      group: "learning",
      options: [
        { value: "15-20", label: "15-20 minutos" },
        { value: "25-35", label: "25-35 minutos" },
        { value: "40-50", label: "40-50 minutos" },
        { value: "depends", label: "Depende de lo divertido" },
      ],
    },
    {
      id: "learningGoal",
      question: "¿Para qué quieres aprender conmigo?",
      type: "multiple",
      max: 3,
      group: "learning",
      options: [
        { value: "interesting", label: "Saber más cosas" },
        { value: "school", label: "Mejorar en el colegio" },
        { value: "smart", label: "Ser más listo" },
        { value: "enjoy", label: "Me gusta aprender" },
        { value: "friends", label: "Contarle a mis amigos" },
      ],
    },
    {
      id: "feelings",
      question: "Cuando no entiendes algo, te sientes:",
      type: "single",
      group: "learning",
      options: [
        { value: "calm", label: "Tranquilo 😊" },
        { value: "confused", label: "Confundido 😐" },
        { value: "frustrated", label: "Frustrado 😟" },
        { value: "help", label: "Pido ayuda 😊" },
      ],
    },
    {
      id: "explanationStyle",
      question: "Me gusta que me expliquen:",
      type: "multiple",
      max: 2,
      group: "learning",
      options: [
        { value: "examples", label: "Con ejemplos" },
        { value: "direct", label: "Directo al punto" },
        { value: "game", label: "Como un juego" },
        { value: "adventure", label: "Como aventura" },
      ],
    },
    {
      id: "language",
      question: "Idioma preferido",
      type: "single",
      group: "learning",
      options: [
        { value: "english", label: "Inglés" },
        { value: "spanish", label: "Español" },
        { value: "both", label: "Ambos" },
      ],
    },

    // ---------------- INTERESTS ----------------
    {
      id: "interests",
      question: "¿Qué temas te gustan? (3)",
      type: "multiple",
      max: 3,
      group: "interests",
      options: [
        { value: "ships", label: "Barcos ⚓" },
        { value: "countries", label: "Países 🌍" },
        { value: "animals", label: "Animales 🐠" },
        { value: "stories", label: "Historias 📚" },
        { value: "how", label: "Cómo funcionan cosas 🔧" },
        { value: "puzzles", label: "Acertijos 🧩" },
      ],
    },
  ],

  // ------------------------ 12-17 ------------------------
  "12-17": [
    // BASIC
    {
      id: "age",
      question: "¿Cuántos años tienes?",
      type: "number",
      group: "basic",
    },
    {
      id: "description",
      question: "PRESENTACIÓN PERSONAL",
      type: "textarea",
      placeholder: "Por ejemplo: Soy María, tengo 15 años...",
      group: "basic",
    },
    {
      id: "uniqueCharacteristics",
      question: "TUS CARACTERÍSTICAS ÚNICAS",
      type: "textarea",
      placeholder: "Por ejemplo: Tengo TDAH, tomo medicación...",
      group: "basic",
    },

    // LEARNING
    {
      id: "learningStyle",
      question: "¿Cómo aprendes mejor? (Elige 2)",
      type: "multiple",
      max: 2,
      group: "learning",
      options: [
        { value: "auditory", label: "Auditivo" },
        { value: "visual", label: "Visual" },
        { value: "kinesthetic", label: "Kinestésico" },
        { value: "reading", label: "Lectura" },
        { value: "social", label: "Social" },
        { value: "reflective", label: "Reflexivo" },
      ],
    },
    {
      id: "problemApproach",
      question: "Cuando enfrentas un problema, sueles ser:",
      type: "single",
      group: "learning",
      options: [
        { value: "analytical", label: "Analítico" },
        { value: "global", label: "Global" },
        { value: "methodical", label: "Metódico" },
        { value: "intuitive", label: "Intuitivo" },
        { value: "collaborative", label: "Colaborativo" },
        { value: "experimental", label: "Experimental" },
      ],
    },
    {
      id: "contentPreference",
      question: "Ordena por preferencia:",
      type: "ranking",
      group: "learning",
      options: [
        { value: "videos", label: "Videos 🎥" },
        { value: "exercises", label: "Ejercicios 🎯" },
        { value: "audio", label: "Podcasts 🎧" },
        { value: "texts", label: "Textos 📚" },
        { value: "infographics", label: "Infografías 🗺️" },
        { value: "dialogues", label: "Debates 💬" },
      ],
    },
    {
      id: "challengeTolerance",
      question: "¿Cómo manejas desafíos?",
      type: "single",
      group: "learning",
      options: [
        { value: "low", label: "Baja tolerancia" },
        { value: "medium", label: "Media" },
        { value: "high", label: "Alta" },
        { value: "variable", label: "Variable" },
      ],
    },
    {
      id: "sessionDuration",
      question: "Duración ideal de sesiones",
      type: "single",
      group: "learning",
      options: [
        { value: "25-35", label: "25-35 min" },
        { value: "40-55", label: "40-55 min" },
        { value: "60-80", label: "60-80 min" },
        { value: "flexible", label: "Flexible" },
      ],
    },
    {
      id: "learningGoals",
      question: "Metas de aprendizaje (6 meses)",
      type: "textarea",
      group: "learning",
    },
    {
      id: "passionateTopics",
      question: "Temas que te apasionan (3-5)",
      type: "multiple",
      min: 3,
      max: 5,
      group: "interests",
      options: [
        { value: "law", label: "Derecho" },
        { value: "politics", label: "Política" },
        { value: "history", label: "Historia" },
        { value: "tech", label: "Tecnología" },
        { value: "environment", label: "Medio ambiente" },
        { value: "economy", label: "Economía" },
        { value: "security", label: "Seguridad" },
        { value: "cultures", label: "Culturas" },
      ],
    },
    {
      id: "knowledgeContext",
      question: "¿Para qué usarás este conocimiento?",
      type: "single",
      group: "learning",
      options: [
        { value: "academic", label: "Académico" },
        { value: "professional", label: "Profesional" },
        { value: "personal", label: "Personal" },
        { value: "projects", label: "Proyectos" },
        { value: "mixed", label: "Mixto" },
      ],
    },
    {
      id: "communicationStyle",
      question: "¿Cómo prefieres que te hable?",
      type: "single",
      group: "learning",
      options: [
        { value: "direct", label: "Directo" },
        { value: "narrative", label: "Narrativo" },
        { value: "collaborative", label: "Colaborativo" },
        { value: "structured", label: "Estructurado" },
      ],
    },
    {
      id: "autonomyLevel",
      question: "Nivel de autonomía",
      type: "single",
      group: "learning",
      options: [
        { value: "guided", label: "Guiado" },
        { value: "collaborative", label: "Colaborativo" },
        { value: "autonomous", label: "Autónomo" },
        { value: "adaptive", label: "Adaptativo" },
      ],
    },
    {
      id: "language",
      question: "Idioma preferido",
      type: "single",
      group: "learning",
      options: [
        { value: "spanish", label: "Español" },
        { value: "english", label: "Inglés" },
        { value: "both", label: "Ambos" },
      ],
    },

    // INTERESTS (12-17)
    {
      id: "interests",
      question: "Temas de interés",
      type: "multiple",
      max: 5,
      group: "interests",
      options: [
        { value: "law", label: "Derecho" },
        { value: "tech", label: "Tecnología" },
        { value: "environment", label: "Ambiente" },
        { value: "history", label: "Historia" },
        { value: "politics", label: "Política" },
        { value: "economy", label: "Economía" },
      ],
    },
  ],
};

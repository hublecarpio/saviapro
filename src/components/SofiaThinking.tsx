import { useState, useEffect } from "react";
import sofiSinPiensa from "@/assets/sofi_sin_piensa.png";
import sofiPiensa from "@/assets/sofi_piensa.png";

const THINKING_MESSAGES = [
  "Leyendo tu mensaje...",
  "Pensando la mejor forma de explicarte...",
  "Buscando la mejor estrategia...",
  "Analizando tu respuesta...",
  "Preparando algo especial...",
  "Organizando las ideas...",
  "Ya casi tengo tu respuesta...",
];

interface SofiaThinkingProps {
  compact?: boolean;
}

export const SofiaThinking = ({ compact = false }: SofiaThinkingProps) => {
  const [isThinking, setIsThinking] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const imgInterval = setInterval(() => {
      setIsThinking((prev) => !prev);
    }, 1800);
    return () => clearInterval(imgInterval);
  }, []);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(msgInterval);
  }, []);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(dotsInterval);
  }, []);

  if (compact) {
    return (
      <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
        <img
          src={sofiSinPiensa}
          alt="Sofia"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
            isThinking ? "opacity-0" : "opacity-100"
          }`}
        />
        <img
          src={sofiPiensa}
          alt="Sofia pensando"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
            isThinking ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
        <img
          src={sofiSinPiensa}
          alt="Sofia"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
            isThinking ? "opacity-0" : "opacity-100"
          }`}
        />
        <img
          src={sofiPiensa}
          alt="Sofia pensando"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
            isThinking ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          key={messageIndex}
          className="text-xs md:text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
        >
          {THINKING_MESSAGES[messageIndex]}{dots}
        </span>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/20 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
};

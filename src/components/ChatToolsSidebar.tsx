import { Paperclip, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  isRecording: boolean;
  onFileClick: () => void;
  onRecordToggle: () => void;
}

export const ChatToolsSidebar = ({ isLoading, isRecording, onFileClick, onRecordToggle }: ChatToolsSidebarProps) => {
  return (
    // border-l: Pone la línea a la izquierda (correcto para sidebar derecho)
    // h-full: Ocupa toda la altura
    <aside className="h-full w-16 md:w-20 border-l bg-card/30 backdrop-blur-sm flex flex-col gap-3 py-6 items-center shrink-0 z-20">
      {/* Botón: Adjuntar archivo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onFileClick}
        disabled={isLoading}
        className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
        title="Adjuntar archivo"
      >
        <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Archivo</span>
      </Button>

      {/* Botón: Grabar audio */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRecordToggle}
        disabled={isLoading && !isRecording}
        className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all ${
          isRecording ? "bg-destructive/10 border-destructive/20 border text-destructive hover:bg-destructive/20" : ""
        }`}
        title={isRecording ? "Detener grabación" : "Grabar audio"}
      >
        {isRecording ? (
          <MicOff className="h-5 w-5 animate-pulse text-destructive" />
        ) : (
          <Mic className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        <span
          className={`text-[9px] font-medium ${
            isRecording ? "text-destructive" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {isRecording ? "Parar" : "Audio"}
        </span>
      </Button>
    </aside>
  );
};

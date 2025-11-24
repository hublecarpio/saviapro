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
    <div className="h-full w-16 md:w-20 border-r bg-card/30 backdrop-blur-sm flex flex-col gap-3 py-6 items-center shrink-0">
      {/* Adjuntar archivo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onFileClick}
        disabled={isLoading}
        className="h-12 w-12 rounded-xl flex-col gap-1 hover:bg-accent/50 group"
        title="Adjuntar archivo"
      >
        <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="text-[9px] text-muted-foreground group-hover:text-foreground">Archivo</span>
      </Button>

      {/* Grabar audio */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRecordToggle}
        disabled={isLoading && !isRecording}
        className={`h-12 w-12 rounded-xl flex-col gap-1 hover:bg-accent/50 group ${
          isRecording ? "bg-destructive/10 border-destructive/20 border text-destructive" : ""
        }`}
        title={isRecording ? "Detener grabación" : "Grabar audio"}
      >
        {isRecording ? (
          <MicOff className="h-5 w-5 animate-pulse text-destructive" />
        ) : (
          <Mic className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        <span
          className={`text-[9px] ${
            isRecording ? "text-destructive font-medium" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {isRecording ? "Parar" : "Audio"}
        </span>
      </Button>
    </div>
  );
};

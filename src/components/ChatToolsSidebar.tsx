import { Paperclip, Mic, MicOff, Video, Podcast } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatToolsSidebarProps {
  isLoading: boolean;
  isRecording: boolean;
  onFileClick: () => void;
  onRecordToggle: () => void;
  hasMessages: boolean;
  onGenerateVideo: () => void;
  onGeneratePodcast: () => void;
}

export const ChatToolsSidebar = ({
  isLoading,
  isRecording,
  onFileClick,
  onRecordToggle,
  hasMessages,
  onGenerateVideo,
  onGeneratePodcast,
}: ChatToolsSidebarProps) => {
  return (
    // fixed: Sidebar fijo que no se mueve con el scroll
    // right-0: Posicionado en el lado derecho
    // top-[64px]: Empieza después del header (altura aproximada del NavBarUser)
    // h-[calc(100vh-64px)]: Altura desde el header hasta el final de la ventana
    <aside className="fixed right-0 top-[64px] h-[calc(100vh-64px)] w-16 md:w-20 border-l bg-card/30 backdrop-blur-sm flex flex-col gap-3 py-6 items-center shrink-0 z-20 overflow-y-auto">
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

      {/* Separador visual cuando hay mensajes */}
      {hasMessages && <div className="w-8 border-t border-border/50 my-1" />}

      {/* Botones: Generar resúmenes (solo cuando hay mensajes) */}
      {hasMessages && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateVideo}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar video resumen"
          >
            <Video className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Video</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onGeneratePodcast}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-accent/50 group transition-all"
            title="Generar podcast resumen"
          >
            <Podcast className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground">Podcast</span>
          </Button>
        </>
      )}
    </aside>
  );
};

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, LogOut, Sparkles, Loader2, Paperclip, Mic, MicOff, Video, Podcast, Brain, FileText, UserCog, FileUp, ExternalLink } from "lucide-react";

import { ChatToolsSidebar } from "@/components/ChatToolsSidebar";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { StarterProfileEditor } from "@/components/StarterProfileEditor";
import { destroyUser } from "@/hooks/useLogout";
import { NavBarUser } from "@/components/NavBarUser";
import { useUserStore } from "@/store/useUserStore";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  conversation_id: string;
}

interface MindMap {
  id: string;
  html_content: string;
  tema: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
}

type ChatItem = 
  | { type: 'message'; data: Message }
  | { type: 'mindmap'; data: MindMap };

const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();

  const user = useUserStore((s) => s.user);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedMindMap, setSelectedMindMap] = useState<MindMap | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook de grabación de audio
  const { isRecording, toggleRecording } = useAudioRecorder({
    webhookUrl: "https://webhook.hubleconsulting.com/webhook/c9763ae5-02d6-46e8-ab9e-7300d98756a0",
    onTranscriptionReceived: (text) => {
      console.log("✅ Transcription received:", text);
      setTranscribedText(text);
    },
  });
  // Sincronizar conversationId de la URL con el estado
  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    } else {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [conversationId]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, mindMaps]);

  // Combinar mensajes y mapas mentales en un solo array ordenado
  useEffect(() => {
    const messageItems: ChatItem[] = messages.map(msg => ({
      type: 'message' as const,
      data: msg
    }));

    const mindMapItems: ChatItem[] = mindMaps.map(map => ({
      type: 'mindmap' as const,
      data: map
    }));

    const combined = [...messageItems, ...mindMapItems].sort((a, b) => {
      const dateA = new Date(a.data.created_at).getTime();
      const dateB = new Date(b.data.created_at).getTime();
      return dateA - dateB;
    });

    setChatItems(combined);
  }, [messages, mindMaps]);

  // Verificar autenticación una sola vez al montar
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentUser(session.user);
      }
    };
    checkAuth();
  }, []);

  // Cargar mensajes y mapas mentales, suscribirse a realtime cuando hay conversationId
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      setMindMaps([]);
      return;
    }

    // Cargar mensajes existentes
    const loadInitialMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        toast.error("Error cargando mensajes");
        return;
      }

      setMessages((data || []) as Message[]);
    };

    // Cargar mapas mentales existentes
    const loadInitialMindMaps = async () => {
      const { data, error } = await supabase
        .from("mind_maps")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading mind maps:", error);
        return;
      }

      setMindMaps((data || []) as MindMap[]);
    };

    loadInitialMessages();
    loadInitialMindMaps();

    // Suscribirse a nuevos mensajes
    const channelName = `chat-${currentConversationId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          if (newMessage.role === "assistant") {
            setIsLoading(false);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mind_maps",
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          const newMindMap = payload.new as MindMap;
          setMindMaps((prev) => {
            if (prev.some((m) => m.id === newMindMap.id)) return prev;
            return [...prev, newMindMap];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId]);

  // Procesar transcripción de audio cuando llegue
  useEffect(() => {
    if (transcribedText && !isLoading) {
      console.log("📤 Sending transcribed text to chat:", transcribedText);
      handleSend(transcribedText);
      setTranscribedText(null); // Limpiar después de enviar
    }
  }, [transcribedText, isLoading]);

  const loadMessages = async (conversationId: string) => {
    console.log("Loading messages for conversation:", conversationId);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Error cargando mensajes");
      console.error("Error loading messages:", error);
      return;
    }

    console.log("Messages loaded:", data?.length);
    setMessages((data || []) as Message[]);
  };

  const createNewConversation = async (firstMessage?: string) => {
    if (!user) return null;

    const title = firstMessage
      ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "")
      : "Nueva conversación";

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: title,
      })
      .select()
      .single();

    if (error) {
      toast.error("Error creando conversación");
      console.error("Error creating conversation:", error);
      return null;
    }

    return data.id;
  };

  const handleNewConversation = () => {
    // Simplemente navegar a /chat sin conversationId
    navigate("/chat", { replace: true });
    setInput("");
  };

  const handleConversationSelect = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || !user || isLoading) return;

    setInput("");
    setIsLoading(true);

    try {
      let conversationId = currentConversationId;

      // Crear conversación si no existe (primer mensaje)
      if (!conversationId) {
        conversationId = await createNewConversation(textToSend);
        if (!conversationId) {
          toast.error("Error creando conversación");
          setIsLoading(false);
          return;
        }
        // Navegar a la nueva conversación
        navigate(`/chat/${conversationId}`, { replace: true });
        // Esperar a que se configure el realtime
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          message: textToSend,
          conversation_id: conversationId,
          user_id: user.id,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error enviando mensaje");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const processFile = async (file: File) => {
    if (!file || !user || isLoading) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(`Archivo: ${file.name}`);
      if (!conversationId) return;
      setCurrentConversationId(conversationId);
    }

    setIsLoading(true);
    toast.info(`Procesando archivo: ${file.name}`);

    try {
      const fileName = `${conversationId}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage.from("chat-files").createSignedUrl(fileName, 3600);

      if (!urlData?.signedUrl) throw new Error("No se pudo generar URL del archivo");

      const { data, error } = await supabase.functions.invoke("webhook-integration", {
        body: {
          type: "file",
          data: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            url: urlData.signedUrl,
          },
        },
      });

      if (error) throw error;

      const response =
        data?.respuesta ||
        data?.response?.respuesta ||
        data?.response?.mensaje ||
        data?.response?.text ||
        data?.response?.message ||
        data?.response?.content;

      if (response) {
        toast.success("Archivo procesado, generando respuesta...");

        const { error: chatError } = await supabase.functions.invoke("chat", {
          body: {
            message: response,
            conversation_id: conversationId,
            user_id: user.id,
          },
        });

        if (chatError) throw chatError;
      } else {
        console.error("Respuesta del webhook sin contenido:", data);
        toast.error("El webhook respondió pero sin contenido");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error procesando el archivo");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const pollForMediaUrl = async (
    webhookUrl: string,
    maxAttempts: number = 20,
    interval: number = 3000,
  ): Promise<string | null> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(webhookUrl);
        if (!response.ok) continue;

        const data = await response.json();
        const mediaUrl = data?.response || data?.url || data?.data?.url || data?.data?.response;

        if (mediaUrl) {
          return mediaUrl;
        }

        // Esperar antes del siguiente intento
        await new Promise((resolve) => setTimeout(resolve, interval));
      } catch (error) {
        console.error("Error polling for media URL:", error);
      }
    }
    return null;
  };

  const handleGenerateResumen = async (type: "video" | "podcast") => {
    if (!currentConversationId || messages.length === 0 || isLoading) {
      toast.error("No hay conversación para resumir");
      return;
    }

    setIsLoading(true);

    try {
      // Insertar mensaje de carga en el chat
      const { data: loadingMessage, error: loadingError } = await supabase
        .from("messages")
        .insert({
          conversation_id: currentConversationId,
          user_id: user!.id,
          role: "assistant",
          message: `⏳ Generando ${type === "video" ? "video" : "podcast"} resumen... Por favor espera.`,
        })
        .select()
        .single();

      if (loadingError) throw loadingError;

      // Crear resumen de la conversación
      const conversationSummary = messages
        .map((msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.message}`)
        .join("\n\n");

      const response = await fetch("https://webhook.hubleconsulting.com/webhook/1fba6f6e-3c2f-4c50-bfbe-488df7c7eebc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          data: {
            conversation_id: currentConversationId,
            resumen: conversationSummary,
            total_mensajes: messages.length,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en webhook: ${response.status}`);
      }

      const webhookData = await response.json();
      console.log("Respuesta inicial del webhook:", webhookData);

      // Verificar diferentes estructuras posibles de respuesta
      let mediaUrl = webhookData?.response || webhookData?.url || webhookData?.data?.url || webhookData?.data?.response;
      const pollUrl = webhookData?.poll_url || webhookData?.data?.poll_url;

      // Si no hay URL pero hay una URL de polling, consultar periódicamente
      if (!mediaUrl && pollUrl) {
        toast.info("Procesando... esto puede tardar un momento");
        mediaUrl = await pollForMediaUrl(pollUrl);
      }

      // Eliminar mensaje de carga
      await supabase.from("messages").delete().eq("id", loadingMessage.id);

      if (!mediaUrl) {
        // Si después del polling no hay URL, mostrar mensaje de error
        await supabase.from("messages").insert({
          conversation_id: currentConversationId,
          user_id: user!.id,
          role: "assistant",
          message: `⚠️ La generación del ${type === "video" ? "video" : "podcast"} está tomando más tiempo del esperado. Por favor intenta de nuevo más tarde.`,
        });

        toast.error("Tiempo de espera agotado");
      } else {
        // Si hay URL, mostrar el resultado
        const resultMessage =
          type === "video"
            ? `✅ Video resumen generado:\n\n${mediaUrl}`
            : `✅ Podcast resumen generado:\n\n${mediaUrl}`;

        await supabase.from("messages").insert({
          conversation_id: currentConversationId,
          user_id: user!.id,
          role: "assistant",
          message: resultMessage,
        });

        toast.success(`${type === "video" ? "Video" : "Podcast"} generado exitosamente`);
      }
    } catch (error) {
      console.error("Error generating resumen:", error);
      toast.error("Error al generar el resumen");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestMindMap = () => {
    if (!currentConversationId || messages.length === 0 || isLoading) {
      toast.error("No hay conversación para crear un mapa mental");
      return;
    }
    handleSend("Por favor, genera un mapa mental del tema que hemos estado discutiendo");
  };

  const handleRequestInforme = () => {
    if (!currentConversationId || messages.length === 0 || isLoading) {
      toast.error("No hay conversación para generar un informe");
      return;
    }
    handleSend("Por favor, genera un informe completo de nuestra conversación");
  };

  console.log(user);
  if (!user || !user.id) {
    return (
      <div className="flex min-h-screen w-full bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar
          user={user}
          currentConversationId={currentConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
        />

        <div className="flex flex-col flex-1 w-full overflow-hidden h-screen">
          {/* Header Fijo */}
          <NavBarUser user={user} setShowProfileEditor={setShowProfileEditor} isSigningOut={isSigningOut} />

          {/* Messages Area con scroll propio */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden relative w-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-primary">
                <div className="text-center">
                  <Paperclip className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <p className="text-lg font-semibold text-foreground">Suelta el archivo aquí</p>
                  <p className="text-sm text-muted-foreground">Se procesará automáticamente</p>
                </div>
              </div>
            )}
            <div className="max-w-5xl mx-auto px-3 md:px-6 md:pr-24 py-4 md:py-8 w-full">
              {chatItems.length === 0 ? (
                <div className="space-y-6 md:space-y-8 py-6 md:py-12">
                  <div className="text-center space-y-2 md:space-y-3">
                    <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3 md:mb-4">
                      <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                    </div>
                    <h2 className="text-xl md:text-3xl font-semibold text-foreground px-4">Bienvenido a BIEX</h2>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-6">
                  {chatItems.map((item) => {
                    if (item.type === 'message') {
                      const msg = item.data;
                      // Detectar si el mensaje contiene una URL de video/audio/pdf
                      const urlMatch = msg.message.match(/(https?:\/\/[^\s]+)/);
                      const hasMedia =
                        urlMatch && (msg.message.includes("Video resumen") || msg.message.includes("Podcast resumen"));
                      const hasPdf = urlMatch && msg.message.includes("📄");
                      const isVideo = msg.message.includes("Video resumen");

                      return (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                           <div
                            className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 overflow-hidden ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm"
                            }`}
                          >
                            {hasPdf && urlMatch ? (
                              <div className="space-y-3">
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                  {msg.message.split(urlMatch[0])[0]}
                                </p>
                                <Button
                                  onClick={async () => {
                                    try {
                                      toast.info("Descargando PDF...");
                                      const response = await fetch(urlMatch[0], {
                                        mode: "cors",
                                        credentials: "omit",
                                      });

                                      if (!response.ok) {
                                        throw new Error("Error descargando el archivo");
                                      }

                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement("a");
                                      link.href = url;
                                      link.download = `Informe_SAVIA_${new Date().toISOString().split("T")[0]}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                      toast.success("¡PDF descargado!");
                                    } catch (error) {
                                      console.error("Error downloading PDF:", error);
                                      toast.error("Error al descargar. Intenta copiar el enlace manualmente");
                                    }
                                  }}
                                  className="w-full gap-2 h-auto py-4"
                                  size="lg"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M21 15 v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  Descargar Informe PDF
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                  Si el botón no funciona,{" "}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(urlMatch[0]);
                                      toast.success("¡Link copiado!");
                                    }}
                                    className="underline hover:text-foreground"
                                  >
                                    copia este enlace
                                  </button>
                                </p>
                              </div>
                             ) : hasMedia && urlMatch ? (
                              <div className="space-y-3 w-full overflow-hidden">
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                  {msg.message.split(urlMatch[0])[0]}
                                </p>
                                {isVideo ? (
                                  <video controls className="w-full rounded-lg max-h-[400px]" src={urlMatch[0]}>
                                    Tu navegador no soporta video HTML5.
                                  </video>
                                ) : (
                                  <audio controls className="w-full" src={urlMatch[0]}>
                                    Tu navegador no soporta audio HTML5.
                                  </audio>
                                )}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                {msg.message}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      // Renderizar mapa mental
                      const mindMap = item.data;
                      return (
                        <div key={mindMap.id} className="flex justify-start">
                          <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl overflow-hidden shadow-sm">
                            {/* Preview compacto del mapa */}
                            <div className="relative h-48 md:h-56 overflow-hidden bg-background/50">
                              <iframe
                                srcDoc={mindMap.html_content}
                                className="w-full h-full border-0 pointer-events-none scale-75 origin-top-left"
                                title={`Preview: ${mindMap.tema}`}
                                sandbox="allow-scripts allow-same-origin"
                                style={{ width: '133%', height: '133%' }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                            </div>

                            {/* Info y botones */}
                            <div className="flex items-center gap-3 p-3 md:p-4">
                              <Brain className="h-5 w-5 text-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm md:text-base font-medium text-foreground truncate">
                                  {mindMap.tema}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(mindMap.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMindMap(mindMap);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  Ver completo
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/mindmap/${currentConversationId}`)}
                                  title="Abrir en página completa"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 flex items-center gap-2 md:gap-3 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs md:text-sm text-muted-foreground">BIEX está analizando...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area Fijo */}
          <div className="border-t bg-background/30 backdrop-blur-md w-full shrink-0">
            <div className="max-w-5xl mx-auto px-3 md:px-6 md:pr-24 py-2 md:py-4 w-full">
              {/* Contenedor principal */}
              <div className="w-full rounded-2xl border bg-background shadow-sm flex flex-col transition-all duration-300 focus-within:border-primary focus-within:shadow-md">
                
                {/* MÓVIL: Botones arriba - Archivo/Audio izquierda, Herramientas derecha */}
                <div className="flex md:hidden items-center gap-1 px-2 pt-1.5 pb-1 border-b">
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="*/*" />
                  
                  {/* Botones izquierda: Archivo y Audio */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="h-7 w-7 rounded-lg hover:bg-accent/50"
                      title="Adjuntar archivo"
                    >
                      <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleRecording}
                      disabled={isLoading}
                      className={`h-7 w-7 rounded-full hover:bg-accent/50 transition-all ${
                        isRecording ? "bg-destructive hover:bg-destructive text-destructive-foreground animate-pulse" : ""
                      }`}
                      title={isRecording ? "Detener grabación" : "Iniciar grabación de audio"}
                    >
                      {isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  <span className="flex-1" />

                  {/* Botones derecha: Video, Podcast, Mapa Mental, Informe (solo si hay mensajes) */}
                  {messages.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleGenerateResumen("video")}
                        disabled={isLoading}
                        className="h-7 w-7 rounded-lg hover:bg-accent/50"
                        title="Generar video"
                      >
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleGenerateResumen("podcast")}
                        disabled={isLoading}
                        className="h-7 w-7 rounded-lg hover:bg-accent/50"
                        title="Generar podcast"
                      >
                        <Podcast className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRequestMindMap}
                        disabled={isLoading}
                        className="h-7 w-7 rounded-lg hover:bg-accent/50"
                        title="Solicitar mapa mental"
                      >
                        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRequestInforme}
                        disabled={isLoading}
                        className="h-7 w-7 rounded-lg hover:bg-accent/50"
                        title="Solicitar informe"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* INPUT + SEND BUTTON */}
                <div className="flex items-end gap-2 md:gap-3 w-full px-2 py-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder="Escribe tu consulta..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent shadow-none outline-none border-none text-[14px] md:text-[15px] leading-relaxed placeholder:text-muted-foreground/60 resize-none overflow-y-auto px-1 py-2 md:py-2.5 transition-all"
                    style={{
                      maxHeight: "120px",
                      minHeight: "36px",
                    }}
                  />

                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="h-8 w-8 md:h-11 md:w-11 rounded-xl shrink-0 bg-primary text-primary-foreground hover:bg-primary-hover transition-all"
                  >
                    <Send className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </div>

                {/* DESKTOP: Toolbar inferior con botones */}
                <div className="hidden md:flex items-center justify-between gap-2 text-xs text-muted-foreground/70 px-2 py-1.5 border-t">
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="*/*" />
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="h-8 w-8 rounded-lg hover:bg-accent/50"
                      title="Adjuntar archivo"
                    >
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleRecording}
                      disabled={isLoading}
                      className={`h-8 w-8 rounded-full hover:bg-accent/50 transition-all ${
                        isRecording ? "bg-destructive hover:bg-destructive text-destructive-foreground animate-pulse" : ""
                      }`}
                      title={isRecording ? "Detener grabación" : "Grabar audio"}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground/70">
                    Enter para enviar • Shift+Enter para nueva línea
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar derecho con herramientas - Solo Desktop/Tablet */}
        <ChatToolsSidebar
          isLoading={isLoading}
          hasMessages={messages.length > 0}
          onGenerateVideo={() => handleGenerateResumen("video")}
          onGeneratePodcast={() => handleGenerateResumen("podcast")}
          onRequestMindMap={handleRequestMindMap}
          onRequestInforme={handleRequestInforme}
        />
      </div>

      {/* Modal de edición de perfil */}
      {user && <StarterProfileEditor userId={user.id} open={showProfileEditor} onOpenChange={setShowProfileEditor} />}

      {/* Modal de mapa mental completo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[90vh] p-3 md:p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="text-sm md:text-base truncate">{selectedMindMap?.tema}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/mindmap/${currentConversationId}`)}
                className="gap-2 w-full md:w-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en página
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedMindMap && (
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <iframe
                srcDoc={selectedMindMap.html_content}
                className="w-full h-full border-0 rounded-lg"
                title={`Mapa mental: ${selectedMindMap.tema}`}
                sandbox="allow-scripts allow-same-origin"
                style={{ minHeight: '400px', maxHeight: '600px' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Chat;

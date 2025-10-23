import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, LogOut, Sparkles, Loader2, BookOpen, Target, Lightbulb, TrendingUp, Paperclip, Mic, MicOff, Video, Podcast } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  conversation_id: string;
}

const promptSuggestions = [
  {
    icon: BookOpen,
    title: "Analizar convocatoria",
    prompt: "Necesito ayuda para analizar una convocatoria de subvención y entender sus requisitos clave."
  },
  {
    icon: Target,
    title: "Diseñar estrategia",
    prompt: "Quiero diseñar una estrategia ganadora para una subvención. ¿Por dónde empiezo?"
  },
  {
    icon: Lightbulb,
    title: "Validar idea",
    prompt: "Tengo una idea de proyecto. ¿Me ayudas a validar su viabilidad y encontrar financiación?"
  },
  {
    icon: TrendingUp,
    title: "Mejorar propuesta",
    prompt: "¿Cómo puedo mejorar mi propuesta actual para aumentar las probabilidades de éxito?"
  }
];

const Chat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/");
        return;
      }
      
      setUser(session.user);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user || !currentConversationId) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentConversationId]);

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error("Error cargando mensajes");
      console.error('Error loading messages:', error);
      return;
    }

    setMessages((data || []) as Message[]);
  };

  const createNewConversation = async (firstMessage?: string) => {
    if (!user) return null;

    const title = firstMessage 
      ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '')
      : 'Nueva conversación';

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: title
      })
      .select()
      .single();

    if (error) {
      toast.error("Error creando conversación");
      console.error('Error creating conversation:', error);
      return null;
    }

    return data.id;
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
  };

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
    loadMessages(conversationId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || !user || isLoading) return;

    let conversationId = currentConversationId;
    
    // Create new conversation if needed
    if (!conversationId) {
      conversationId = await createNewConversation(textToSend);
      if (!conversationId) return;
      setCurrentConversationId(conversationId);
    }

    setInput("");
    setIsLoading(true);

    try {
      const { error } = await supabase.functions.invoke('chat', {
        body: { 
          message: textToSend,
          conversation_id: conversationId
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("El asistente está temporalmente fuera de servicio.");
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    handleSend(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        const { data, error } = await supabase.functions.invoke('webhook-integration', {
          body: {
            type: 'file',
            data: {
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              content: base64Data.split(',')[1],
            }
          }
        });

        if (error) throw error;

        // Extraer la transcripción del webhook
        const transcription = data?.respuesta || data?.response?.respuesta || data?.response?.mensaje || data?.response?.text || data?.response?.message;
        
        if (transcription) {
          toast.success("Archivo transcrito, generando respuesta...");
          
          // Enviar directamente al agente (él se encargará de guardar el mensaje del usuario)
          const { error: chatError } = await supabase.functions.invoke('chat', {
            body: { 
              message: transcription,
              conversation_id: conversationId
            }
          });
          
          if (chatError) throw chatError;
        } else {
          console.error('Respuesta del webhook sin texto:', data);
          toast.error("El webhook respondió pero sin contenido de texto");
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error("Error procesando el archivo");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Detectar el tipo MIME soportado por el navegador
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      
      console.log('Using MIME type:', mimeType);
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log('Audio blob created:', blob.size, 'bytes, type:', blob.type);
        await processAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info("Grabando audio...");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Error accediendo al micrófono. Verifica los permisos en Configuración > Safari > Micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    if (!user || isLoading) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation('Mensaje de audio');
      if (!conversationId) return;
      setCurrentConversationId(conversationId);
    }

    setIsLoading(true);
    toast.info("Procesando audio...");

    try {
      // Extraer el formato del audio (webm, mp4, ogg, etc.)
      const audioFormat = audioBlob.type.split('/')[1].split(';')[0];
      console.log('Processing audio format:', audioFormat, 'size:', audioBlob.size);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        const { data, error } = await supabase.functions.invoke('webhook-integration', {
          body: {
            type: 'audio',
            data: {
              audioFormat: audioFormat,
              content: base64Data.split(',')[1],
            }
          }
        });

        if (error) throw error;

        // Extraer la transcripción del webhook
        const transcription = data?.respuesta || data?.response?.respuesta || data?.response?.mensaje || data?.response?.text || data?.response?.message;
        
        if (transcription) {
          toast.success("Audio transcrito, generando respuesta...");
          
          // Enviar directamente al agente (él se encargará de guardar el mensaje del usuario)
          const { error: chatError } = await supabase.functions.invoke('chat', {
            body: { 
              message: transcription,
              conversation_id: conversationId
            }
          });
          
          if (chatError) throw chatError;
        } else {
          console.error('Respuesta del webhook sin texto:', data);
          toast.error("El webhook respondió pero sin contenido de texto");
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error("Error procesando el audio");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateResumen = async (type: 'video' | 'podcast') => {
    if (!currentConversationId || messages.length === 0 || isLoading) {
      toast.error("No hay conversación para resumir");
      return;
    }

    setIsLoading(true);
    
    try {
      // Insertar mensaje de carga en el chat
      const { data: loadingMessage, error: loadingError } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversationId,
          user_id: user!.id,
          role: 'assistant',
          message: `⏳ Generando ${type === 'video' ? 'video' : 'podcast'} resumen... Por favor espera.`
        })
        .select()
        .single();

      if (loadingError) throw loadingError;

      // Crear resumen de la conversación
      const conversationSummary = messages.map(msg => 
        `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.message}`
      ).join('\n\n');

      const response = await fetch('https://webhook.hubleconsulting.com/webhook/1fba6f6e-3c2f-4c50-bfbe-488df7c7eebc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data: {
            conversation_id: currentConversationId,
            resumen: conversationSummary,
            total_mensajes: messages.length,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Error en webhook: ${response.status}`);
      }

      const webhookData = await response.json();
      console.log('Respuesta del webhook:', webhookData);

      // Verificar diferentes estructuras posibles de respuesta
      const mediaUrl = webhookData?.response || webhookData?.url || webhookData?.data?.url || webhookData?.data?.response;

      if (!mediaUrl) {
        // Si no hay URL, mostrar mensaje de que está en proceso
        await supabase
          .from('messages')
          .delete()
          .eq('id', loadingMessage.id);

        await supabase
          .from('messages')
          .insert({
            conversation_id: currentConversationId,
            user_id: user!.id,
            role: 'assistant',
            message: `✅ Solicitud de ${type === 'video' ? 'video' : 'podcast'} enviada. El proceso puede tomar algunos minutos. Te notificaremos cuando esté listo.`
          });

        toast.success("Solicitud enviada exitosamente");
      } else {
        // Si hay URL, mostrar el resultado
        await supabase
          .from('messages')
          .delete()
          .eq('id', loadingMessage.id);

        const resultMessage = type === 'video' 
          ? `✅ Video resumen generado:\n\n${mediaUrl}`
          : `✅ Podcast resumen generado:\n\n${mediaUrl}`;

        await supabase
          .from('messages')
          .insert({
            conversation_id: currentConversationId,
            user_id: user!.id,
            role: 'assistant',
            message: resultMessage
          });

        toast.success(`${type === 'video' ? 'Video' : 'Podcast'} generado exitosamente`);
      }
    } catch (error) {
      console.error('Error generating resumen:', error);
      toast.error("Error al generar el resumen");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar 
          user={user}
          currentConversationId={currentConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
        />

        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <SidebarTrigger className="-ml-1" />
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base md:text-lg font-semibold text-foreground">
                      SAVIA
                    </h1>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Salir</span>
              </Button>
            </div>
          </header>

          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto relative"
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
            <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-8">
              {messages.length === 0 ? (
                <div className="space-y-6 md:space-y-8 py-6 md:py-12">
                  <div className="text-center space-y-2 md:space-y-3">
                    <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3 md:mb-4">
                      <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                    </div>
                    <h2 className="text-xl md:text-3xl font-semibold text-foreground px-4">
                      Bienvenido a SAVIA
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
                      Soy tu asistente de IA especializado en diseñar estrategias ganadoras
                      para subvenciones y convertir ideas en proyectos viables.
                    </p>
                  </div>

                  {/* Suggestion cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 max-w-3xl mx-auto px-3">
                    {promptSuggestions.map((suggestion, idx) => {
                      const Icon = suggestion.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion.prompt)}
                          className="group p-3 md:p-4 rounded-lg md:rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all duration-200 text-left"
                        >
                          <div className="flex items-start gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm md:text-base font-medium text-foreground mb-0.5 md:mb-1 group-hover:text-primary transition-colors">
                                {suggestion.title}
                              </h3>
                              <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {suggestion.prompt}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-6">
                  {messages.map((msg) => {
                    // Detectar si el mensaje contiene una URL de video/audio
                    const urlMatch = msg.message.match(/(https?:\/\/[^\s]+)/);
                    const hasMedia = urlMatch && (
                      msg.message.includes('Video resumen') || 
                      msg.message.includes('Podcast resumen')
                    );
                    const isVideo = msg.message.includes('Video resumen');
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm'
                          }`}
                        >
                          {hasMedia && urlMatch ? (
                            <div className="space-y-3">
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                {msg.message.split(urlMatch[0])[0]}
                              </p>
                              {isVideo ? (
                                <video 
                                  controls 
                                  className="w-full rounded-lg max-h-[400px]"
                                  src={urlMatch[0]}
                                >
                                  Tu navegador no soporta video HTML5.
                                </video>
                              ) : (
                                <audio 
                                  controls 
                                  className="w-full"
                                  src={urlMatch[0]}
                                >
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
                  })}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 flex items-center gap-2 md:gap-3 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs md:text-sm text-muted-foreground">SAVIA está analizando...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Resumen Buttons */}
          {messages.length > 0 && (
            <div className="border-t bg-card/30 backdrop-blur-sm">
              <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => handleGenerateResumen('video')}
                    disabled={isLoading}
                    className="gap-2 hover:bg-primary/10 hover:border-primary text-xs md:text-sm h-9 md:h-10"
                  >
                    <Video className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="truncate">Generar video resumen</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => handleGenerateResumen('podcast')}
                    disabled={isLoading}
                    className="gap-2 hover:bg-primary/10 hover:border-primary text-xs md:text-sm h-9 md:h-10"
                  >
                    <Podcast className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="truncate">Generar podcast resumen</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-card/50 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4">
              <div className="flex gap-2 md:gap-3 items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="h-10 w-10 md:h-[56px] md:w-[56px] rounded-lg md:rounded-xl shrink-0 p-0"
                  title="Adjuntar archivo"
                >
                  <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="default"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading && !isRecording}
                  className="h-10 w-10 md:h-[56px] md:w-[56px] rounded-lg md:rounded-xl shrink-0 p-0"
                  title={isRecording ? "Detener grabación" : "Grabar audio"}
                >
                  {isRecording ? <MicOff className="h-4 w-4 md:h-5 md:w-5" /> : <Mic className="h-4 w-4 md:h-5 md:w-5" />}
                </Button>
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Escribe tu consulta..."
                    className="min-h-[40px] md:min-h-[56px] max-h-[120px] md:max-h-[200px] resize-none rounded-lg md:rounded-xl border-border bg-background text-sm md:text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40 py-2.5 md:py-3"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="default"
                  className="h-10 w-10 md:h-[56px] md:w-[56px] rounded-lg md:rounded-xl shrink-0 bg-primary hover:bg-primary-hover p-0"
                >
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground/70 text-center mt-2 md:mt-3 leading-tight">
                <span className="hidden sm:inline">Adjunta archivos o graba audio • </span>
                <span className="sm:hidden">Archivos/audio • </span>
                Enter para enviar
                <span className="hidden sm:inline"> • Shift+Enter para nueva línea</span>
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground/50 text-center mt-1 md:mt-2">
                Desarrollado por Huble Consulting
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
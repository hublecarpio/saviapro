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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await processAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info("Grabando audio...");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Error accediendo al micrófono");
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
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        const { data, error } = await supabase.functions.invoke('webhook-integration', {
          body: {
            type: 'audio',
            data: {
              audioFormat: 'webm',
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
    toast.info(`Generando resumen en ${type}...`);

    try {
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

      toast.success(`Solicitud de resumen en ${type} enviada exitosamente`);
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
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="-ml-2" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">
                      SAVIA
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Salir
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
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
              {messages.length === 0 ? (
                <div className="space-y-8 py-12">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                      Bienvenido a SAVIA
                    </h2>
                    <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                      Soy tu asistente de IA especializado en diseñar estrategias ganadoras
                      para subvenciones y convertir ideas en proyectos viables.
                    </p>
                  </div>

                  {/* Suggestion cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                    {promptSuggestions.map((suggestion, idx) => {
                      const Icon = suggestion.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion.prompt)}
                          className="group p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all duration-200 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
                                {suggestion.title}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
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
                <div className="space-y-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-[hsl(var(--chat-assistant-border))] rounded-2xl px-5 py-4 flex items-center gap-3 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">SAVIA está analizando...</span>
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
              <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleGenerateResumen('video')}
                    disabled={isLoading}
                    className="gap-2 hover:bg-primary/10 hover:border-primary"
                  >
                    <Video className="h-5 w-5" />
                    Generar video resumen
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleGenerateResumen('podcast')}
                    disabled={isLoading}
                    className="gap-2 hover:bg-primary/10 hover:border-primary"
                  >
                    <Podcast className="h-5 w-5" />
                    Generar podcast resumen
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-card/50 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
              <div className="flex gap-3 items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="h-[56px] w-[56px] rounded-xl shrink-0"
                  title="Adjuntar archivo"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="lg"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading && !isRecording}
                  className="h-[56px] w-[56px] rounded-xl shrink-0"
                  title={isRecording ? "Detener grabación" : "Grabar audio"}
                >
                  {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Escribe tu consulta sobre estrategias y subvenciones..."
                    className="min-h-[56px] max-h-[200px] resize-none rounded-xl border-border bg-background pr-12 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="lg"
                  className="h-[56px] w-[56px] rounded-xl shrink-0 bg-primary hover:bg-primary-hover"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/70 text-center mt-3">
                Adjunta archivos o graba audio • Presiona Enter para enviar • Shift+Enter para nueva línea
              </p>
              <p className="text-xs text-muted-foreground/50 text-center mt-2">
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
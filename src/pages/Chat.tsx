import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, LogOut, Sparkles, Loader2, Paperclip, Mic, MicOff, Video, Podcast, Brain, FileText, UserCog, FileUp } from "lucide-react";

import { MindMapDisplay } from "@/components/MindMapDisplay";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { StarterProfileEditor } from "@/components/StarterProfileEditor";
import { destroyUser } from "@/hooks/useLogout";
import { NavBarUser } from "@/components/NavBarUser";
import { useUserStore } from "@/store/useUserStore";
interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  conversation_id: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();

  const user = useUserStore((s) => s.user);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
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
  }, [messages]);

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

  // Limpiar grabación al desmontar el componente
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          console.log("Cleaning up recording on unmount");
          mediaRecorder.stop();
        } catch (error) {
          console.error("Error cleaning up recorder:", error);
        }
      }
      // Limpiar stream si existe
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, [mediaRecorder]);

  // Cargar mensajes y suscribirse a realtime cuando hay conversationId
  useEffect(() => {
    if (!currentConversationId) {
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

    loadInitialMessages();

    // Suscribirse a nuevos mensajes
    const channelName = `messages-${currentConversationId}-${Date.now()}`;
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId]);

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

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast.error("La respuesta está tomando más tiempo del esperado");
    }, 30000);

    try {
      let conversationId = currentConversationId;

      // Crear conversación si no existe (primer mensaje)
      if (!conversationId) {
        conversationId = await createNewConversation(textToSend);
        if (!conversationId) {
          clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      clearTimeout(timeoutId);
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

  // Funciones de utilidad simplificadas para compatibilidad
  const checkMediaRecorderSupport = (): boolean => {
    // Solo bloquear si MediaRecorder no existe o es iOS Safari
    if (typeof MediaRecorder === "undefined") {
      return false;
    }

    // Bloquear solo iOS Safari (soporte muy limitado)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium/.test(navigator.userAgent);
    if (isIOS && isSafari) {
      return false;
    }

    return true;
  };

  const getSupportedMimeType = (): string | null => {
    // Intentar encontrar un tipo MIME soportado compatible con Google Speech-to-Text
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
      return null;
    }

    // Lista de tipos MIME ordenados por calidad y compatibilidad con Google Speech-to-Text
    const mimeTypes = [
      "audio/webm;codecs=opus", // Mejor calidad y compatibilidad
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4", // Fallback para Safari
      "audio/mpeg", // Fallback adicional
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log("✓ Using MIME type:", mimeType);
        return mimeType;
      }
    }

    // Si no se encuentra, permitir que el navegador use su tipo por defecto
    console.log("⚠ No MIME type found, using browser default");
    return null;
  };

  const startRecording = async () => {
    try {
      // Verificación básica de soporte
      if (!checkMediaRecorderSupport()) {
        toast.error("Tu navegador no soporta grabación de audio. Por favor, usa Chrome, Firefox o Edge.");
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Tu navegador no soporta acceso al micrófono");
        return;
      }

      console.log("🎤 Requesting microphone access...");

      // Constraints optimizados para mejor calidad y compatibilidad
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Alta calidad para mejor transcripción
        },
      });

      // Verificar que el stream tiene tracks activos
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No se detectó ninguna pista de audio en el stream");
      }

      console.log("✓ Microphone access granted. Active tracks:", audioTracks.length);
      console.log("📊 Track info:", {
        label: audioTracks[0].label,
        enabled: audioTracks[0].enabled,
        muted: audioTracks[0].muted,
        readyState: audioTracks[0].readyState
      });

      // Guardar referencia al stream para limpieza
      audioStreamRef.current = stream;

      // Obtener tipo MIME soportado
      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      const chunks: Blob[] = [];
      const recordingStartTime = Date.now();

      console.log("📹 Recorder initialized:", {
        mimeType: mimeType || recorder.mimeType,
        state: recorder.state
      });

      // Handler básico para errores del recorder
      recorder.onerror = (event: Event) => {
        console.error("❌ MediaRecorder error:", event);
        toast.error("Error en la grabación. Por favor, intenta de nuevo.");
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
        setIsRecording(false);
        setMediaRecorder(null);
      };

      // Handler para cuando hay datos disponibles
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          console.log(`📦 Chunk received: ${e.data.size} bytes (total: ${chunks.length} chunks)`);
        }
      };

      // Handler cuando se detiene la grabación
      recorder.onstop = async () => {
        const recordingDuration = Date.now() - recordingStartTime;
        console.log("⏹ Recording stopped");
        console.log(`⏱️ Recording duration: ${recordingDuration}ms`);
        console.log(`📊 Total chunks: ${chunks.length}, Total size: ${chunks.reduce((acc, c) => acc + c.size, 0)} bytes`);

        // Validar que se grabó por tiempo mínimo
        if (recordingDuration < 500) {
          console.error("❌ Recording too short:", recordingDuration, "ms");
          toast.error("⚠️ Grabación demasiado corta. Mantén presionado el botón al menos 1 segundo.");
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
          }
          setIsRecording(false);
          setMediaRecorder(null);
          return;
        }

        // Validar que hay chunks
        if (chunks.length === 0) {
          console.error("❌ No audio chunks captured");
          toast.error("⚠️ No se capturó audio. Asegúrate de que el micrófono funciona.");
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
          }
          setIsRecording(false);
          setMediaRecorder(null);
          return;
        }

        // Crear blob - usar tipo detectado
        const finalMimeType = mimeType || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: finalMimeType });
        console.log(`🎵 Audio blob created: ${blob.size} bytes, type: ${blob.type}`);

        // Validación de tamaño mínimo
        if (blob.size < 100) {
          console.error("❌ Audio blob too small or empty:", blob.size);
          toast.error("⚠️ Audio muy corto o vacío. Intenta hablar más cerca del micrófono.");
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
          }
          setIsRecording(false);
          setMediaRecorder(null);
          return;
        }

        // Procesar audio
        try {
          console.log("🔄 Processing audio...");
          await processAudio(blob);
        } catch (error) {
          console.error("❌ Error processing audio:", error);
          toast.error("Error procesando el audio");
        } finally {
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
          }
          setIsRecording(false);
          setMediaRecorder(null);
        }
      };

      // Iniciar grabación con timeslice para capturar datos de forma más continua
      recorder.start(250); // Capturar cada 250ms para mejor compatibilidad
      console.log("▶ Recording started");
      toast.success("🎤 Grabando... Mantén presionado y habla claramente", { duration: 5000 });

      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error: any) {
      console.error("❌ Error starting recording:", error);

      // Limpiar cualquier stream activo
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (error.stream) {
        error.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      // Mensajes de error simplificados
      let errorMessage = "No se pudo acceder al micrófono";

      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage = "Permiso denegado. Por favor, permite el acceso al micrófono en la configuración de tu navegador.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No se encontró ningún micrófono en tu dispositivo.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "El micrófono está siendo usado por otra aplicación.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder || !isRecording) {
      console.warn("⚠️ Attempted to stop recording but no active recorder found");
      return;
    }

    try {
      console.log("🛑 Attempting to stop recording. Current state:", mediaRecorder.state);
      
      // Verificar el estado del recorder antes de detener
      if (mediaRecorder.state === "recording") {
        console.log("⏹️ Stopping active recording...");
        mediaRecorder.stop();
        toast.info("⏸️ Procesando audio...");
      } else if (mediaRecorder.state === "paused") {
        // Si está pausado, reanudar y luego detener
        console.log("▶️ Resuming and stopping paused recording...");
        mediaRecorder.resume();
        mediaRecorder.stop();
      } else {
        console.warn(`⚠️ Recorder is in ${mediaRecorder.state} state, cannot stop`);
        toast.warning("La grabación ya finalizó");
        setIsRecording(false);
        setMediaRecorder(null);
      }
      // No establecer setIsRecording(false) aquí porque onstop se encargará de eso
    } catch (error: any) {
      console.error("❌ Error stopping recording:", error);
      toast.error("Error al detener la grabación");
      setIsRecording(false);
      setMediaRecorder(null);
      
      // Limpiar stream si existe
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    if (!user || isLoading) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation("Mensaje de audio");
      if (!conversationId) return;
      setCurrentConversationId(conversationId);
    }

    setIsLoading(true);
    toast.info("Transcribiendo audio con Google Speech-to-Text...");

    try {
      const audioFormat = audioBlob.type.split("/")[1].split(";")[0];
      console.log(`🎵 Processing audio: ${audioBlob.size} bytes, format: ${audioFormat}, type: ${audioBlob.type}`);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = event.target?.result as string;
          const base64Audio = base64Data.split(",")[1];

          console.log("📤 Sending to Google Speech-to-Text API...");

          const { data, error } = await supabase.functions.invoke("transcribe-audio", {
            body: {
              audioBase64: base64Audio,
              audioFormat: audioFormat,
            },
          });

          if (error) {
            console.error("❌ Transcription error:", error);
            throw error;
          }

          const transcription = data?.transcription;

          if (!transcription) {
            console.error("❌ No transcription received:", data);
            toast.error("No se pudo obtener la transcripción del audio");
            setIsLoading(false);
            return;
          }

          console.log("✅ Transcription received:", transcription);
          toast.success("Audio transcrito correctamente!");

          // Enviar la transcripción al chat
          console.log("💬 Sending transcription to chat...");
          const { error: chatError } = await supabase.functions.invoke("chat", {
            body: {
              message: transcription,
              conversation_id: conversationId,
              user_id: user.id,
            },
          });

          if (chatError) {
            console.error("❌ Chat error:", chatError);
            throw chatError;
          }

          console.log("✅ Message sent to chat successfully");

        } catch (innerError) {
          console.error("❌ Error processing audio response:", innerError);
          const errorMsg = innerError instanceof Error ? innerError.message : "Error procesando el audio";
          toast.error(errorMsg);
        } finally {
          setIsLoading(false);
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Error procesando el audio");
      setIsLoading(false);
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

        <div className="flex flex-col flex-1 w-full overflow-hidden">
          {/* Messages Area con Header Sticky */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden relative w-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Header Sticky */}
            <NavBarUser user={user} setShowProfileEditor={setShowProfileEditor} isSigningOut={isSigningOut} />
            
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
              {messages.length === 0 ? (
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
                  {messages.map((msg) => {
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
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
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
                  })}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 flex items-center gap-2 md:gap-3 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs md:text-sm text-muted-foreground">BIEX está analizando...</span>
                      </div>
                    </div>
                  )}

                  {/* Mapas mentales integrados en el flujo */}
                  {currentConversationId && <MindMapDisplay conversationId={currentConversationId} />}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t bg-background/30 backdrop-blur-md w-full">
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
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading && !isRecording}
                      className={`h-7 w-7 rounded-lg hover:bg-accent/50 ${
                        isRecording ? "bg-destructive/10 text-destructive" : ""
                      }`}
                      title={isRecording ? "Detener grabación" : "Grabar audio"}
                    >
                      {isRecording ? (
                        <MicOff className="h-3.5 w-3.5 animate-pulse" />
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
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading && !isRecording}
                      className={`h-8 w-8 rounded-lg hover:bg-accent/50 ${
                        isRecording ? "bg-destructive/10 text-destructive" : ""
                      }`}
                      title={isRecording ? "Detener grabación" : "Grabar audio"}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4 animate-pulse" />
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
      </div>

      {/* Modal de edición de perfil */}
      {user && <StarterProfileEditor userId={user.id} open={showProfileEditor} onOpenChange={setShowProfileEditor} />}
    </SidebarProvider>
  );
};

export default Chat;

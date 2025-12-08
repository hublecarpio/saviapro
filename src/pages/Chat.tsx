import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, LogOut, Sparkles, Loader2, Paperclip, Mic, MicOff, Video, Podcast, Brain, FileText, BookOpen, UserCog, FileUp, ExternalLink, Download } from "lucide-react";
import { ChatToolsSidebar } from "@/components/ChatToolsSidebar";
import { MobileChatToolsFAB } from "@/components/MobileChatToolsFAB";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { StarterProfileEditor } from "@/components/StarterProfileEditor";
import { FichasDidacticas } from "@/components/FichasDidacticas";
import { destroyUser } from "@/hooks/useLogout";
import { NavBarUser } from "@/components/NavBarUser";
import { useUserStore } from "@/store/useUserStore";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { SofiaThinking } from "@/components/SofiaThinking";
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
interface FichasSet {
  id: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
  fichas: Array<{
    pregunta: string;
    respuesta: string;
    orden: number;
  }>;
}
type ChatItem = {
  type: 'message';
  data: Message;
} | {
  type: 'mindmap';
  data: MindMap;
} | {
  type: 'fichas';
  data: FichasSet;
};
const Chat = () => {
  const navigate = useNavigate();
  const {
    conversationId
  } = useParams<{
    conversationId: string;
  }>();
  const user = useUserStore(s => s.user);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [fichasSets, setFichasSets] = useState<FichasSet[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showFichas, setShowFichas] = useState(false);
  const [selectedFichasId, setSelectedFichasId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedMindMap, setSelectedMindMap] = useState<MindMap | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [isGeneratingInforme, setIsGeneratingInforme] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isGeneratingFichas, setIsGeneratingFichas] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingTranscriptionRef = useRef(false);

  // Hook de grabación de audio
  const {
    isRecording,
    toggleRecording
  } = useAudioRecorder({
    webhookUrl: "https://webhook.hubleconsulting.com/webhook/c9763ae5-02d6-46e8-ab9e-7300d98756a0",
    onTranscriptionReceived: text => {
      console.log("✅ Transcription received:", text);
      setTranscribedText(text);
    }
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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, mindMaps, fichasSets]);

  // Combinar mensajes, mapas mentales y fichas en un solo array ordenado
  useEffect(() => {
    const messageItems: ChatItem[] = messages.map(msg => ({
      type: 'message' as const,
      data: msg
    }));
    const mindMapItems: ChatItem[] = mindMaps.map(map => ({
      type: 'mindmap' as const,
      data: map
    }));
    const fichasItems: ChatItem[] = fichasSets.map(fichasSet => ({
      type: 'fichas' as const,
      data: fichasSet
    }));
    const combined = [...messageItems, ...mindMapItems, ...fichasItems].sort((a, b) => {
      const dateA = new Date(a.data.created_at).getTime();
      const dateB = new Date(b.data.created_at).getTime();
      return dateA - dateB;
    });
    setChatItems(combined);
  }, [messages, mindMaps, fichasSets]);

  // Verificar autenticación una sola vez al montar
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
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
      setFichasSets([]);
      return;
    }

    // Cargar mensajes existentes
    const loadInitialMessages = async () => {
      const {
        data,
        error
      } = await supabase.from("messages").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (error) {
        console.error("Error loading messages:", error);
        toast.error("Error cargando mensajes");
        return;
      }
      setMessages((data || []) as Message[]);
    };

    // Cargar mapas mentales existentes
    const loadInitialMindMaps = async () => {
      const {
        data,
        error
      } = await supabase.from("mind_maps").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (error) {
        console.error("Error loading mind maps:", error);
        return;
      }
      setMindMaps((data || []) as MindMap[]);
    };

    // Cargar fichas existentes agrupadas por created_at
    const loadInitialFichas = async () => {
      const {
        data,
        error
      } = await supabase.from("fichas_didacticas").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (error) {
        console.error("Error loading fichas:", error);
        return;
      }
      if (data && data.length > 0) {
        // Agrupar fichas por created_at (asumiendo que las 7 fichas se crean juntas)
        const grouped = new Map<string, typeof data>();
        data.forEach(ficha => {
          const key = new Date(ficha.created_at).toISOString();
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(ficha);
        });

        // Convertir a FichasSet[]
        const fichasSetsData: FichasSet[] = Array.from(grouped.entries()).map(([timestamp, fichas]) => ({
          id: fichas[0].id,
          // Usar el ID de la primera ficha como ID del set
          created_at: timestamp,
          conversation_id: currentConversationId,
          user_id: fichas[0].user_id,
          fichas: fichas.map(f => ({
            pregunta: f.pregunta,
            respuesta: f.respuesta,
            orden: f.orden
          })).sort((a, b) => a.orden - b.orden)
        }));
        setFichasSets(fichasSetsData);
      }
    };
    loadInitialMessages();
    loadInitialMindMaps();
    loadInitialFichas();

    // Suscribirse a nuevos mensajes
    const channelName = `chat-${currentConversationId}`;
    console.log("🔌 Setting up realtime channel:", channelName, "for conversation:", currentConversationId);
    const channel = supabase.channel(channelName).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${currentConversationId}`
    }, payload => {
      console.log("🔔 Realtime INSERT received:", payload);
      const newMessage = payload.new as Message;
      setMessages(prev => {
        // Verificar si ya existe por ID real
        if (prev.some(m => m.id === newMessage.id)) {
          console.log("⚠️ Message already exists, ignoring");
          return prev;
        }

        // Si es mensaje del usuario, remover el mensaje temporal/optimista
        if (newMessage.role === "user") {
          const filteredPrev = prev.filter(m => !m.id.startsWith("temp-"));
          console.log("✅ Replacing optimistic message with real one");
          return [...filteredPrev, newMessage];
        }

        // Detectar si es un mensaje de generación de mapa mental
        if (newMessage.role === "assistant" && (newMessage.message.toLowerCase().includes("mapa mental") || newMessage.message.includes("🧠"))) {
          console.log("🎨 Mind map generation detected, showing progress bar");
          setIsGeneratingMindMap(true);
          setIsLoading(false);
        }
        console.log("✅ Adding message to UI:", {
          id: newMessage.id,
          role: newMessage.role,
          preview: newMessage.message.substring(0, 50)
        });

        // Detectar si es un mensaje de video/podcast completado
        if (newMessage.role === "assistant") {
          if (newMessage.message.includes("Video resumen generado") || newMessage.message.includes("video") && newMessage.message.includes("Error")) {
            console.log("🎬 Video generation complete");
            setIsGeneratingVideo(false);
          }
          if (newMessage.message.includes("Podcast resumen generado") || newMessage.message.includes("podcast") && newMessage.message.includes("Error")) {
            console.log("🎙️ Podcast generation complete");
            setIsGeneratingPodcast(false);
          }
          if (newMessage.message.includes("informe") || newMessage.message.includes("📄")) {
            console.log("📄 Informe generation complete");
            setIsGeneratingInforme(false);
          }
        }
        return [...prev, newMessage];
      });

      // Si es un mensaje del asistente, detener loading
      if (newMessage.role === "assistant") {
        console.log("🤖 Assistant message received, stopping loading");
        setIsLoading(false);
      }
    }).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "mind_maps",
      filter: `conversation_id=eq.${currentConversationId}`
    }, payload => {
      console.log("🗺️ New mind map received via realtime:", payload);
      const newMindMap = payload.new as MindMap;
      setMindMaps(prev => {
        if (prev.some(m => m.id === newMindMap.id)) {
          console.log("⚠️ Mind map already exists, ignoring");
          return prev;
        }
        console.log("✅ Adding mind map to UI");
        return [...prev, newMindMap];
      });
      // Detener indicador de generación al recibir el mapa
      console.log("🎉 Mind map generation complete, hiding progress bar");
      setIsGeneratingMindMap(false);
    }).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "fichas_didacticas",
      filter: `conversation_id=eq.${currentConversationId}`
    }, payload => {
      console.log("📚 New ficha received via realtime:", payload);
      const newFicha = payload.new as any;

      // Verificar si ya existe un set con este timestamp (agrupar por minuto)
      const fichaTimestamp = new Date(newFicha.created_at);
      fichaTimestamp.setSeconds(0, 0); // Normalizar a minuto
      const key = fichaTimestamp.toISOString();
      setFichasSets(prev => {
        // Buscar si ya existe un set con este timestamp
        const existingSetIndex = prev.findIndex(set => {
          const setTime = new Date(set.created_at);
          setTime.setSeconds(0, 0);
          return setTime.toISOString() === key;
        });
        if (existingSetIndex >= 0) {
          // Agregar ficha al set existente
          const updatedSets = [...prev];
          const existingSet = updatedSets[existingSetIndex];

          // Verificar si la ficha ya existe en el set
          if (existingSet.fichas.some(f => f.orden === newFicha.orden)) {
            return prev;
          }
          updatedSets[existingSetIndex] = {
            ...existingSet,
            fichas: [...existingSet.fichas, {
              pregunta: newFicha.pregunta,
              respuesta: newFicha.respuesta,
              orden: newFicha.orden
            }].sort((a, b) => a.orden - b.orden)
          };
          return updatedSets;
        } else {
          // Crear nuevo set
          return [...prev, {
            id: newFicha.id,
            created_at: newFicha.created_at,
            conversation_id: newFicha.conversation_id,
            user_id: newFicha.user_id,
            fichas: [{
              pregunta: newFicha.pregunta,
              respuesta: newFicha.respuesta,
              orden: newFicha.orden
            }]
          }];
        }
      });
    }).subscribe(status => {
      console.log("📡 Realtime subscription status:", status);
      if (status === 'SUBSCRIBED') {
        console.log("✅ Successfully subscribed to realtime updates");
      } else if (status === 'CHANNEL_ERROR') {
        console.error("❌ Realtime subscription error");
      } else if (status === 'TIMED_OUT') {
        console.error("⏱️ Realtime subscription timed out");
      }
    });

    // Polling periódico para detectar mensajes nuevos (fallback de realtime)
    const pollingInterval = setInterval(async () => {
      const {
        data: newMessages
      } = await supabase.from("messages").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (newMessages) {
        setMessages(prev => {
          // Solo actualizar si hay mensajes nuevos
          const prevIds = new Set(prev.filter(m => !m.id.startsWith('temp-')).map(m => m.id));
          const newOnes = (newMessages as Message[]).filter(m => !prevIds.has(m.id));
          if (newOnes.length > 0) {
            console.log("🔄 New messages detected via polling");

            // Detectar si hay mensaje de informe completado
            const hasInformeMessage = newOnes.some(m => m.role === "assistant" && (m.message.toLowerCase().includes("informe") || m.message.includes("📄")));
            if (hasInformeMessage) {
              console.log("📄 Informe generation complete (via polling)");
              setIsGeneratingInforme(false);
            }

            // Detectar video/podcast completado
            const hasVideoMessage = newOnes.some(m => m.role === "assistant" && m.message.includes("Video resumen generado"));
            if (hasVideoMessage) setIsGeneratingVideo(false);
            const hasPodcastMessage = newOnes.some(m => m.role === "assistant" && m.message.includes("Podcast resumen generado"));
            if (hasPodcastMessage) setIsGeneratingPodcast(false);

            // Mantener mensajes temporales y agregar los nuevos
            const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
            const realMessages = newMessages as Message[];

            // Filtrar mensajes temporales que ya tienen su versión real
            const filteredTemp = tempMessages.filter(temp => !realMessages.some(real => real.role === temp.role && real.message === temp.message));
            return [...realMessages, ...filteredTemp];
          }
          return prev;
        });
      }
    }, 2000); // Polling cada 2 segundos

    // Polling para mind maps (fallback de realtime)
    const mindMapPollingInterval = setInterval(async () => {
      const {
        data: newMindMaps
      } = await supabase.from("mind_maps").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (newMindMaps) {
        setMindMaps(prev => {
          const prevIds = new Set(prev.map(m => m.id));
          const hasNewMaps = newMindMaps.some(m => !prevIds.has(m.id));
          if (hasNewMaps) {
            console.log("🔄 New mind maps detected via polling");
            setIsGeneratingMindMap(false);
            return newMindMaps as MindMap[];
          }
          return prev;
        });
      }
    }, 3000); // Polling cada 3 segundos

    // Polling para fichas didácticas (fallback de realtime)
    const fichasPollingInterval = setInterval(async () => {
      const {
        data
      } = await supabase.from("fichas_didacticas").select("*").eq("conversation_id", currentConversationId).order("created_at", {
        ascending: true
      });
      if (data && data.length > 0) {
        // Agrupar fichas por minuto (ya que se crean juntas)
        const grouped = new Map<string, typeof data>();
        data.forEach(ficha => {
          const fichaTime = new Date(ficha.created_at);
          fichaTime.setSeconds(0, 0);
          const key = fichaTime.toISOString();
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(ficha);
        });
        const newFichasSets: FichasSet[] = Array.from(grouped.entries()).map(([timestamp, fichas]) => ({
          id: fichas[0].id,
          created_at: timestamp,
          conversation_id: currentConversationId,
          user_id: fichas[0].user_id,
          fichas: fichas.map(f => ({
            pregunta: f.pregunta,
            respuesta: f.respuesta,
            orden: f.orden
          })).sort((a, b) => a.orden - b.orden)
        }));
        setFichasSets(prev => {
          const prevIds = new Set(prev.map(s => s.id));
          const hasNew = newFichasSets.some(s => !prevIds.has(s.id));
          if (hasNew) {
            console.log("🔄 New fichas detected via polling");
            return newFichasSets;
          }
          return prev;
        });
      }
    }, 3000); // Polling cada 3 segundos

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
      clearInterval(mindMapPollingInterval);
      clearInterval(fichasPollingInterval);
    };
  }, [currentConversationId]);

  // Procesar transcripción de audio cuando llegue
  useEffect(() => {
    if (transcribedText && !processingTranscriptionRef.current) {
      processingTranscriptionRef.current = true;
      console.log("📤 Sending transcribed text to chat:", transcribedText);
      handleSend(transcribedText).finally(() => {
        setTranscribedText(null);
        processingTranscriptionRef.current = false;
      });
    }
  }, [transcribedText]);
  const loadMessages = async (conversationId: string) => {
    console.log("Loading messages for conversation:", conversationId);
    const {
      data,
      error
    } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
      ascending: true
    });
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
    const title = firstMessage ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "") : "Nueva conversación";
    const {
      data,
      error
    } = await supabase.from("conversations").insert({
      user_id: user.id,
      title: title
    }).select().single();
    if (error) {
      toast.error("Error creando conversación");
      console.error("Error creating conversation:", error);
      return null;
    }
    return data.id;
  };
  const handleNewConversation = () => {
    // Simplemente navegar a /chat sin conversationId
    navigate("/chat", {
      replace: true
    });
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
        navigate(`/chat/${conversationId}`, {
          replace: true
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Agregar mensaje del usuario INMEDIATAMENTE a la UI (optimistic update)
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        message: textToSend,
        created_at: new Date().toISOString(),
        conversation_id: conversationId
      };
      setMessages(prev => [...prev, optimisticUserMessage]);
      console.log("📤 Sending message to edge function...");
      const {
        error
      } = await supabase.functions.invoke("chat", {
        body: {
          message: textToSend,
          conversation_id: conversationId,
          user_id: user.id
        }
      });
      if (error) {
        // Si hay error, remover el mensaje optimista
        setMessages(prev => prev.filter(m => m.id !== optimisticUserMessage.id));
        throw error;
      }
      console.log("✅ Message sent, polling for response...");

      // Polling para obtener la respuesta (más confiable que realtime)
      const pollForResponse = async (attempts = 0) => {
        if (attempts > 15) {
          console.log("⏱️ Max polling attempts reached");
          setIsLoading(false);
          return;
        }
        const {
          data: newMessages
        } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
          ascending: true
        });
        if (newMessages) {
          // Buscar si hay una respuesta del asistente más reciente que nuestro mensaje
          const hasNewAssistantMessage = newMessages.some(m => m.role === "assistant" && new Date(m.created_at) > new Date(optimisticUserMessage.created_at));
          if (hasNewAssistantMessage) {
            console.log("✅ Response received via polling");
            // Reemplazar mensajes temporales con los reales
            setMessages(newMessages.filter(m => !m.id.startsWith('temp-')) as Message[]);
            setIsLoading(false);
            return;
          }
        }

        // Esperar y reintentar
        setTimeout(() => pollForResponse(attempts + 1), 500);
      };

      // Iniciar polling después de un breve delay
      setTimeout(() => pollForResponse(), 500);
    } catch (error) {
      console.error("❌ Error sending message:", error);
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
    toast.info(`Subiendo archivo: ${file.name}`);
    try {
      // Primero subir el archivo a S3 para obtener URL permanente
      const s3FormData = new FormData();
      s3FormData.append('file', file);
      s3FormData.append('userId', user.id);
      s3FormData.append('conversationId', conversationId);
      console.log("📤 Subiendo archivo a S3...");
      const s3Response = await supabase.functions.invoke('upload-to-s3', {
        body: s3FormData
      });
      let permanentFileUrl: string;
      if (s3Response.error || !s3Response.data?.url) {
        console.warn("⚠️ No se pudo subir a S3, usando URL temporal:", s3Response.error);
        permanentFileUrl = URL.createObjectURL(file);
      } else {
        permanentFileUrl = s3Response.data.url;
        console.log("✅ Archivo subido a S3:", permanentFileUrl);
      }

      // Mostrar el archivo en el chat como mensaje del usuario con link de descarga
      const fileMessageContent = `📎 Archivo: ${file.name}`;
      const fileMessageWithUrl = `${fileMessageContent} [FILE_URL]${permanentFileUrl}|${file.name}|${file.type}[/FILE_URL]`;
      const fileMessage: Message = {
        id: `file-${Date.now()}`,
        role: "user",
        message: fileMessageWithUrl,
        created_at: new Date().toISOString(),
        conversation_id: conversationId
      };
      setMessages(prev => [...prev, fileMessage]);
      toast.info(`Procesando archivo: ${file.name}`);

      // Guardar el mensaje del usuario (archivo) en la base de datos CON la URL permanente
      const {
        error: userMsgError
      } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        message: fileMessageWithUrl
      });
      if (userMsgError) {
        console.error("❌ Error guardando mensaje de archivo del usuario:", userMsgError);
      } else {
        console.log("✅ Mensaje de archivo del usuario guardado en BD con URL permanente");
      }

      // Crear FormData con el archivo binario y metadata JSON
      const formData = new FormData();
      formData.append("file", file);
      const metadata = {
        type: "archivos",
        user_id: user.id,
        conversation_id: conversationId,
        file_data: {
          name: file.name,
          type: file.type,
          size: file.size
        }
      };
      formData.append("metadata", JSON.stringify(metadata));
      console.log("📤 Enviando archivo al webhook de archivos...", {
        fileName: file.name,
        metadata
      });

      // Enviar al webhook externo de archivos
      const res = await fetch("https://webhook.hubleconsulting.com/webhook/728b3d4d-2ab4-4a72-a15b-a615340archivos", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Error en el webhook de archivos");
      const data = await res.json();
      console.log("📥 Respuesta del webhook de archivos:", data);

      // Extraer el mensaje de la respuesta - buscar en diferentes formatos posibles
      const response = data?.mensaje || data?.respuesta || data?.message || data?.response?.mensaje || data?.response?.respuesta || data?.response?.text || data?.response?.message || data?.response?.content || (typeof data === 'string' ? data : null);
      console.log("📝 Mensaje procesado del webhook de archivos:", response);
      if (response) {
        toast.success("Archivo procesado, enviando al asistente...");
        console.log("📤 Enviando al webhook de mensajes...", {
          mensaje: response.substring(0, 100) + "...",
          id_conversation: conversationId,
          id_user: user.id,
          tipo_respuesta: "visual"
        });

        // Enviar la respuesta del webhook de archivos al webhook de mensajes
        const webhookRes = await fetch("https://webhook.hubleconsulting.com/webhook/7e846525-ea3a-4213-8f66-5d0dad8547bc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mensaje: response,
            id_conversation: conversationId,
            id_user: user.id,
            tipo_respuesta: "visual"
          })
        });
        console.log("📥 Status del webhook de mensajes:", webhookRes.status);
        if (!webhookRes.ok) {
          const errorText = await webhookRes.text();
          console.error("❌ Error del webhook de mensajes:", errorText);
          throw new Error("Error en el webhook de mensajes");
        }
        const webhookData = await webhookRes.json();
        console.log("📥 Respuesta del webhook de mensajes:", webhookData);

        // El webhook responde con un array: [{ mensajes: [...], images: [...] }]
        let directResponse = null;
        let imageUrls: string[] = [];
        if (Array.isArray(webhookData) && webhookData.length > 0) {
          const responseItem = webhookData[0];
          // Combinar todos los mensajes en uno
          if (responseItem.mensajes && Array.isArray(responseItem.mensajes)) {
            directResponse = responseItem.mensajes.join('\n\n');
          }
          // Obtener imágenes si las hay
          if (responseItem.images && Array.isArray(responseItem.images)) {
            imageUrls = responseItem.images;
          }
        } else {
          // Fallback a la estructura anterior
          directResponse = webhookData?.respuesta || webhookData?.response?.respuesta || webhookData?.response?.mensaje || webhookData?.message || webhookData?.mensaje;
        }
        if (directResponse || imageUrls.length > 0) {
          console.log("💬 Respuesta directa del webhook:", directResponse);
          console.log("🖼️ Imágenes:", imageUrls);

          // Formatear el mensaje con imágenes si las hay
          let finalMessage = directResponse || '';
          if (imageUrls.length > 0) {
            finalMessage += `\n\n[IMAGES]${imageUrls.join('|')}[/IMAGES]`;
          }
          console.log("📝 Mensaje final a mostrar:", finalMessage);
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            message: finalMessage,
            created_at: new Date().toISOString(),
            conversation_id: conversationId
          };

          // Guardar el mensaje del asistente en la base de datos
          const {
            error: saveError
          } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: "assistant",
            message: finalMessage
          });
          if (saveError) {
            console.error("❌ Error guardando mensaje del asistente:", saveError);
          } else {
            console.log("✅ Mensaje del asistente guardado en BD");
          }
          setMessages(prev => [...prev, assistantMessage]);
          console.log("✅ Mensaje añadido al estado del chat");
          setIsLoading(false);
        } else {
          // Si no hay respuesta directa, iniciar polling para buscar la respuesta
          console.log("🔄 Iniciando polling para obtener respuesta del asistente...");
          toast.info("Procesando archivo, esperando respuesta...");
          const fileMessageTime = new Date().toISOString();
          const pollForAssistantResponse = async (attempts = 0) => {
            if (attempts > 30) {
              // 30 intentos x 1 segundo = 30 segundos máximo
              console.log("⏱️ Tiempo de espera agotado para respuesta del archivo");
              toast.error("Tiempo de espera agotado. Revisa la conversación más tarde.");
              setIsLoading(false);
              return;
            }
            const {
              data: newMessages
            } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
              ascending: true
            });
            if (newMessages) {
              // Buscar si hay una respuesta del asistente más reciente
              const hasNewAssistantMessage = newMessages.some(m => m.role === "assistant" && new Date(m.created_at) > new Date(fileMessageTime));
              if (hasNewAssistantMessage) {
                console.log("✅ Respuesta del asistente recibida via polling");
                setMessages(newMessages.filter(m => !m.id.startsWith('temp-') && !m.id.startsWith('file-')) as Message[]);
                setIsLoading(false);
                return;
              }
            }

            // Esperar 1 segundo y reintentar
            setTimeout(() => pollForAssistantResponse(attempts + 1), 1000);
          };

          // Iniciar polling después de un breve delay
          setTimeout(() => pollForAssistantResponse(), 1000);
          return; // Salir del try, el polling manejará setIsLoading
        }
      } else {
        console.log("⚠️ Respuesta del webhook sin contenido procesable:", data);
        toast.success("Archivo enviado correctamente");
      }
    } catch (error) {
      console.error("❌ Error processing file:", error);
      toast.error("Error procesando el archivo");
      setIsLoading(false);
    } finally {
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
  const pollForMediaUrl = async (webhookUrl: string, maxAttempts: number = 20, interval: number = 3000): Promise<string | null> => {
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
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error("Error polling for media URL:", error);
      }
    }
    return null;
  };
  const handleGenerateResumen = async (type: "video" | "podcast") => {
    if (!currentConversationId || messages.length === 0) {
      toast.error("No hay conversación para resumir");
      return;
    }

    // Activar indicador de generación
    if (type === "video") {
      setIsGeneratingVideo(true);
    } else {
      setIsGeneratingPodcast(true);
    }
    try {
      // Crear resumen de la conversación
      const conversationSummary = messages.filter(m => !m.id.startsWith('temp-')).map(msg => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.message}`).join("\n\n");

      // Llamar a la edge function que procesa en background
      const {
        error
      } = await supabase.functions.invoke("generate-media", {
        body: {
          type,
          conversation_id: currentConversationId,
          user_id: user!.id,
          conversation_summary: conversationSummary,
          message_count: messages.length
        }
      });
      if (error) {
        throw error;
      }

      // El estado se desactivará automáticamente cuando llegue el mensaje via realtime
    } catch (error) {
      console.error("Error starting media generation:", error);
      toast.error("Error al iniciar la generación");
      if (type === "video") {
        setIsGeneratingVideo(false);
      } else {
        setIsGeneratingPodcast(false);
      }
    }
  };
  const handleRequestMindMap = async () => {
    if (!currentConversationId || messages.length === 0) {
      toast.error("No hay conversación para crear un mapa mental");
      return;
    }
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sesión expirada");
      return;
    }

    // Activar indicador de generación
    setIsGeneratingMindMap(true);

    // Llamar al chat con action_type para solo generar mapa mental (sin respuesta AI)
    supabase.functions.invoke("chat", {
      body: {
        message: "Generar mapa mental",
        conversation_id: currentConversationId,
        user_id: session.user.id,
        skip_user_message: true,
        action_type: "mind_map"
      }
    }).catch(err => {
      console.error("Error en mapa mental background:", err);
      toast.error("Error al generar mapa mental");
      setIsGeneratingMindMap(false);
    });

    // La respuesta llegará via realtime/polling - no bloqueamos
  };
  const handleRequestInforme = async () => {
    if (!currentConversationId || messages.length === 0) {
      toast.error("No hay conversación para generar un informe");
      return;
    }
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sesión expirada");
      return;
    }

    // Activar animación de carga
    setIsGeneratingInforme(true);

    // Llamar al chat con action_type para solo generar informe (sin respuesta AI adicional)
    supabase.functions.invoke("chat", {
      body: {
        message: "Generar informe",
        conversation_id: currentConversationId,
        user_id: session.user.id,
        skip_user_message: true,
        action_type: "informe"
      }
    }).catch(err => {
      console.error("Error en informe background:", err);
      toast.error("Error al generar informe");
      setIsGeneratingInforme(false);
    });

    // El estado se desactivará automáticamente cuando llegue el mensaje via realtime
  };
  const handleGenerateFichas = async () => {
    if (!currentConversationId || messages.length === 0) {
      toast.error("No hay conversación para generar fichas didácticas");
      return;
    }

    // Activar indicador de generación (solo parpadeo en el botón)
    setIsGeneratingFichas(true);

    // Ejecutar en background sin bloquear
    (async () => {
      try {
        // Obtener mensajes de la conversación
        const {
          data: conversationMessages,
          error: messagesError
        } = await supabase.from("messages").select("message, role").eq("conversation_id", currentConversationId).order("created_at", {
          ascending: true
        });
        if (messagesError) throw messagesError;
        if (!conversationMessages || conversationMessages.length === 0) {
          toast.error("No hay contenido en esta conversación para generar fichas");
          setIsGeneratingFichas(false);
          return;
        }

        // Construir el contenido del chat
        const contenidoChat = conversationMessages.map(m => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.message}`).join("\n\n");

        // Llamar al edge function
        const {
          data,
          error
        } = await supabase.functions.invoke("generar-fichas", {
          body: {
            conversation_id: currentConversationId,
            contenido_chat: contenidoChat
          }
        });
        setIsGeneratingFichas(false);
        if (error) {
          console.error("Error generando fichas:", error);
          if (error.message.includes("429")) {
            toast.error("Límite de peticiones excedido. Intenta de nuevo en unos momentos.");
          } else if (error.message.includes("402")) {
            toast.error("Se requiere agregar créditos a tu cuenta de Lovable AI.");
          } else {
            toast.error("Error al generar las fichas");
          }
          return;
        }
        // Las fichas aparecerán automáticamente en el chat via realtime subscription
      } catch (error) {
        console.error("Error generando fichas:", error);
        toast.error("Error al generar las fichas");
        setIsGeneratingFichas(false);
      }
    })();
  };
  console.log(user);
  if (!user || !user.id) {
    return <div className="flex min-h-screen w-full bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>;
  }
  return <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar user={user} currentConversationId={currentConversationId} onConversationSelect={handleConversationSelect} onNewConversation={handleNewConversation} />

        <div className="flex flex-col flex-1 w-full overflow-hidden h-screen">
          {/* Header Fijo */}
          <NavBarUser user={user} setShowProfileEditor={setShowProfileEditor} isSigningOut={isSigningOut} />

          {/* Messages Area con scroll propio */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative w-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDragging && <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-primary">
                <div className="text-center">
                  <Paperclip className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <p className="text-lg font-semibold text-foreground">Suelta el archivo aquí</p>
                  <p className="text-sm text-muted-foreground">Se procesará automáticamente</p>
                </div>
              </div>}
            <div className="max-w-5xl mx-auto px-3 md:px-6 md:pr-24 py-4 md:py-8 w-full">
              {chatItems.length === 0 ? <div className="space-y-6 md:space-y-8 py-6 md:py-12">
                  <div className="text-center space-y-2 md:space-y-3">
                    <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3 md:mb-4">
                      <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                    </div>
                    <h2 className="text-xl md:text-3xl font-semibold text-foreground px-4">Bienvenido a BIEX</h2>
                  </div>
                </div> : <div className="space-y-3 md:space-y-6">
                  {chatItems.map(item => {
                if (item.type === 'message') {
                  const msg = item.data;
                  // Detectar si el mensaje contiene imágenes [IMAGES]url1|url2[/IMAGES]
                  const imagesMatch = msg.message.match(/\[IMAGES\](.*?)\[\/IMAGES\]/);
                  const hasImages = imagesMatch && imagesMatch[1];
                  const imageUrls = hasImages ? imagesMatch[1].split('|').filter(url => url.trim()) : [];

                  // Detectar si el mensaje contiene un archivo [FILE_URL]url|name|type[/FILE_URL]
                  const fileMatch = msg.message.match(/\[FILE_URL\](.*?)\[\/FILE_URL\]/);
                  const hasFile = fileMatch && fileMatch[1];
                  const fileData = hasFile ? fileMatch[1].split('|') : [];
                  const fileUrl = fileData[0] || '';
                  const fileName = fileData[1] || 'archivo';
                  const fileType = fileData[2] || '';

                  // Detectar si el mensaje contiene una URL de video/audio/pdf
                  const urlMatch = msg.message.match(/(https?:\/\/[^\s]+)/);
                  const hasMedia = urlMatch && (msg.message.includes("Video resumen") || msg.message.includes("Podcast resumen"));
                  const hasPdf = urlMatch && msg.message.includes("📄");
                  const isVideo = msg.message.includes("Video resumen");

                  // Si es un mensaje de archivo subido, renderizar con botón de descarga
                  if (hasFile && fileUrl) {
                    const cleanMessage = msg.message.replace(/\[FILE_URL\].*?\[\/FILE_URL\]/, '').trim();
                    return <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 overflow-hidden ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm"}`}>
                              <div className="space-y-3">
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                  {cleanMessage}
                                </p>
                                <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg border border-border/50">
                                  <div className="flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                      <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{fileName}</p>
                                    <p className="text-xs text-muted-foreground">{fileType || 'Archivo'}</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => window.open(fileUrl, '_blank')} className="h-8 w-8 p-0" title="Abrir archivo">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                const link = document.createElement('a');
                                link.href = fileUrl;
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                toast.success('Descargando archivo...');
                              }} className="h-8 w-8 p-0" title="Descargar archivo">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>;
                  }

                  // Si es un mensaje de imágenes, renderizar de forma especial
                  if (hasImages && imageUrls.length > 0) {
                    // Extraer el texto sin las etiquetas de imágenes
                    const textContent = msg.message.replace(/\[IMAGES\].*?\[\/IMAGES\]/, '').trim();
                    return <div key={msg.id} className="flex justify-start">
                            <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-4 md:py-3 overflow-hidden bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm">
                              <div className="space-y-3">
                                {/* Mostrar el texto del mensaje si existe */}
                                {textContent && <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                    {textContent}
                                  </p>}
                                {/* Mostrar las imágenes */}
                                <div className="flex flex-wrap justify-center gap-2">
                                  {imageUrls.map((url, idx) => <div key={idx} className="relative group cursor-pointer rounded-lg overflow-hidden w-24 h-24 md:w-28 md:h-28" onClick={() => window.open(url, '_blank')}>
                                      <img src={url} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                                        <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                      </div>
                                    </div>)}
                                </div>
                              </div>
                            </div>
                          </div>;
                  }
                  return <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                           <div className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-xl md:rounded-2xl px-3 py-2.5 md:px-5 md:py-4 overflow-hidden ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-[hsl(var(--chat-assistant-border))] text-card-foreground shadow-sm"}`}>
                            {hasPdf && urlMatch ? <div className="space-y-3">
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                  {msg.message.split(urlMatch[0])[0]}
                                </p>
                                <Button onClick={async () => {
                          try {
                            toast.info("Descargando PDF...");
                            const response = await fetch(urlMatch[0], {
                              mode: "cors",
                              credentials: "omit"
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
                        }} className="w-full gap-2 h-auto py-4" size="lg">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15 v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  Descargar Informe PDF
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                  Si el botón no funciona,{" "}
                                  <button onClick={() => {
                            navigator.clipboard.writeText(urlMatch[0]);
                            toast.success("¡Link copiado!");
                          }} className="underline hover:text-foreground">
                                    copia este enlace
                                  </button>
                                </p>
                              </div> : hasMedia && urlMatch ? <div className="space-y-3 w-full overflow-hidden">
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                  {msg.message.split(urlMatch[0])[0]}
                                </p>
                                {isVideo ? <video controls className="w-full rounded-lg max-h-[400px]" src={urlMatch[0]}>
                                    Tu navegador no soporta video HTML5.
                                  </video> : <audio controls className="w-full" src={urlMatch[0]}>
                                    Tu navegador no soporta audio HTML5.
                                  </audio>}
                              </div> : <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-[15px]">
                                {msg.message}
                              </p>}
                          </div>
                        </div>;
                } else if (item.type === 'mindmap') {
                  // Renderizar mapa mental
                  const mindMap = item.data as MindMap;
                  return <div key={mindMap.id} className="flex justify-start">
                          <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl overflow-hidden shadow-sm">
                            {/* Preview compacto del mapa */}
                            <div className="relative h-48 md:h-56 overflow-hidden bg-background/50">
                              <iframe srcDoc={mindMap.html_content} className="w-full h-full border-0 pointer-events-none scale-75 origin-top-left" title={`Preview: ${mindMap.tema}`} sandbox="allow-scripts allow-same-origin" style={{
                          width: '133%',
                          height: '133%'
                        }} />
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
                                <Button variant="outline" size="sm" onClick={() => {
                            setSelectedMindMap(mindMap);
                            setIsDialogOpen(true);
                          }}>
                                  Ver completo
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/mindmap/${currentConversationId}`)} title="Abrir en página completa">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>;
                } else if (item.type === 'fichas') {
                  // Renderizar fichas didácticas
                  const fichasSet = item.data as FichasSet;
                  return <div key={fichasSet.id} className="flex justify-start">
                          <div className="max-w-[90%] md:max-w-[85%] lg:max-w-[75%] bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl overflow-hidden shadow-sm">
                            {/* Header */}
                            <div className="bg-primary/10 px-4 py-3 flex items-center gap-3">
                              <BookOpen className="h-5 w-5 text-primary shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  Fichas Didácticas
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fichasSet.fichas.length} fichas • {new Date(fichasSet.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            {/* Preview de las primeras 2 preguntas (sin respuestas) */}
                            <div className="p-4 space-y-3">
                              {fichasSet.fichas.slice(0, 2).map(ficha => <div key={ficha.orden} className="bg-background/50 rounded-lg p-3 border border-border/50">
                                  <p className="text-xs font-semibold text-primary mb-1">
                                    Ficha {ficha.orden}
                                  </p>
                                  <p className="text-sm font-medium">
                                    {ficha.pregunta}
                                  </p>
                                </div>)}
                              
                              {fichasSet.fichas.length > 2 && <p className="text-xs text-muted-foreground text-center py-2">
                                  + {fichasSet.fichas.length - 2} fichas más
                                </p>}
                            </div>

                            {/* Botón para ver todas */}
                            <div className="px-4 pb-4">
                              <Button variant="outline" size="sm" onClick={() => {
                          setSelectedFichasId(fichasSet.id);
                          setShowFichas(true);
                        }} className="w-full">
                                Ver todas las fichas
                              </Button>
                            </div>
                          </div>
                        </div>;
                } else {
                  return null;
                }
              })}

                  {/* Indicador de Sofia pensando - para loading normal o generando mapa mental */}
                  {(isLoading || isGeneratingMindMap) && <div className="flex justify-start">
                      <div className="bg-card border border-[hsl(var(--chat-assistant-border))] rounded-xl md:rounded-2xl px-2 py-2 md:px-3 md:py-2.5 flex items-center gap-2 md:gap-3 shadow-sm">
                        <SofiaThinking />
                        <span className="text-xs md:text-sm text-muted-foreground">
                          {isGeneratingMindMap ? "Sofia está generando el mapa mental..." : "Sofia está analizando..."}
                        </span>
                      </div>
                    </div>}

                  <div ref={messagesEndRef} />
                </div>}
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
                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Adjuntar archivo">
                      <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={toggleRecording} disabled={isLoading} className={`h-7 w-7 rounded-full hover:bg-accent/50 transition-all ${isRecording ? "bg-destructive hover:bg-destructive text-destructive-foreground animate-pulse" : ""}`} title={isRecording ? "Detener grabación" : "Iniciar grabación de audio"}>
                      {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>

                  <span className="flex-1" />

                  {/* Botones de herramientas - Solo desktop (móvil usa FAB flotante) */}
                  {messages.length > 0 && <div className="hidden md:flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleGenerateResumen("video")} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Generar video">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={() => handleGenerateResumen("podcast")} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Generar podcast">
                        <Podcast className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={handleRequestMindMap} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Solicitar mapa mental">
                        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={handleRequestInforme} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Solicitar informe">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={handleGenerateFichas} disabled={isLoading} className="h-7 w-7 rounded-lg hover:bg-accent/50" title="Generar fichas">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>}
                </div>

                {/* INPUT + SEND BUTTON */}
                <div className="flex items-end gap-2 md:gap-3 w-full px-2 py-1">
                  <textarea ref={textareaRef} value={input} onChange={e => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                }} onKeyDown={handleKeyPress} placeholder="Escribe tu consulta..." className="flex-1 bg-transparent shadow-none outline-none border-none text-[14px] md:text-[15px] leading-relaxed placeholder:text-muted-foreground/60 resize-none overflow-y-auto px-1 py-2 md:py-2.5 transition-all" style={{
                  maxHeight: "120px",
                  minHeight: "36px"
                }} />

                  <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} size="icon" className="h-8 w-8 md:h-11 md:w-11 rounded-xl shrink-0 bg-primary text-primary-foreground hover:bg-primary-hover transition-all">
                    <Send className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </div>

                {/* DESKTOP: Toolbar inferior con botones */}
                <div className="hidden md:flex items-center justify-between gap-2 text-xs text-muted-foreground/70 px-2 py-1.5 border-t">
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="*/*" />
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="h-8 w-8 rounded-lg hover:bg-accent/50" title="Adjuntar archivo">
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={toggleRecording} disabled={isLoading} className={`h-8 w-8 rounded-full hover:bg-accent/50 transition-all ${isRecording ? "bg-destructive hover:bg-destructive text-destructive-foreground animate-pulse" : ""}`} title={isRecording ? "Detener grabación" : "Grabar audio"}>
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-muted-foreground" />}
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
        <ChatToolsSidebar isLoading={isLoading} hasMessages={messages.length > 0} isGeneratingMindMap={isGeneratingMindMap} isGeneratingInforme={isGeneratingInforme} isGeneratingVideo={isGeneratingVideo} isGeneratingPodcast={isGeneratingPodcast} isGeneratingFichas={isGeneratingFichas} onGenerateVideo={() => handleGenerateResumen("video")} onGeneratePodcast={() => handleGenerateResumen("podcast")} onRequestMindMap={handleRequestMindMap} onRequestInforme={handleRequestInforme} onGenerateFichas={handleGenerateFichas} />

        {/* Botón flotante para móvil */}
        <MobileChatToolsFAB isLoading={isLoading} hasMessages={messages.length > 0} isGeneratingMindMap={isGeneratingMindMap} isGeneratingInforme={isGeneratingInforme} isGeneratingVideo={isGeneratingVideo} isGeneratingPodcast={isGeneratingPodcast} isGeneratingFichas={isGeneratingFichas} onGenerateVideo={() => handleGenerateResumen("video")} onGeneratePodcast={() => handleGenerateResumen("podcast")} onRequestMindMap={handleRequestMindMap} onRequestInforme={handleRequestInforme} onGenerateFichas={handleGenerateFichas} />
      </div>

      {/* Modal de edición de perfil */}
      {user && <StarterProfileEditor userId={user.id} open={showProfileEditor} onOpenChange={setShowProfileEditor} />}

      {/* Fichas Didácticas - Modal para ver set completo */}
      {showFichas && selectedFichasId && currentConversationId && <FichasDidacticas conversationId={currentConversationId} fichasSetId={selectedFichasId} onClose={() => {
      setShowFichas(false);
      setSelectedFichasId(null);
    }} />}

      {/* Modal de mapa mental completo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[90vh] p-3 md:p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="text-sm md:text-base truncate">{selectedMindMap?.tema}</span>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/mindmap/${currentConversationId}`)} className="gap-2 w-full md:w-auto">
                <ExternalLink className="h-4 w-4" />
                Abrir en página
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedMindMap && <div className="flex-1 flex items-center justify-center overflow-hidden">
              <iframe srcDoc={selectedMindMap.html_content} className="w-full h-full border-0 rounded-lg" title={`Mapa mental: ${selectedMindMap.tema}`} sandbox="allow-scripts allow-same-origin" style={{
            minHeight: '400px',
            maxHeight: '600px'
          }} />
            </div>}
        </DialogContent>
      </Dialog>
    </SidebarProvider>;
};
export default Chat;
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, MessageSquare, Brain, FileText, Loader2, User, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2pdf from "html2pdf.js";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: string;
  message: string;
  created_at: string;
}

interface MindMap {
  id: string;
  tema: string;
  html_content: string;
  created_at: string;
}

interface FichaDidactica {
  id: string;
  pregunta: string;
  respuesta: string;
  orden: number;
  created_at: string;
}

interface ConversationContent {
  messages: Message[];
  mindMaps: MindMap[];
  fichas: FichaDidactica[];
}

export const AdminConversationHistory = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationContent, setConversationContent] = useState<ConversationContent | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;

    const channel = supabase
      .channel(`admin-history-${selectedUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `user_id=eq.${selectedUserId}` },
        (payload) => {
          console.log("Admin Realtime [conversations]:", payload);
          loadConversations(selectedUserId, true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          console.log("Admin Realtime [messages]:", payload);
          loadConversations(selectedUserId, true);
          if (selectedConversation) {
            loadConversationContent(selectedConversation, true);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mind_maps" },
        (payload) => {
          console.log("Admin Realtime [mind_maps]:", payload);
          if (selectedConversation) {
            loadConversationContent(selectedConversation, true);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fichas_didacticas" },
        (payload) => {
          console.log("Admin Realtime [fichas_didacticas]:", payload);
          if (selectedConversation) {
            loadConversationContent(selectedConversation, true);
          }
        }
      )
      .subscribe((status) => {
        console.log("Admin Dashboard Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, selectedConversation]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadConversations = async (userId: string, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoadingConversations(true);
      setConversations([]);
      setSelectedConversation(null);
      setConversationContent(null);
    }

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las conversaciones",
        variant: "destructive",
      });
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversationContent = async (conversation: Conversation, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoadingContent(true);
      setSelectedConversation(conversation);
    }

    try {
      const [messagesResult, mindMapsResult, fichasResult] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at"),
        supabase
          .from("mind_maps")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at"),
        supabase
          .from("fichas_didacticas")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("orden"),
      ]);

      setConversationContent({
        messages: messagesResult.data || [],
        mindMaps: mindMapsResult.data || [],
        fichas: fichasResult.data || [],
      });
    } catch (error) {
      console.error("Error loading conversation content:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el contenido de la conversación",
        variant: "destructive",
      });
    } finally {
      setLoadingContent(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    if (userId) {
      loadConversations(userId, false);
    } else {
      setConversations([]);
      setSelectedConversation(null);
      setConversationContent(null);
    }
  };

  const extractLinksFromText = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const generatePdfContent = () => {
    if (!selectedConversation || !conversationContent) return "";

    const selectedUser = users.find((u) => u.id === selectedUserId);
    const allLinks: string[] = [];

    // Collect all links from messages
    conversationContent.messages.forEach((msg) => {
      allLinks.push(...extractLinksFromText(msg.message));
    });

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #333;">Historial de Conversación</h1>
          <p style="color: #666; margin-top: 10px;">
            <strong>Usuario:</strong> ${selectedUser?.name || selectedUser?.email || "Usuario"}<br/>
            <strong>Título:</strong> ${selectedConversation.title}<br/>
            <strong>Fecha:</strong> ${new Date(selectedConversation.created_at).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
    `;

    // Messages section
    if (conversationContent.messages.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            💬 Mensajes de la Conversación
          </h2>
      `;

      conversationContent.messages.forEach((msg) => {
        const isUser = msg.role === "user";
        const bgColor = isUser ? "#e3f2fd" : "#f5f5f5";
        const label = isUser ? "Usuario" : "Asistente";

        html += `
          <div style="background: ${bgColor}; padding: 15px; margin: 10px 0; border-radius: 8px;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #333;">${label}</p>
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${msg.message}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
              ${new Date(msg.created_at).toLocaleString("es-ES")}
            </p>
          </div>
        `;
      });

      html += `</div>`;
    }

    // Mind maps section
    if (conversationContent.mindMaps.length > 0) {
      html += `
        <div style="margin-bottom: 30px; page-break-before: always;">
          <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            🧠 Mapas Mentales Generados
          </h2>
      `;

      conversationContent.mindMaps.forEach((mindMap) => {
        html += `
          <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${mindMap.tema}</h3>
            <p style="font-size: 12px; color: #999; margin-bottom: 10px;">
              Creado: ${new Date(mindMap.created_at).toLocaleString("es-ES")}
            </p>
            <div style="border: 1px solid #eee; padding: 10px; background: #fafafa; overflow: auto;">
              ${mindMap.html_content}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // Fichas didácticas section
    if (conversationContent.fichas.length > 0) {
      html += `
        <div style="margin-bottom: 30px; page-break-before: always;">
          <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            📚 Fichas Didácticas
          </h2>
      `;

      conversationContent.fichas.forEach((ficha, index) => {
        html += `
          <div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #fff8e1;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">
              Ficha ${index + 1}: ${ficha.pregunta}
            </p>
            <p style="margin: 0; padding: 10px; background: #fff; border-radius: 4px;">
              <strong>Respuesta:</strong> ${ficha.respuesta}
            </p>
          </div>
        `;
      });

      html += `</div>`;
    }

    // Links section
    if (allLinks.length > 0) {
      html += `
        <div style="margin-bottom: 30px; page-break-before: always;">
          <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            🔗 Enlaces y Videos Mencionados
          </h2>
          <ul style="padding-left: 20px;">
      `;

      [...new Set(allLinks)].forEach((link) => {
        html += `<li style="margin: 8px 0;"><a href="${link}" style="color: #1976d2; word-break: break-all;">${link}</a></li>`;
      });

      html += `</ul></div>`;
    }

    html += `
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
          Generado el ${new Date().toLocaleString("es-ES")} desde el Panel de Administración
        </div>
      </div>
    `;

    return html;
  };

  const handleDownloadPdf = async () => {
    if (!selectedConversation || !conversationContent) return;

    setDownloading(true);

    try {
      const content = generatePdfContent();
      const container = document.createElement("div");
      container.innerHTML = content;
      document.body.appendChild(container);

      const selectedUser = users.find((u) => u.id === selectedUserId);
      const fileName = `conversacion_${selectedUser?.name || "usuario"}_${selectedConversation.title.slice(0, 20)}_${new Date().toISOString().split("T")[0]}.pdf`;

      const opt = {
        margin: 10,
        filename: fileName.replace(/[^a-zA-Z0-9_-]/g, "_"),
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);

      toast({
        title: "PDF descargado",
        description: "El historial de la conversación se ha descargado correctamente",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Historial de Conversaciones</CardTitle>
          <CardDescription>
            Selecciona un usuario para ver sus conversaciones y descargar el historial completo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Seleccionar Usuario</label>
              <Select value={selectedUserId} onValueChange={handleUserChange} disabled={loadingUsers}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Cargando usuarios..." : "Selecciona un usuario"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.name || user.email || "Sin nombre"}</span>
                        {user.email && user.name && (
                          <span className="text-muted-foreground text-xs">({user.email})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingConversations && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {selectedUserId && !loadingConversations && conversations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Este usuario no tiene conversaciones
            </p>
          )}

          {conversations.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Lista de conversaciones */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversaciones ({conversations.length})
                </h3>
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-2 space-y-2">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => loadConversationContent(conv)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedConversation?.id === conv.id
                            ? "bg-primary/10 border-primary border"
                            : "bg-muted/50 hover:bg-muted border border-transparent"
                        }`}
                      >
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(conv.updated_at).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Vista previa del contenido */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Vista Previa
                  </h3>
                  {selectedConversation && conversationContent && (
                    <Button
                      size="sm"
                      onClick={handleDownloadPdf}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Descargar PDF
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[400px] border rounded-md">
                  {loadingContent ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedConversation && conversationContent ? (
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">{selectedConversation.title}</h4>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {conversationContent.messages.length} mensajes
                          </Badge>
                          {conversationContent.mindMaps.length > 0 && (
                            <Badge variant="secondary">
                              <Brain className="h-3 w-3 mr-1" />
                              {conversationContent.mindMaps.length} mapas
                            </Badge>
                          )}
                          {conversationContent.fichas.length > 0 && (
                            <Badge variant="secondary">
                              <FileText className="h-3 w-3 mr-1" />
                              {conversationContent.fichas.length} fichas
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="messages">
                          <AccordionTrigger className="text-sm">
                            Mensajes ({conversationContent.messages.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {conversationContent.messages.slice(0, 10).map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`p-2 rounded text-xs ${
                                    msg.role === "user" ? "bg-blue-50" : "bg-gray-50"
                                  }`}
                                >
                                  <p className="font-medium">{msg.role === "user" ? "Usuario" : "Asistente"}</p>
                                  <p className="truncate">{msg.message}</p>
                                </div>
                              ))}
                              {conversationContent.messages.length > 10 && (
                                <p className="text-xs text-muted-foreground text-center">
                                  ...y {conversationContent.messages.length - 10} mensajes más
                                </p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {conversationContent.mindMaps.length > 0 && (
                          <AccordionItem value="mindmaps">
                            <AccordionTrigger className="text-sm">
                              Mapas Mentales ({conversationContent.mindMaps.length})
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {conversationContent.mindMaps.map((mm) => (
                                  <div key={mm.id} className="p-2 bg-muted rounded text-xs">
                                    <p className="font-medium">{mm.tema}</p>
                                    <p className="text-muted-foreground">
                                      {new Date(mm.created_at).toLocaleDateString("es-ES")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {conversationContent.fichas.length > 0 && (
                          <AccordionItem value="fichas">
                            <AccordionTrigger className="text-sm">
                              Fichas Didácticas ({conversationContent.fichas.length})
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {conversationContent.fichas.map((ficha) => (
                                  <div key={ficha.id} className="p-2 bg-amber-50 rounded text-xs">
                                    <p className="font-medium">{ficha.pregunta}</p>
                                    <p className="text-muted-foreground truncate">{ficha.respuesta}</p>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Selecciona una conversación para ver el contenido
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { useState, useEffect, useRef } from "react";
import { Plus, MessageSquare, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User } from "@/lib/types";
interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  first_message?: string;
}
interface AppSidebarProps {
  user: User;
  currentConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
}
export function AppSidebar({
  user,
  currentConversationId,
  onConversationSelect,
  onNewConversation
}: AppSidebarProps) {
  const {
    open: sidebarOpen
  } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (user) {
      loadConversations(true); // Carga inicial con loading

      // Subscribe to realtime updates
      const channel = supabase.channel('conversations-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadConversations(false); // Actualización silenciosa sin loading
      }).on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadConversations(false);
      }).subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);
  const loadConversations = async (showLoading: boolean = false) => {
    try {
      if (!user) {
        console.log('No user found, skipping conversations load');
        return;
      }
      console.log('Loading conversations for user:', user.id);
      if (showLoading) setLoading(true);
      const {
        data: conversationsData,
        error
      } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('updated_at', {
        ascending: false
      });
      if (error) {
        console.error('Error loading conversations:', error);
        toast.error("Error cargando conversaciones");
        setLoading(false);
        return;
      }

      // Obtener el título actualizado o el primer mensaje de cada conversación
      const conversationsWithTitle = await Promise.all((conversationsData || []).map(async conv => {
        // Si el título ya es descriptivo, usarlo
        if (conv.title && conv.title !== 'Nueva conversación' && !conv.title.startsWith('Hola') && conv.title.length >= 15) {
          return {
            ...conv,
            first_message: conv.title
          };
        }

        // Si no, obtener el primer mensaje del usuario
        const {
          data: messages
        } = await supabase.from('messages').select('message').eq('conversation_id', conv.id).eq('role', 'user').order('created_at', {
          ascending: true
        }).limit(1).maybeSingle();
        return {
          ...conv,
          first_message: messages?.message || conv.title || 'Nueva conversación'
        };
      }));
      console.log('Conversations loaded:', conversationsWithTitle.length);
      setConversations(conversationsWithTitle);
      setLoading(false);
    } catch (error) {
      console.log("error: ", error);
    }
  };
  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setDeletingId(conversationId);
    const {
      error
    } = await supabase.from('conversations').delete().eq('id', conversationId);
    if (error) {
      toast.error("Error eliminando conversación");
      console.error('Error deleting conversation:', error);
    } else {
      toast.success("Conversación eliminada");
      if (currentConversationId === conversationId) {
        onNewConversation();
      }
    }
    setDeletingId(null);
  };
  const handleStartEdit = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditTitle(conversation.first_message || conversation.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };
  const handleSaveTitle = async (e: React.MouseEvent | React.KeyboardEvent, conversationId: string) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    const {
      error
    } = await supabase.from('conversations').update({
      title: editTitle.trim()
    }).eq('id', conversationId);
    if (error) {
      toast.error("Error actualizando título");
      console.error('Error updating title:', error);
    } else {
      setConversations(prev => prev.map(c => c.id === conversationId ? {
        ...c,
        title: editTitle.trim(),
        first_message: editTitle.trim()
      } : c));
    }
    setEditingId(null);
  };
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  // Cuando está colapsado, no mostrar nada (solo el trigger externo)
  if (!sidebarOpen) {
    return null;
  }
  return <Sidebar className="w-64" collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">BIEX</span>
          </div>
          
          <Button onClick={onNewConversation} className="w-full">
            <Plus className="h-4 w-4" />
            <span className="ml-2">Nuevo chat</span>
          </Button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">
            Conversaciones
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            {loading ? <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div> : <SidebarMenu>
                {conversations.map(conversation => <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton onClick={() => editingId !== conversation.id && onConversationSelect(conversation.id)} isActive={currentConversationId === conversation.id} className="group relative w-full">
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        {editingId === conversation.id ? <>
                            <Input ref={editInputRef} value={editTitle} onChange={e => setEditTitle(e.target.value)} onClick={e => e.stopPropagation()} onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveTitle(e, conversation.id);
                      if (e.key === 'Escape') handleCancelEdit(e as any);
                    }} className="h-6 text-sm py-0 px-1 flex-1" />
                            <div role="button" tabIndex={0} className="h-5 w-5 flex items-center justify-center hover:bg-accent rounded-sm cursor-pointer text-green-600" onClick={e => handleSaveTitle(e, conversation.id)}>
                              <Check className="h-3 w-3" />
                            </div>
                            <div role="button" tabIndex={0} className="h-5 w-5 flex items-center justify-center hover:bg-accent rounded-sm cursor-pointer text-destructive" onClick={handleCancelEdit}>
                              <X className="h-3 w-3" />
                            </div>
                          </> : <>
                            <span className="flex-1 truncate text-left text-sm">
                              {conversation.first_message}
                            </span>
                            <div role="button" tabIndex={0} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-accent rounded-sm shrink-0 cursor-pointer" onClick={e => handleStartEdit(e, conversation)}>
                              <Pencil className="h-3 w-3" />
                            </div>
                            <div role="button" tabIndex={0} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-accent rounded-sm shrink-0 cursor-pointer" onClick={e => handleDelete(e, conversation.id)} onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDelete(e as any, conversation.id);
                      }
                    }}>
                              {deletingId === conversation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </div>
                          </>}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
              </SidebarMenu>}
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Desarrollado por <span className="font-semibold">Huble .Ing</span>
          </p>
        </div>
      </SidebarContent>
    </Sidebar>;
}
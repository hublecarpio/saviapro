import { useState, useEffect } from "react";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
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
  const { open: sidebarOpen } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConversations(true); // Carga inicial con loading
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('conversations-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadConversations(false); // Actualización silenciosa sin loading
          }
        )
        .subscribe();

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
    
    const { data: conversationsData, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      toast.error("Error cargando conversaciones");
      setLoading(false);
      return;
    }

    // Obtener el primer mensaje de cada conversación
    const conversationsWithFirstMessage = await Promise.all(
      (conversationsData || []).map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('message')
          .eq('conversation_id', conv.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        return {
          ...conv,
          first_message: messages?.message || conv.title
        };
      })
    );

    console.log('Conversations loaded:', conversationsWithFirstMessage.length);
    setConversations(conversationsWithFirstMessage);
    setLoading(false);
    } catch (error) {
      console.log("error: ", error)
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    setDeletingId(conversationId);
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

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

  return (
    <Sidebar className={sidebarOpen ? "w-64" : "w-14"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            {sidebarOpen && (
              <span className="font-semibold text-foreground">BIEX</span>
            )}
          </div>
          
          <Button
            onClick={onNewConversation}
            className="w-full"
            size={sidebarOpen ? "default" : "icon"}
          >
            <Plus className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">Nuevo chat</span>}
          </Button>
        </div>

        <SidebarGroup>
          {sidebarOpen && (
            <SidebarGroupLabel className="text-muted-foreground">
              Conversaciones
            </SidebarGroupLabel>
          )}
          
          <SidebarGroupContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      onClick={() => onConversationSelect(conversation.id)}
                      isActive={currentConversationId === conversation.id}
                      className="group relative w-full"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {sidebarOpen && (
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="flex-1 truncate text-left text-sm">
                            {conversation.first_message}
                          </span>
                          <div
                            role="button"
                            tabIndex={0}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-accent rounded-sm shrink-0 cursor-pointer"
                            onClick={(e) => handleDelete(e, conversation.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDelete(e as any, conversation.id);
                              }
                            }}
                          >
                            {deletingId === conversation.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {sidebarOpen && (
          <div className="mt-auto p-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Desarrollado por <span className="font-semibold">Huble .Ing</span>
            </p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
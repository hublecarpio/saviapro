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
import { AdminOptions } from "./user/AdminOptions";
import {  TutorOptions } from "./user/TutorOptions";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  first_message?: string;
}

interface AppSidebarProps {
  user: User | null;
  role: string;
  // currentConversationId: string | null;
  // onConversationSelect: (id: string) => void;
  //onNewConversation: () => void;
}

export function AppSidebarBeta({
  user,
  role
  // currentConversationId, 
  //onConversationSelect,
  // onNewConversation 
}: AppSidebarProps) {
  // validar el tipo de usuario
  const { open: sidebarOpen } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = role === 'admin' || role === 'tutor';
  return (
    <Sidebar className={sidebarOpen ? "w-64" : "w-14"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">

            {sidebarOpen ? (
              <img
                className="w-1/2 mx-auto"
                src="/uhd8c1.png"
                alt="Logo BIEXT"
                loading="lazy"
              />
            ) : <img
              className="w-6 h-6 mx-auto"
              src="/icono.png"
              alt="Logo BIEXT"
              loading="lazy"
            />}
          </div>

          {
            isAdmin ? '' : <Button
              // onClick={onNewConversation}
              className="w-full"
              size={sidebarOpen ? "default" : "icon"}
            >
              <Plus className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2">Nuevo chat</span>}
            </Button>
          }

        </div>

        <SidebarGroup>
          {
            role == 'admin' ? <AdminOptions /> : role == 'tutor' ? <TutorOptions /> : 'p'
          }
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
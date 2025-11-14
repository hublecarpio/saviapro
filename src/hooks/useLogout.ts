import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/useUserStore";

export const handleLogout = async () => {
  await supabase.auth.signOut();
  useUserStore.getState().reset();
};

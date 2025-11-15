import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/useUserStore";

export const destroyUser = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.warn("Supabase logout failed, forcing local cleanup", e);
  }

  const { reset } = useUserStore.getState();
  reset();

  localStorage.setItem("biex-user", JSON.stringify({
    state: { user: {
      id: null,
      email: null,
      name: null,
      roles: [],
      starterCompleted: false,
      isAuthenticated: false,
      loading: false,
      error: null,
    }},
    version: 0
  }));
};

// services/auth.service.ts
import { supabase } from "@/integrations/supabase/client";

export const authService = {
  async login(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signup(email: string, password: string, name?: string) {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/starter`,
        data: { name: name || email.split("@")[0] }
      }
    });
  },

  async isInvited(email: string) {
    return await supabase
      .from("invited_users")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single();
  },

  async markInviteUsed(email: string) {
    return await supabase.rpc("mark_invited_user_used", {
      user_email: email.toLowerCase()
    });
  },

  async getRoles(userId: string) {
    return await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
  },

  async getProfile(userId: string) {
    return await supabase
      .from("profiles")
      .select("starter_completed")
      .eq("id", userId)
      .single();
  },

  async assignStudentRole(userId: string) {
    return await supabase.from("user_roles").insert({
      user_id: userId,
      role: "student"
    });
  }
};

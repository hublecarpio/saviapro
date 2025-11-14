import { supabase } from "@/integrations/supabase/client";
import { authSchema } from '@/lib/utils';
import React, { useEffect, useState } from 'react'
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Eye, EyeOff } from "lucide-react";
import z from "zod";
import { useUserStore } from "@/store/useUserStore";
import { toast } from 'sonner';
import { useNavigate } from "react-router-dom";
import { handleLogout } from "@/hooks/useLogout";
export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const userStore = useUserStore.getState();
  const { user } = useUserStore();
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("SESIÓN INICIAL:", session);
    };

    fetchSession();
  }, []);


  const navigate = useNavigate();
  console.log(user);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = authSchema.parse({
        email,
        password,
      });
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        setLoading(false);
        throw error;
      }

      if (data.user) {
        console.log("Login exitoso, usuario:", data.user.id);
        userStore.setUser({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || null,
          isAuthenticated: true,
          loading: false,
          error: null,
        });
        redirect(data.user.id);
      }
    } catch (error) {
      console.error("Error en handleSignIn:", error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
      setLoading(false);
    }
  };
  const redirect = async (userid: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", userid);

      if (rolesError) {
        console.error("Error al obtener roles:", rolesError);
        toast.error("Error al verificar permisos");
        setLoading(false);
        return;
      }

      if (roles?.some((r) => r.role === "admin")) {
        navigate("/admin");
        return;
      } else if (roles?.some((r) => r.role === "tutor")) {
        navigate("/tutor");
        return;
      } else {
        // Verificar si completó el starter
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("starter_completed")
          .eq("id", userid)
          .single();

        if (profileError) {
          console.error("Error al obtener perfil:", profileError);
          // Si no existe el perfil, ir a starter
          navigate("/starter");
          return;
        } else if (profile?.starter_completed) {
          navigate("/chat");
          return;
        } else {
          navigate("/starter");
          return;
        }
      }
    } catch (error) {
      console.error("Error en redirectBasedOnRole:", error);
      toast.error("Error al iniciar sesión");
      setLoading(false);
    }
  }
  return (
    <>
      <button onClick={() => handleLogout()}> salir </button>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="signin-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signin-password" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
          {loading ? "Iniciando..." : "Iniciar Sesión"}
        </Button>
      </form>
    </>
  )
}

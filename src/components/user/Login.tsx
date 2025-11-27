import { supabase } from "@/integrations/supabase/client";
import { authSchema } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import z from "zod";
import { useUserStore } from "@/store/useUserStore";
import { toast } from 'sonner';
import { useNavigate } from "react-router-dom";
import { destroyUser } from "@/hooks/useLogout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const navigate = useNavigate();

  const setUser = useUserStore((s) => s.setUser);
  const setRoles = useUserStore((s) => s.setRoles);
  const reset = useUserStore((s) => s.reset);
  const {user} = useUserStore();
console.log(user)

const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const validated = authSchema.parse({ email, password });

    // 🧹 1. Limpiar sesión anterior SOLO al iniciar login
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    reset();

    // 🟢 2. Login real
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) throw error;

    const user = data.user;

    // 🟢 3. Guardar usuario en store
    setUser({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || null,
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    // 🟢 4. Cargar roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    setRoles(roles?.map((r) => r.role) || []);

    // 🟢 5. Redirect limpio
    await redirect(user.id, roles);

  } catch (error: any) {
    console.error("Error en handleSignIn:", error);

    if (error instanceof z.ZodError) {
      toast.error(error.errors[0].message);
    } else {
      toast.error(error.message || "Error al iniciar sesión");
    }
  }

  setLoading(false);
};


  const redirect = async (userid: string, roles: any[]) => {
    if (roles?.some((r) => r.role === "admin")) {
      navigate("/admin");
      return;
    }

    if (roles?.some((r) => r.role === "tutor")) {
      navigate("/tutor");
      return;
    }

    // Usuarios normales → revisar starter
    const { data: profile } = await supabase
      .from("profiles")
      .select("starter_completed")
      .eq("id", userid)
      .single();

    if (profile?.starter_completed) navigate("/chat");
    else navigate("/starter");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast.error("Por favor ingresa tu correo electrónico");
      return;
    }

    // Validar email
    try {
      z.string().email().parse(forgotPasswordEmail);
    } catch {
      toast.error("Por favor ingresa un correo válido");
      return;
    }

    setIsRecovering(true);

    try {
      // Llamar al API de recuperación de contraseña
      const response = await fetch("https://webhook.hubleconsulting.com/webhook/apicorreo88a1a578-5653-457a-b408-ae3cbb06cff6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotPasswordEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar el correo");
      }

      toast.success("Se ha enviado un correo con las instrucciones para recuperar tu contraseña");
      setIsForgotPasswordOpen(false);
      setForgotPasswordEmail("");
    } catch (error: any) {
      console.error("Error en recuperación de contraseña:", error);
      toast.error(error.message || "Error al enviar el correo de recuperación");
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
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
          <Label>Contraseña</Label>
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
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
          {loading ? "Iniciando..." : "Iniciar Sesión"}
        </Button>
      </form>

      {/* Botón de olvidaste tu contraseña */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="link" 
            className="w-full mt-2 text-sm text-muted-foreground hover:text-primary"
          >
            ¿Olvidaste tu contraseña?
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu correo electrónico y te enviaremos las instrucciones para recuperar tu contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Correo electrónico</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="tu@email.com"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11" 
              disabled={isRecovering}
            >
              {isRecovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar correo de recuperación"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

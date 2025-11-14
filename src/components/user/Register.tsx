// src/components/user/Register.tsx

import { useState } from "react";
import { signupSchema } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Info } from "lucide-react";
import { authSchema } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import z from "zod";
import { toast } from 'sonner';
import { Alert, AlertDescription } from "../ui/alert";
export const Register = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = authSchema.parse({
        email,
        password,
        name,
      });
      setLoading(true);

      // Verificar si el email está en la lista de invitados
      const { data: invitedUser } = await supabase
        .from("invited_users")
        .select("*")
        .eq("email", validated.email.toLowerCase())
        .eq("used", false)
        .single();
      if (!invitedUser) {
        toast.error("Este correo no está autorizado para registrarse. Contacta al administrador.");
        setLoading(false);
        return;
      }

      // Crear cuenta
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/starter`,
          data: {
            name: validated.name || validated.email.split("@")[0],
          },
        },
      });
      if (signUpError) {
        // Verificar si el error es porque el usuario ya existe
        if (
          signUpError.message?.includes("already registered") ||
          signUpError.message?.includes("User already registered")
        ) {
          toast.error("Este correo ya tiene una cuenta. Por favor, inicia sesión en su lugar.");
          setLoading(false);
          return;
        }
        throw signUpError;
      }
      if (authData.user) {
        // Asignar rol de estudiante
        await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "student",
        });

        // Marcar usuario invitado como usado
        await supabase.rpc("mark_invited_user_used", {
          user_email: validated.email.toLowerCase(),
        });
      }
      toast.success("Cuenta creada exitosamente. ¡Bienvenido!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Solo puedes registrarte si tu correo ha sido autorizado por un administrador
        </AlertDescription>
      </Alert>
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-name" className="text-sm font-medium">
            Nombre <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="signup-name"
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-sm font-medium">
            Email autorizado
          </Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="signup-password"
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
          {loading ? "Creando cuenta..." : "Crear Cuenta"}
        </Button>
      </form>
    </>
  );
};

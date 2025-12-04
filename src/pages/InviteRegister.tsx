import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().trim().min(1, "El nombre es requerido").max(100),
});

const InviteRegister = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from("invited_users")
        .select("email, used")
        .eq("token", token)
        .eq("used", false)
        .maybeSingle();

      if (error || !data) {
        toast.error("Token de invitación inválido o expirado");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      setInviteEmail(data.email);
      setValidToken(true);
    } catch (error) {
      console.error("Error validating token:", error);
      toast.error("Error al validar la invitación");
      navigate("/");
    } finally {
      setValidating(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validToken) {
      toast.error("Token de invitación inválido");
      return;
    }

    try {
      const validationResult = registerSchema.safeParse({
        email: inviteEmail,
        password,
        name,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => err.message).join(", ");
        toast.error(errors);
        return;
      }

      setLoading(true);

      // Intentar crear usuario en Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/starter`,
          data: { name }
        }
      });

      let userId: string | null = null;

      if (signUpError) {
        if (signUpError.message.includes("User already registered")) {
          // Usuario ya existe - intentar iniciar sesión
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: inviteEmail,
            password,
          });

          if (signInError) {
            toast.error("Este email ya está registrado. Ingresa tu contraseña actual para continuar.");
            return;
          }

          userId = signInData.user?.id ?? null;
          toast.info("Usuario existente. Asignando nuevo rol...");
        } else {
          toast.error(signUpError.message);
          return;
        }
      } else {
        userId = authData.user?.id ?? null;
      }

      if (!userId) {
        toast.error("Error al crear la cuenta");
        return;
      }

      // Marcar invitación como usada
      const { error: updateError } = await supabase.rpc("mark_invited_user_used", {
        user_email: inviteEmail.toLowerCase()
      });

      if (updateError) {
        console.error("Error al marcar invitación:", updateError);
      }

      // Esperar un momento para que se procesen los triggers (asignación de rol)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verificar el rol asignado para redirigir correctamente
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const isTutor = userRole?.role === "tutor";
      const isAdmin = userRole?.role === "admin";

      toast.success("Cuenta configurada exitosamente. Redirigiendo...");
      
      // Redirigir según el rol
      setTimeout(() => {
        if (isAdmin) {
          navigate("/admin");
        } else if (isTutor) {
          navigate("/tutor/dashboard");
        } else {
          navigate("/starter");
        }
      }, 500);

    } catch (error) {
      console.error("Error en registro:", error);
      toast.error("Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p>Validando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-4 text-center pb-6">
            <div>
              <img
                className="w-1/2 mx-auto mb-4"
                src="/uhd8c1.png"
                alt="Logo BIEXT"
                loading="lazy"
              />
              <CardTitle className="text-2xl font-semibold">
                Crear tu cuenta
              </CardTitle>
              <CardDescription>
                Has sido invitado a unirte a la plataforma
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Alert className="mb-4">
              <AlertDescription>
                Registrándote con: <strong>{inviteEmail}</strong>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InviteRegister;

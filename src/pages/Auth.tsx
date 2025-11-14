import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Info, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { Login } from "@/components/user/Login";
import { Register } from "@/components/user/Register";
const authSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().trim().optional(),
});
const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /**
   * 
   * useEffect(() => {
    const checkSessionAndRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await redirectBasedOnRole(session.user.id);
      }
    };
    checkSessionAndRedirect();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          redirectBasedOnRole(session.user.id);
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", userId);

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
          .eq("id", userId)
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
  };
   */


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center"></div>
            <div>
              <CardTitle className="text-3xl font-semibold">
                <img
                  className="w-1/2 mx-auto"
                  src="https://files.catbox.moe/uhd8c1.png"
                  alt="Logo BIEXT"
                  loading="lazy"
                />
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <Login />
              </TabsContent>

              <TabsContent value="signup">

                <Register />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default Auth;

import { AppSidebarBeta } from "@/components/AppSidebarBeta";
import { NavBarUser } from "@/components/NavBarUser";
import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import { useEffect, useState } from "react";

export function DashboardLayout({ children }) {
    const [loading, setLoading] = useState(true);

    const user = useUserStore((s) => s.user);
    const setUser = useUserStore((s) => s.setUser);
    const setRoles = useUserStore((s) => s.setRoles);
    const reset = useUserStore((s) => s.reset);
    useEffect(() => {
        const loadSession = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                reset();
                setLoading(false);
                return;
            }

            // Cargar roles
            const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id);

            // Cargar perfil (name desde tabla profiles, igual que useAuth)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('name, starter_completed')
                .eq('id', user.id)
                .single();

            setUser({
                id: user.id,
                email: user.email,
                name: profileData?.name || null,
                isAuthenticated: true,
                loading: false,
                starterCompleted: profileData?.starter_completed || false,
            });

            setRoles(roles?.map((r) => r.role) || []);

            setLoading(false);
        };

        loadSession();
    }, []);
    const [isSigningOut, setIsSigningOut] = useState(false);

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <AppSidebarBeta user={user} role={user?.roles[0]} />
                <div className="flex flex-col flex-1">
                    <NavBarUser user={user} setShowProfileEditor={null} isSigningOut={isSigningOut} />
                    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20">
                        {children}
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
}

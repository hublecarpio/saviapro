import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/useUserStore';
import { toast } from 'sonner';

export const useAuth = () => {
  const navigate = useNavigate();
  const { user, setUser, setLoading, setError, reset } = useUserStore();

  // Función para cargar datos del usuario (useCallback para evitar recreación)
  const loadUserData = useCallback(async (userId: string) => {
    try {
      setLoading(true);

      // Obtener roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const roles = rolesData?.map((r) => r.role) || [];

      // Obtener perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, starter_completed')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error al cargar perfil:', profileError);
      }

      // Obtener email del usuario
      const { data: { user: authUser } } = await supabase.auth.getUser();

      setUser({
        id: userId,
        email: authUser?.email || null,
        name: profileData?.name || null,
        roles,
        starterCompleted: profileData?.starter_completed || false,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      return { roles, starterCompleted: profileData?.starter_completed || false };
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      setError('Error al cargar datos del usuario');
      setLoading(false);
      return null;
    }
  }, [setUser, setLoading, setError]);

  // Función para redirigir basado en rol
  const redirectBasedOnRole = useCallback((roles: string[], starterCompleted: boolean) => {
    if (roles.includes('admin')) {
      navigate('/admin', { replace: true });
    } else if (roles.includes('tutor')) {
      navigate('/tutor', { replace: true });
    } else if (starterCompleted) {
      navigate('/chat', { replace: true });
    } else {
      navigate('/starter', { replace: true });
    }
  }, [navigate]);

  // Función de login
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const userData = await loadUserData(data.user.id);
        if (userData) {
          // Pequeño delay para evitar race conditions
          setTimeout(() => {
            redirectBasedOnRole(userData.roles, userData.starterCompleted);
          }, 100);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error en login:', error);
      setError(error.message);
      setLoading(false);
      toast.error(error.message || 'Error al iniciar sesión');
      return { success: false, error: error.message };
    }
  };

  // Función de registro
  const register = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast.success('Registro exitoso. Por favor verifica tu correo.');
        return { success: true };
      }

      return { success: false };
    } catch (error: any) {
      console.error('Error en registro:', error);
      setError(error.message);
      setLoading(false);
      toast.error(error.message || 'Error al registrarse');
      return { success: false, error: error.message };
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      reset();
      navigate('/', { replace: true });
      toast.success('Sesión cerrada exitosamente');
    } catch (error: any) {
      console.error('Error en logout:', error);
      toast.error('Error al cerrar sesión');
      setLoading(false);
    }
  };

  // Inicializar sesión al montar el hook
  const initializeAuth = useCallback(async () => {
    try {
      setLoading(true);

      // Verificar sesión actual
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error al inicializar auth:', error);
      setLoading(false);
    }
  }, [loadUserData, setLoading]);

  // Listener de cambios de autenticación - SOLO SE CONFIGURA UNA VEZ
  useEffect(() => {
    let isSubscribed = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;

        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await loadUserData(session.user.id);
          if (userData && window.location.pathname === '/') {
            setTimeout(() => {
              redirectBasedOnRole(userData.roles, userData.starterCompleted);
            }, 100);
          }
        } else if (event === 'SIGNED_OUT') {
          reset();
          navigate('/', { replace: true });
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        }
      }
    );

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, redirectBasedOnRole, reset, navigate]); // Dependencias estables

  return {
    user,
    login,
    register,
    logout,
    initializeAuth,
    loadUserData,
  };
};
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Este componente inicializa la autenticación al montar la app
 * Debe envolver a los Routes en App.tsx
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { initializeAuth } = useAuth();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      initializeAuth();
      setInitialized(true);
    }
  }, [initialized, initializeAuth]);

  return <>{children}</>;
};
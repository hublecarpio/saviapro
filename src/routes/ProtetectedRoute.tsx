import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // Opcional: roles requeridos
  requireStarter?: boolean; // Opcional: requiere starter completado
}

export const ProtectedRoute = ({
  children,
  requiredRoles,
  requireStarter = false,
}: ProtectedRouteProps) => {
  const user = useUserStore((state) => state.user);
  const location = useLocation();
  // Mostrar loading mientras se verifica la sesión
  if (user.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!user.isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Verificar roles requeridos
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles.includes(role)
    );
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  // Verificar si requiere starter completado
  if (requireStarter && !user.starterCompleted) {
    return <Navigate to="/starter" replace />;
  }

  return <>{children}</>;
};
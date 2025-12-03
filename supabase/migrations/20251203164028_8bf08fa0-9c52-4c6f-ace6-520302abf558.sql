-- Crear trigger que asigna rol automáticamente cuando se crea un profile (después de registrarse)
CREATE OR REPLACE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_role_based_on_inviter();
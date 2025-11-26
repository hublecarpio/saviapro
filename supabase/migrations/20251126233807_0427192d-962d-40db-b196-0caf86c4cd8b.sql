-- Función para asignar rol de estudiante automáticamente a usuarios invitados
CREATE OR REPLACE FUNCTION public.assign_student_role_to_invited_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_invited BOOLEAN;
BEGIN
  -- Verificar si el email del nuevo usuario está en invited_users
  SELECT EXISTS (
    SELECT 1
    FROM public.invited_users
    WHERE email = NEW.email
    AND used = FALSE
  ) INTO is_invited;
  
  -- Si fue invitado, asignar rol de estudiante
  IF is_invited THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que se ejecuta después de crear un usuario en auth.users
CREATE TRIGGER on_auth_user_created_assign_student_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_student_role_to_invited_user();
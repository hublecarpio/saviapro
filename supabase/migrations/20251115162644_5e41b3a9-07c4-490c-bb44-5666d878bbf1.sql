-- Primero eliminar la política incorrecta
DROP POLICY IF EXISTS "Tutors can assign student role to invited users" ON public.user_roles;

-- Crear función de seguridad definer para verificar si un usuario fue invitado por el tutor
CREATE OR REPLACE FUNCTION public.user_was_invited_by_tutor(_user_id uuid, _tutor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Obtener el email del usuario desde auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = _user_id;
  
  -- Verificar si existe una invitación de ese tutor para ese email
  RETURN EXISTS (
    SELECT 1
    FROM public.invited_users
    WHERE email = user_email
      AND created_by = _tutor_id
  );
END;
$$;

-- Crear la política correcta usando la función
CREATE POLICY "Tutors can assign student role to invited users"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role = 'student' AND
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'tutor'
  ) AND
  public.user_was_invited_by_tutor(user_roles.user_id, auth.uid())
);
-- Modificar el trigger para asignar roles según quien invitó
CREATE OR REPLACE FUNCTION public.assign_role_based_on_inviter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invite_creator_role app_role;
BEGIN
  -- Obtener el rol del usuario que creó la invitación
  SELECT ur.role INTO invite_creator_role
  FROM public.invited_users iu
  JOIN public.user_roles ur ON ur.user_id = iu.created_by
  WHERE iu.email = NEW.email
  AND iu.used = FALSE
  LIMIT 1;
  
  -- Si fue invitado por un admin, asignar rol tutor
  IF invite_creator_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tutor'::app_role);
    
  -- Si fue invitado por un tutor, asignar rol student
  ELSIF invite_creator_role = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::app_role);
    
    -- También crear la relación tutor-estudiante
    INSERT INTO public.tutor_students (tutor_id, student_id)
    SELECT iu.created_by, NEW.id
    FROM public.invited_users iu
    WHERE iu.email = NEW.email
    AND iu.used = FALSE
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Eliminar el trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el nuevo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.assign_role_based_on_inviter();
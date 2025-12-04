-- Añadir columna intended_role a invited_users para que admin pueda elegir qué rol asignar
ALTER TABLE public.invited_users 
ADD COLUMN intended_role public.app_role DEFAULT 'tutor';

-- Actualizar el trigger para usar el intended_role cuando el invitador es admin
CREATE OR REPLACE FUNCTION public.assign_role_based_on_inviter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_creator_role app_role;
  invite_intended_role app_role;
BEGIN
  -- Obtener el rol del usuario que creó la invitación y el rol pretendido
  SELECT ur.role, iu.intended_role INTO invite_creator_role, invite_intended_role
  FROM public.invited_users iu
  JOIN public.user_roles ur ON ur.user_id = iu.created_by
  WHERE iu.email = NEW.email
  AND iu.used = FALSE
  LIMIT 1;
  
  -- Si fue invitado por un admin, usar el intended_role
  IF invite_creator_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(invite_intended_role, 'tutor'::app_role));
    
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
$$;
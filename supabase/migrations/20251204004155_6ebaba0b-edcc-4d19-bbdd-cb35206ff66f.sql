-- Función para asignar rol desde invitación a usuarios existentes
CREATE OR REPLACE FUNCTION public.assign_role_from_invitation(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intended_role app_role;
  v_created_by uuid;
BEGIN
  -- Obtener el rol pretendido y quien creó la invitación
  SELECT intended_role, created_by INTO v_intended_role, v_created_by
  FROM public.invited_users
  WHERE email = lower(p_email)
  AND used = FALSE
  LIMIT 1;
  
  -- Si no hay invitación, no hacer nada
  IF v_intended_role IS NULL THEN
    RETURN;
  END IF;
  
  -- Verificar si ya tiene este rol
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = v_intended_role) THEN
    RETURN;
  END IF;
  
  -- Insertar el nuevo rol
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_intended_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Si es estudiante y fue invitado por un tutor, crear relación
  IF v_intended_role = 'student' AND v_created_by IS NOT NULL THEN
    INSERT INTO public.tutor_students (tutor_id, student_id)
    VALUES (v_created_by, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
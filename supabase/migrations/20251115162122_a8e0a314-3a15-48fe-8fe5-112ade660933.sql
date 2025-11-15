-- Permitir a tutores asignar rol de estudiante a usuarios que ellos invitaron
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
  EXISTS (
    SELECT 1
    FROM public.invited_users iu
    INNER JOIN auth.users u ON u.email = iu.email
    WHERE u.id = user_roles.user_id
      AND iu.created_by = auth.uid()
  )
);
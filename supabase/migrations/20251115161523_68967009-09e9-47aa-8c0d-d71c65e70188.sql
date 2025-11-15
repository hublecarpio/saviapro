-- Agregar política para que tutores puedan invitar estudiantes
CREATE POLICY "Tutors can insert invited users" 
ON public.invited_users 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'tutor'
  )
);
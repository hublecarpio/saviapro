-- Eliminar la política incorrecta de INSERT para tutores
DROP POLICY IF EXISTS "Tutors can insert invited users" ON public.invited_users;

-- Crear políticas correctas para tutores
-- SELECT: Los tutores pueden ver las invitaciones que ellos crearon
CREATE POLICY "Tutors can view their invited users"
ON public.invited_users
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tutor'::app_role) 
  AND created_by = auth.uid()
);

-- INSERT: Los tutores pueden invitar usuarios
CREATE POLICY "Tutors can invite users"
ON public.invited_users
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'tutor'::app_role)
  AND created_by = auth.uid()
);

-- UPDATE: Los tutores pueden actualizar sus propias invitaciones
CREATE POLICY "Tutors can update their invited users"
ON public.invited_users
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'tutor'::app_role)
  AND created_by = auth.uid()
);

-- DELETE: Los tutores pueden eliminar sus propias invitaciones
CREATE POLICY "Tutors can delete their invited users"
ON public.invited_users
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'tutor'::app_role)
  AND created_by = auth.uid()
);
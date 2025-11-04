-- Permitir a usuarios no autenticados verificar si su email está invitado
CREATE POLICY "Anyone can check if email is invited"
ON public.invited_users
FOR SELECT
TO public
USING (used = false);
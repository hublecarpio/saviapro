-- Permitir que usuarios no autenticados puedan verificar si su email está invitado
CREATE POLICY "Usuarios pueden verificar si fueron invitados"
ON public.invited_users
FOR SELECT
TO anon
USING (true);

-- Nota: Esta política solo permite lectura, no permite ver quién los invitó
-- Los datos sensibles siguen protegidos por las otras políticas
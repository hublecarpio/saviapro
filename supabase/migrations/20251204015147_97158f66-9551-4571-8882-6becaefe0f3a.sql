-- Crear política PERMISSIVE para permitir validación de tokens por usuarios anónimos
CREATE POLICY "Allow anonymous token validation" 
ON public.invited_users 
FOR SELECT 
TO anon
USING (true);

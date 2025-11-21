-- Eliminar la política peligrosa que expone emails públicamente
DROP POLICY IF EXISTS "Anyone can check if email is invited" ON public.invited_users;
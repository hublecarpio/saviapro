-- Eliminar trigger duplicado en profiles (ya existe uno en auth.users)
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
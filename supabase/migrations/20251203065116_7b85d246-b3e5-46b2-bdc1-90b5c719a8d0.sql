-- Eliminar el trigger antiguo que causa duplicados
DROP TRIGGER IF EXISTS on_auth_user_created_assign_student_role ON auth.users;

-- También eliminar la función antigua si ya no se usa
DROP FUNCTION IF EXISTS public.assign_student_role_to_invited_user();
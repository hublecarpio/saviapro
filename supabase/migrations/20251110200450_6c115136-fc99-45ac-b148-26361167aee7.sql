-- Drop the view to fix security definer issue
DROP VIEW IF EXISTS public.users_with_roles;

-- Ensure admins can view all user roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
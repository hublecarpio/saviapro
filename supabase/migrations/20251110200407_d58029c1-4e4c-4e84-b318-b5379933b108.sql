-- Add 'tutor' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tutor';

-- Create a view for admin dashboard to see all users with their roles
CREATE OR REPLACE VIEW public.users_with_roles AS
SELECT 
  p.id,
  p.email,
  p.name,
  p.created_at,
  p.starter_completed,
  COALESCE(
    json_agg(
      json_build_object('role', ur.role)
    ) FILTER (WHERE ur.role IS NOT NULL),
    '[]'::json
  ) as roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
GROUP BY p.id, p.email, p.name, p.created_at, p.starter_completed;

-- Create RLS policy for admins to view all users
CREATE POLICY "Admins can view all users"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
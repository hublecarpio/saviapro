-- Crear enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Crear tabla user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función de seguridad para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: Todos pueden ver sus propios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Solo admins pueden insertar roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Solo admins pueden actualizar roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Solo admins pueden eliminar roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Crear tabla para usuarios invitados
CREATE TABLE public.invited_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.invited_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins pueden ver usuarios invitados
CREATE POLICY "Admins can view invited users"
ON public.invited_users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins pueden crear usuarios invitados
CREATE POLICY "Admins can insert invited users"
ON public.invited_users
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins pueden actualizar usuarios invitados
CREATE POLICY "Admins can update invited users"
ON public.invited_users
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins pueden eliminar usuarios invitados
CREATE POLICY "Admins can delete invited users"
ON public.invited_users
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Crear tabla para configuración del sistema
CREATE TABLE public.system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Todos los autenticados pueden leer configuración
CREATE POLICY "Authenticated users can view config"
ON public.system_config
FOR SELECT
TO authenticated
USING (true);

-- Policy: Solo admins pueden actualizar configuración
CREATE POLICY "Admins can update config"
ON public.system_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insertar prompt maestro por defecto
INSERT INTO public.system_config (key, value) 
VALUES ('master_prompt', 'Eres BIEX 4.0, un tutor educativo personalizado para estudiantes. Tu objetivo es adaptar tu enseñanza al perfil único de cada estudiante.');

-- Función para marcar usuario invitado como usado
CREATE OR REPLACE FUNCTION public.mark_invited_user_used(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invited_users
  SET used = TRUE, used_at = NOW()
  WHERE email = user_email AND used = FALSE;
END;
$$;

-- Asignar rol admin a hublecarpio@gmail.com si existe
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'hublecarpio@gmail.com';
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
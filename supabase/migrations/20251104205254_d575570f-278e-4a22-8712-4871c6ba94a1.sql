-- Crear tabla para perfiles de starter
CREATE TABLE public.starter_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    age INTEGER,
    age_group TEXT,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.starter_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own starter profile"
ON public.starter_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own starter profile"
ON public.starter_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own starter profile"
ON public.starter_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all starter profiles"
ON public.starter_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Índice para búsquedas por usuario
CREATE INDEX idx_starter_profiles_user_id ON public.starter_profiles(user_id);
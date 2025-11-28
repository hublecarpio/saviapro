-- Agregar columna token a invited_users si no existe
ALTER TABLE public.invited_users 
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT gen_random_uuid()::text;
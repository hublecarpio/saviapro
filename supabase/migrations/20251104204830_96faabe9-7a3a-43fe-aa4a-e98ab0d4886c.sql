-- Agregar campo para saber si el usuario completó el starter
ALTER TABLE public.profiles
ADD COLUMN starter_completed BOOLEAN DEFAULT FALSE;
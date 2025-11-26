-- Asegurar que la tabla messages tenga REPLICA IDENTITY FULL
-- Esto permite que realtime envíe todos los datos del registro
ALTER TABLE public.messages REPLICA IDENTITY FULL;
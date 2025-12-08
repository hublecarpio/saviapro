-- Modificar tabla fichas_didacticas para formato quiz
ALTER TABLE public.fichas_didacticas 
ADD COLUMN opciones jsonb DEFAULT NULL,
ADD COLUMN respuesta_correcta integer DEFAULT NULL;

-- Comentario: opciones será un array JSON con 4 opciones, ej: ["opción A", "opción B", "opción C", "opción D"]
-- respuesta_correcta será el índice (0-3) de la opción correcta
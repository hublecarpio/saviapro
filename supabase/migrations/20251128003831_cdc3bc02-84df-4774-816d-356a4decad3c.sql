-- Crear tabla para fichas didácticas
CREATE TABLE IF NOT EXISTS public.fichas_didacticas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fichas_didacticas ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias fichas
CREATE POLICY "Users can view their own fichas"
ON public.fichas_didacticas
FOR SELECT
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden crear sus propias fichas
CREATE POLICY "Users can create their own fichas"
ON public.fichas_didacticas
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar sus propias fichas
CREATE POLICY "Users can delete their own fichas"
ON public.fichas_didacticas
FOR DELETE
USING (auth.uid() = user_id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_fichas_user_id ON public.fichas_didacticas(user_id);
CREATE INDEX idx_fichas_conversation_id ON public.fichas_didacticas(conversation_id);
CREATE INDEX idx_fichas_orden ON public.fichas_didacticas(conversation_id, orden);
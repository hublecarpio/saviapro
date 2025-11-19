-- Crear tabla para registrar documentos subidos
CREATE TABLE IF NOT EXISTS public.uploaded_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_mode TEXT NOT NULL CHECK (upload_mode IN ('file', 'text')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

-- Los admins pueden ver todos los documentos
CREATE POLICY "Admins can view all documents"
ON public.uploaded_documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Los admins pueden eliminar documentos
CREATE POLICY "Admins can delete documents"
ON public.uploaded_documents
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Los usuarios autenticados pueden insertar sus propios documentos
CREATE POLICY "Users can insert their own documents"
ON public.uploaded_documents
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);
-- Eliminar las políticas restrictivas actuales
DROP POLICY IF EXISTS "Admins can view all documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.uploaded_documents;

-- Crear políticas PERMISSIVAS para que funcionen correctamente
CREATE POLICY "Admins can view all documents" 
ON public.uploaded_documents 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete documents" 
ON public.uploaded_documents 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own documents" 
ON public.uploaded_documents 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

-- También agregar política para que usuarios vean sus propios documentos
CREATE POLICY "Users can view their own documents" 
ON public.uploaded_documents 
FOR SELECT 
USING (auth.uid() = uploaded_by);
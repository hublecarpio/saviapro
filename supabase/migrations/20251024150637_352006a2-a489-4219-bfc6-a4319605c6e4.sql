-- Crear bucket para archivos del chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Permitir a usuarios subir archivos en sus propias carpetas
CREATE POLICY "Users can upload files to their conversation folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

-- Permitir a usuarios leer archivos de sus conversaciones
CREATE POLICY "Users can read files from their conversations"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

-- Permitir generar URLs firmadas
CREATE POLICY "Users can create signed URLs for their files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'chat-files');
-- Habilitar la extensión vector primero
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla para almacenar documentos con embeddings para RAG
CREATE TABLE public.document_embeddings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_chunk TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    embedding vector(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para búsqueda por document_id
CREATE INDEX idx_document_embeddings_document_id ON public.document_embeddings(document_id);

-- RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Solo admins pueden ver y manipular embeddings
CREATE POLICY "Admins can view all embeddings"
ON public.document_embeddings
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert embeddings"
ON public.document_embeddings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete embeddings"
ON public.document_embeddings
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Política para permitir service role insertar embeddings (desde edge functions)
CREATE POLICY "Service role can manage embeddings"
ON public.document_embeddings
FOR ALL
USING (true)
WITH CHECK (true);

-- Función para búsqueda de similitud
CREATE OR REPLACE FUNCTION public.search_documents(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    content_chunk TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        de.id,
        de.document_id,
        de.content,
        de.content_chunk,
        1 - (de.embedding <=> query_embedding) AS similarity,
        de.metadata
    FROM public.document_embeddings de
    WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
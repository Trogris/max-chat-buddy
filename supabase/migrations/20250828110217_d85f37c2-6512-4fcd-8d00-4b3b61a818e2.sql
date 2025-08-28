-- Solução definitiva: recriar sistema de embeddings do zero
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Temporariamente desabilitar RLS para operações de manutenção
DROP POLICY IF EXISTS "Users can read document chunks from their documents" ON public.company_document_chunks;
DROP POLICY IF EXISTS "Admins can manage all document chunks" ON public.company_document_chunks;

-- Backup e recria tabela com estrutura correta
ALTER TABLE public.company_document_chunks RENAME TO company_document_chunks_old;

CREATE TABLE public.company_document_chunks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding extensions.vector(1536),
    page integer,
    filename text NOT NULL,
    path text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ativar RLS na nova tabela
ALTER TABLE public.company_document_chunks ENABLE ROW LEVEL SECURITY;

-- Recriar políticas RLS
CREATE POLICY "Users can read document chunks from their documents" ON public.company_document_chunks
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_documents 
        WHERE company_documents.id = company_document_chunks.document_id 
        AND company_documents.uploaded_by = auth.uid()
    )
);

CREATE POLICY "Admins can manage all document chunks" ON public.company_document_chunks
FOR ALL USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Função match_document_chunks corrigida
DROP FUNCTION IF EXISTS public.match_document_chunks(extensions.vector, integer, jsonb);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id uuid, document_id uuid, content text, page integer, filename text, similarity double precision)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cdc.id,
    cdc.document_id,
    cdc.content,
    cdc.page,
    cdc.filename,
    1.0 / (1.0 + (cdc.embedding <-> query_embedding)) AS similarity
  FROM public.company_document_chunks cdc
  WHERE 
    cdc.embedding IS NOT NULL
    AND (
      filter = '{}'::jsonb OR
      (filter ? 'document_ids' AND cdc.document_id = ANY(ARRAY(SELECT jsonb_array_elements_text(filter->'document_ids'))::uuid[]))
    )
  ORDER BY cdc.embedding <-> query_embedding
  LIMIT match_count;
END;
$function$;

-- Trigger para updated_at
CREATE TRIGGER update_company_document_chunks_updated_at
BEFORE UPDATE ON public.company_document_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remover tabela antiga após confirmação
DROP TABLE IF EXISTS public.company_document_chunks_old;
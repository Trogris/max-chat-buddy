-- Corrigir sistema de vetorização sem criar índices pesados
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Garantir tipo correto da coluna embedding
ALTER TABLE public.company_document_chunks
  ALTER COLUMN embedding TYPE extensions.vector(1536)
  USING CASE WHEN embedding IS NULL THEN NULL ELSE embedding::extensions.vector END;

-- Recriar função RPC com operador L2 mais compatível 
DROP FUNCTION IF EXISTS public.match_document_chunks(extensions.vector, integer, jsonb);
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, integer, jsonb);

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
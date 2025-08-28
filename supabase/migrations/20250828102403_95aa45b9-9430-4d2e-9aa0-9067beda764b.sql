-- Enable pgvector extension in the standard Supabase schema for extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Ensure the embedding column uses the correct pgvector type and dimension
-- (casts existing values when possible, preserves NULLs)
ALTER TABLE public.company_document_chunks
  ALTER COLUMN embedding TYPE extensions.vector(1536)
  USING CASE WHEN embedding IS NULL THEN NULL ELSE embedding::extensions.vector END;

-- Helpful indexes
-- Drop any previous embedding indexes to recreate with correct operator class
DROP INDEX IF EXISTS company_document_chunks_embedding_idx;
DROP INDEX IF EXISTS idx_company_document_chunks_embedding;

-- Vector index (IVFFlat) using L2 distance for broad compatibility
CREATE INDEX IF NOT EXISTS company_document_chunks_embedding_idx
  ON public.company_document_chunks
  USING ivfflat (embedding extensions.vector_l2_ops)
  WITH (lists = 100);

-- Speed up common filters
CREATE INDEX IF NOT EXISTS company_document_chunks_document_id_idx
  ON public.company_document_chunks (document_id);

-- Recreate the match_document_chunks function using L2 operator (<->) to avoid environments
-- where the cosine operator (<=>) may be unavailable
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

-- Update planner stats for better performance
ANALYZE public.company_document_chunks;
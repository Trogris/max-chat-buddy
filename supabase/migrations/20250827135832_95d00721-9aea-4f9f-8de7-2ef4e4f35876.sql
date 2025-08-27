-- Enable vector extension and fix operator issues
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure the vector type is properly configured
-- Drop and recreate the function with explicit casting if needed
CREATE OR REPLACE FUNCTION public.match_document_chunks(query_embedding extensions.vector, match_count integer DEFAULT 5, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, document_id uuid, content text, page integer, filename text, similarity double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    company_document_chunks.id,
    company_document_chunks.document_id,
    company_document_chunks.content,
    company_document_chunks.page,
    company_document_chunks.filename,
    1 - (company_document_chunks.embedding <=> query_embedding) AS similarity
  FROM company_document_chunks
  WHERE 
    company_document_chunks.embedding IS NOT NULL
    AND (
      filter = '{}'::jsonb OR
      (filter ? 'document_ids' AND company_document_chunks.document_id = ANY(ARRAY(SELECT jsonb_array_elements_text(filter->'document_ids'))::uuid[]))
    )
  ORDER BY company_document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$
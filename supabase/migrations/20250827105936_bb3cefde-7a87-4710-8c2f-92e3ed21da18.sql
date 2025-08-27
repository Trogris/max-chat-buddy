-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for document chunks with embeddings
CREATE TABLE public.company_document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002/text-embedding-3-small dimension
  page INTEGER, -- Page number for PDFs, NULL for other formats
  filename TEXT NOT NULL,
  path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_company_document_chunks_document_id ON public.company_document_chunks(document_id);
CREATE INDEX idx_company_document_chunks_embedding ON public.company_document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.company_document_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies similar to company_documents
CREATE POLICY "Admins can manage all document chunks" 
ON public.company_document_chunks 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can read document chunks from their documents" 
ON public.company_document_chunks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.company_documents 
    WHERE company_documents.id = company_document_chunks.document_id 
    AND company_documents.uploaded_by = auth.uid()
  )
);

-- Create function to match document chunks using semantic search
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page integer,
  filename text,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create trigger for updating timestamps
CREATE TRIGGER update_company_document_chunks_updated_at
BEFORE UPDATE ON public.company_document_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
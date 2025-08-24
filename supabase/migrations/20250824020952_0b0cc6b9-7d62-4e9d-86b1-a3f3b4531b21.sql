-- Add new columns to company_documents table for enhanced file processing
ALTER TABLE public.company_documents 
ADD COLUMN IF NOT EXISTS mime_type text,
ADD COLUMN IF NOT EXISTS size_bytes bigint,
ADD COLUMN IF NOT EXISTS pages int,
ADD COLUMN IF NOT EXISTS sheets jsonb,
ADD COLUMN IF NOT EXISTS truncated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS content_hash text;

-- Create index for content_hash for deduplication
CREATE INDEX IF NOT EXISTS company_documents_hash_idx ON public.company_documents (content_hash);

-- Update existing records to have default values
UPDATE public.company_documents 
SET 
  truncated = false,
  content_hash = md5(filename || ':' || COALESCE(file_type, '') || ':' || substr(content, 1, 1000))
WHERE content_hash IS NULL;
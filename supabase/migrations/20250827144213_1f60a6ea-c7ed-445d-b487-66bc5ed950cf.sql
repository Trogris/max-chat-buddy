-- Add document metadata fields for better access
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS keywords text[],
  ADD COLUMN IF NOT EXISTS headings jsonb;

-- Helpful indexes for faster filtering/search
CREATE INDEX IF NOT EXISTS idx_company_documents_created_at ON public.company_documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_documents_keywords ON public.company_documents USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_company_documents_headings ON public.company_documents USING GIN (headings);

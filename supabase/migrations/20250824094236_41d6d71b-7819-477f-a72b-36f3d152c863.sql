-- Harden RLS on company_documents to prevent global read access
-- 1) Ensure RLS is enabled
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- 2) Remove overly-permissive policy that allowed all authenticated users to read all docs
DROP POLICY IF EXISTS "Users can read all documents" ON public.company_documents;

-- 3) Add least-privilege read policy: users can only read documents they uploaded
CREATE POLICY "Users can read their own documents"
ON public.company_documents
FOR SELECT
USING (auth.uid() = uploaded_by);

-- Note: Existing admin policy ("Admins can manage all documents") remains and continues to allow full access for admins.

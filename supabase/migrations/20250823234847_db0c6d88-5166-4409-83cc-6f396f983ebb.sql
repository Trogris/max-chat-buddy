-- Create table for storing company documents
CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- Only admins can manage documents
CREATE POLICY "Admins can manage all documents" 
ON public.company_documents 
FOR ALL 
USING (EXISTS (
  SELECT 1 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'::text
));

-- Users can read all documents (for AI responses)
CREATE POLICY "Users can read all documents" 
ON public.company_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_documents_updated_at
BEFORE UPDATE ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
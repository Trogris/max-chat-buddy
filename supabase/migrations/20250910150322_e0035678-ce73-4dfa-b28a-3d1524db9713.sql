-- Create storage bucket for Max avatar
INSERT INTO storage.buckets (id, name, public) VALUES ('max-avatar', 'max-avatar', true);

-- Create policies for Max avatar bucket
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'max-avatar');

CREATE POLICY "Admins can upload Max avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'max-avatar' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update Max avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'max-avatar' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete Max avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'max-avatar' AND is_admin(auth.uid()));

-- Add avatar_url field to ai_settings table
ALTER TABLE public.ai_settings ADD COLUMN avatar_url text;
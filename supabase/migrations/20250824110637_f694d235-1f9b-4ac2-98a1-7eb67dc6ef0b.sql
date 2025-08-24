-- Allow admins to update any profile area/fields
CREATE POLICY IF NOT EXISTS "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));
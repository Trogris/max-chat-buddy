-- Drop existing policy to recreate it
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policy allowing users to update their own profiles and admins to update any profile
CREATE POLICY "Users can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  is_admin(auth.uid())
)
WITH CHECK (
  ((auth.uid() = user_id) AND (is_admin(auth.uid()) OR (role = 'user'::text))) OR
  is_admin(auth.uid())
);
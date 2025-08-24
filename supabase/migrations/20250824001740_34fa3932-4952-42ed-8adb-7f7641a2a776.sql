-- Restrict role escalation by non-admins
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND (public.is_admin(auth.uid()) OR role = 'user'));

-- Promote the requesting user to admin (from auth logs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'aa9fdef8-e793-4e6c-ac8b-65eeb90f5fce') THEN
    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE user_id = 'aa9fdef8-e793-4e6c-ac8b-65eeb90f5fce';
  ELSE
    INSERT INTO public.profiles (user_id, name, role)
    VALUES ('aa9fdef8-e793-4e6c-ac8b-65eeb90f5fce', 'Admin', 'admin');
  END IF;
END $$;
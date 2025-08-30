-- Promote specific user to admin by email
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find the user id by email in auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'cwa.andrade@gmail.com' 
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users', 'cwa.andrade@gmail.com';
  END IF;

  -- Try to update existing profile
  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE user_id = v_user_id;

  -- If no profile was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, name, role)
    VALUES (v_user_id, 'cwa.andrade@gmail.com', 'admin');
  END IF;
END $$;
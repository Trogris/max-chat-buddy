-- Global AI model setting used by all users (retry without IF NOT EXISTS on policies)
-- 1) Create table for global model config
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_model text NOT NULL DEFAULT 'gpt-4.1-2025-04-14',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- 2) RLS Policies
-- Any authenticated user can read the current global model
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_settings' AND policyname = 'Anyone authenticated can view AI settings'
  ) THEN
    CREATE POLICY "Anyone authenticated can view AI settings"
    ON public.ai_settings
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Only admins can update the global model
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_settings' AND policyname = 'Admins can update AI settings'
  ) THEN
    CREATE POLICY "Admins can update AI settings"
    ON public.ai_settings
    FOR UPDATE
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- Only admins can insert (for initial seeding or re-creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_settings' AND policyname = 'Admins can insert AI settings'
  ) THEN
    CREATE POLICY "Admins can insert AI settings"
    ON public.ai_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- 3) Keep timestamps fresh on updates
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Enforce single-row table via unique partial index on a constant expression
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'one_row_ai_settings'
  ) THEN
    CREATE UNIQUE INDEX one_row_ai_settings ON public.ai_settings ((true));
  END IF;
END $$;

-- 5) Seed one row if empty
INSERT INTO public.ai_settings (current_model)
SELECT 'gpt-4.1-2025-04-14'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings);

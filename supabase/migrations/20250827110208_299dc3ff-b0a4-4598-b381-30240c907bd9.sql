-- Move vector extension to the extensions schema to satisfy security linter
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$ BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'vector';
  IF FOUND THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;
-- SHAKH SUPER v10: compatibility for live posts tables using user_id.
-- Run after v9_live_compatibility.sql. Existing rows are preserved.

DO $$
BEGIN
  IF to_regclass('public.posts') IS NULL THEN
    RAISE EXCEPTION 'public.posts is missing; inspect the live schema before continuing';
  END IF;
END $$;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS owner_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.posts SET owner_id = user_id WHERE owner_id IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_owner_id_fkey'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS posts_owner_id_idx ON public.posts(owner_id);

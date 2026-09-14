-- SHAKH Production Upgrade — 2026-09-14
-- Live posts, moderation, RBAC hardening, Realtime, multilingual metadata.
-- Run after the existing SHAKH base migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Keep the role enum compatible with the frontend RBAC names.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'FASHION_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'FOOD_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'MARKET_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'TECH_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'CARS_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'UMRAH_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'BEAUTY_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.status = 'approved'
      AND ur.role::text = 'SUPER_ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid NULL REFERENCES public.businesses(id) ON DELETE SET NULL,
  title text,
  content text NOT NULL DEFAULT '',
  content_ku text,
  content_ar text,
  content_en text,
  content_tr text,
  content_fa text,
  images text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'all',
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  shares_count integer NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  views_count integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  location_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  deal jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT likes_one_target CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1
));

CREATE UNIQUE INDEX IF NOT EXISTS likes_user_post_unique ON public.likes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_comment_unique ON public.likes(user_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_status_created_idx ON public.posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_category_created_idx ON public.posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_idx ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments(post_id, created_at DESC);

-- Database-enforced publication state: clients cannot self-approve or self-suspend.
CREATE OR REPLACE FUNCTION public.enforce_post_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := CASE WHEN NEW.category = 'cars' THEN 'pending' ELSE 'approved' END;
    ELSE
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS posts_enforce_moderation ON public.posts;
CREATE TRIGGER posts_enforce_moderation
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_post_moderation();

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS comments_set_updated_at ON public.comments;
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep counters authoritative in the database.
CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  IF pid IS NOT NULL THEN
    UPDATE public.posts SET likes_count = (SELECT count(*) FROM public.likes WHERE post_id = pid), updated_at=now() WHERE id=pid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS likes_post_counter ON public.likes;
CREATE TRIGGER likes_post_counter AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

CREATE OR REPLACE FUNCTION public.sync_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts SET comments_count = (SELECT count(*) FROM public.comments WHERE post_id = pid), updated_at=now() WHERE id=pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS comments_post_counter ON public.comments;
CREATE TRIGGER comments_post_counter AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.sync_comment_count();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_public_read_approved" ON public.posts;
CREATE POLICY "posts_public_read_approved" ON public.posts FOR SELECT
USING (status = 'approved' OR auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "posts_insert_owner" ON public.posts;
CREATE POLICY "posts_insert_owner" ON public.posts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_super_admin(auth.uid())
    OR (
      category IN ('food','market','fashion','tech','cars','beauty','offers')
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.status = 'approved'
          AND (
            (ur.role::text IN ('FOOD_MERCHANT','RESTAURANT') AND category IN ('food','offers'))
            OR (ur.role::text IN ('MARKET_MERCHANT','SUPERMARKET') AND category IN ('market','offers'))
            OR (ur.role::text IN ('FASHION_MERCHANT','FASHION') AND category IN ('fashion','offers'))
            OR (ur.role::text IN ('TECH_MERCHANT','TECH') AND category IN ('tech','offers'))
            OR (ur.role::text IN ('CARS_MERCHANT','CAR_SELLER') AND category = 'cars')
            OR (ur.role::text IN ('BEAUTY_MERCHANT','BEAUTY') AND category IN ('beauty','offers'))
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "posts_owner_update" ON public.posts;
CREATE POLICY "posts_owner_update" ON public.posts FOR UPDATE
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "posts_owner_delete" ON public.posts;
CREATE POLICY "posts_owner_delete" ON public.posts FOR DELETE
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "comments_public_read" ON public.comments;
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id AND (p.status='approved' OR p.user_id=auth.uid() OR public.is_super_admin(auth.uid()))));

DROP POLICY IF EXISTS "comments_authenticated_insert" ON public.comments;
CREATE POLICY "comments_authenticated_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid()=user_id);

DROP POLICY IF EXISTS "comments_owner_delete" ON public.comments;
CREATE POLICY "comments_owner_delete" ON public.comments FOR DELETE USING (auth.uid()=user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "likes_owner_manage" ON public.likes;
CREATE POLICY "likes_owner_manage" ON public.likes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Ensure realtime publication is configured without failing if an object is already present.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;

-- Existing posts from older versions may be missing the new columns.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_tr text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_fa text;

-- IMPORTANT: no demo/seed data is inserted by this migration.

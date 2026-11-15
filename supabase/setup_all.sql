-- ============================================================================
-- Ruang Karya — Combined Idempotent Supabase Setup Script
-- Jalankan seluruh file ini sekali di Supabase Dashboard -> SQL Editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. Admin Users Allowlist
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Novels / Works (Novel, Cerpen, Notes)
CREATE TABLE IF NOT EXISTS public.novels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  synopsis text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  cover_image_url text,
  work_type text NOT NULL DEFAULT 'novel' CHECK (work_type IN ('novel', 'cerpen', 'notes')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  default_bgm text NOT NULL DEFAULT 'default',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.novels
  ADD COLUMN IF NOT EXISTS work_type text NOT NULL DEFAULT 'novel'
  CHECK (work_type IN ('novel', 'cerpen', 'notes'));

CREATE INDEX IF NOT EXISTS idx_novels_status ON public.novels(status);
CREATE INDEX IF NOT EXISTS idx_novels_work_type_status ON public.novels(work_type, status);

DROP TRIGGER IF EXISTS trg_novels_updated_at ON public.novels;
CREATE TRIGGER trg_novels_updated_at
  BEFORE UPDATE ON public.novels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Chapters (Admin workspace — drafts + snapshot history metadata)
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  legacy_id text UNIQUE,
  legacy_index integer,
  sort_order integer NOT NULL DEFAULT 0,

  num text NOT NULL,
  title text NOT NULL,
  setting text NOT NULL DEFAULT '',
  feeling text,
  is_prologue boolean NOT NULL DEFAULT false,
  is_ending boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  draft_doc jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  draft_html text NOT NULL DEFAULT '',
  draft_bgm text NOT NULL DEFAULT 'default',
  draft_bgm_url text,
  draft_bgm_volume numeric(3,2) NOT NULL DEFAULT 0.42 CHECK (draft_bgm_volume >= 0 AND draft_bgm_volume <= 1),
  draft_bgm_loop boolean NOT NULL DEFAULT true,
  draft_effect text NOT NULL DEFAULT 'none',
  draft_vfx_trigger text NOT NULL DEFAULT 'scroll_40' CHECK (draft_vfx_trigger IN ('scroll_40', 'immediate', 'none')),
  draft_vfx_duration_ms integer NOT NULL DEFAULT 25000 CHECK (draft_vfx_duration_ms >= 1000 AND draft_vfx_duration_ms <= 120000),
  draft_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_version integer NOT NULL DEFAULT 1,

  published_doc jsonb,
  published_html text,
  published_num text,
  published_title text,
  published_setting text,
  published_feeling text,
  published_is_prologue boolean,
  published_is_ending boolean,
  published_bgm text,
  published_bgm_url text,
  published_bgm_volume numeric(3,2),
  published_bgm_loop boolean,
  published_effect text,
  published_vfx_trigger text,
  published_vfx_duration_ms integer,
  published_metadata jsonb,
  published_at timestamptz,
  published_version integer NOT NULL DEFAULT 0,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS draft_bgm_url text,
  ADD COLUMN IF NOT EXISTS published_bgm_url text;

CREATE INDEX IF NOT EXISTS idx_chapters_novel_sort ON public.chapters(novel_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_chapters_legacy_id ON public.chapters(legacy_id) WHERE legacy_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_chapters_updated_at ON public.chapters;
CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Chapter Publications (Public-safe snapshot table — zero draft columns)
CREATE TABLE IF NOT EXISTS public.chapter_publications (
  chapter_id uuid PRIMARY KEY REFERENCES public.chapters(id) ON DELETE CASCADE,
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  legacy_id text UNIQUE,
  legacy_index integer,
  sort_order integer NOT NULL DEFAULT 0,
  num text NOT NULL,
  title text NOT NULL,
  setting text NOT NULL DEFAULT '',
  feeling text,
  is_prologue boolean NOT NULL DEFAULT false,
  is_ending boolean NOT NULL DEFAULT false,
  content_html text NOT NULL DEFAULT '',
  content_doc jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  bgm text NOT NULL DEFAULT 'default',
  bgm_url text,
  bgm_volume numeric(3,2) NOT NULL DEFAULT 0.42,
  bgm_loop boolean NOT NULL DEFAULT true,
  effect text NOT NULL DEFAULT 'none',
  vfx_trigger text NOT NULL DEFAULT 'scroll_40',
  vfx_duration_ms integer NOT NULL DEFAULT 25000,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_version integer NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true
);

ALTER TABLE public.chapter_publications
  ADD COLUMN IF NOT EXISTS bgm_url text;

CREATE INDEX IF NOT EXISTS idx_chapter_publications_novel_sort
  ON public.chapter_publications(novel_id, sort_order)
  WHERE is_published = true;

-- 5. Chapter Revisions (Immutable revision history)
CREATE TABLE IF NOT EXISTS public.chapter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  revision_kind text NOT NULL DEFAULT 'autosave' CHECK (revision_kind IN ('autosave', 'manual', 'publish', 'restore', 'import')),
  num text NOT NULL,
  title text NOT NULL,
  setting text NOT NULL DEFAULT '',
  feeling text,
  doc_json jsonb NOT NULL,
  html_snapshot text NOT NULL,
  audio_vfx_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_chapter_revision_number UNIQUE (chapter_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_chapter_revisions_chapter_created
  ON public.chapter_revisions(chapter_id, revision_number DESC);

-- 6. Chapter Assets (Images, SFX, Audio overrides, Covers)
CREATE TABLE IF NOT EXISTS public.chapter_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('image', 'audio', 'sfx', 'cover', 'attachment')),
  label text NOT NULL,
  asset_key text,
  url text NOT NULL,
  mime_type text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapter_assets_novel ON public.chapter_assets(novel_id, chapter_id);

-- ============================================================================
-- Row Level Security (RLS) & Admin Authorization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, anon;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_select_self_or_admin" ON public.admin_users;
CREATE POLICY "admin_users_select_self_or_admin"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_active_admin());

DROP POLICY IF EXISTS "admin_users_admin_manage" ON public.admin_users;
CREATE POLICY "admin_users_admin_manage"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "novels_public_read_published" ON public.novels;
CREATE POLICY "novels_public_read_published"
  ON public.novels
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR public.is_active_admin());

DROP POLICY IF EXISTS "novels_admin_insert" ON public.novels;
CREATE POLICY "novels_admin_insert"
  ON public.novels
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "novels_admin_update" ON public.novels;
CREATE POLICY "novels_admin_update"
  ON public.novels
  FOR UPDATE
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "novels_admin_delete" ON public.novels;
CREATE POLICY "novels_admin_delete"
  ON public.novels
  FOR DELETE
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "chapters_admin_all" ON public.chapters;
CREATE POLICY "chapters_admin_all"
  ON public.chapters
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "chapter_publications_public_select" ON public.chapter_publications;
CREATE POLICY "chapter_publications_public_select"
  ON public.chapter_publications
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR public.is_active_admin());

DROP POLICY IF EXISTS "chapter_publications_admin_write" ON public.chapter_publications;
CREATE POLICY "chapter_publications_admin_write"
  ON public.chapter_publications
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "chapter_revisions_admin_all" ON public.chapter_revisions;
CREATE POLICY "chapter_revisions_admin_all"
  ON public.chapter_revisions
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "chapter_assets_public_select" ON public.chapter_assets;
CREATE POLICY "chapter_assets_public_select"
  ON public.chapter_assets
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_active_admin()
    OR EXISTS (
      SELECT 1
      FROM public.novels n
      WHERE n.id = chapter_assets.novel_id
        AND n.status = 'published'
    )
  );

DROP POLICY IF EXISTS "chapter_assets_admin_write" ON public.chapter_assets;
CREATE POLICY "chapter_assets_admin_write"
  ON public.chapter_assets
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- ============================================================================
-- Publish & Archive RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_chapter(p_chapter_id uuid)
RETURNS public.chapters
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chapter public.chapters;
  v_next_rev integer;
  v_pub_version integer;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Forbidden: Active admin privileges required'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE id = p_chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chapter not found: %', p_chapter_id
      USING ERRCODE = 'P0002';
  END IF;

  IF length(trim(coalesce(v_chapter.title, ''))) = 0 THEN
    RAISE EXCEPTION 'Chapter title cannot be empty before publishing'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(v_chapter.draft_html, ''))) = 0 THEN
    RAISE EXCEPTION 'Chapter content cannot be empty before publishing'
      USING ERRCODE = '22023';
  END IF;

  v_pub_version := v_chapter.published_version + 1;

  UPDATE public.chapters
  SET
    status = 'published',
    published_doc = v_chapter.draft_doc,
    published_html = v_chapter.draft_html,
    published_num = v_chapter.num,
    published_title = v_chapter.title,
    published_setting = v_chapter.setting,
    published_feeling = v_chapter.feeling,
    published_is_prologue = v_chapter.is_prologue,
    published_is_ending = v_chapter.is_ending,
    published_bgm = v_chapter.draft_bgm,
    published_bgm_url = v_chapter.draft_bgm_url,
    published_bgm_volume = v_chapter.draft_bgm_volume,
    published_bgm_loop = v_chapter.draft_bgm_loop,
    published_effect = v_chapter.draft_effect,
    published_vfx_trigger = v_chapter.draft_vfx_trigger,
    published_vfx_duration_ms = v_chapter.draft_vfx_duration_ms,
    published_metadata = v_chapter.draft_metadata,
    published_at = now(),
    published_version = v_pub_version,
    updated_by = auth.uid()
  WHERE id = p_chapter_id
  RETURNING * INTO v_chapter;

  INSERT INTO public.chapter_publications (
    chapter_id, novel_id, legacy_id, legacy_index, sort_order,
    num, title, setting, feeling, is_prologue, is_ending,
    content_html, content_doc, bgm, bgm_url, bgm_volume, bgm_loop,
    effect, vfx_trigger, vfx_duration_ms, metadata,
    published_version, published_at, is_published
  )
  VALUES (
    v_chapter.id, v_chapter.novel_id, v_chapter.legacy_id, v_chapter.legacy_index, v_chapter.sort_order,
    v_chapter.num, v_chapter.title, v_chapter.setting, v_chapter.feeling, v_chapter.is_prologue, v_chapter.is_ending,
    v_chapter.draft_html, v_chapter.draft_doc, v_chapter.draft_bgm, v_chapter.draft_bgm_url, v_chapter.draft_bgm_volume, v_chapter.draft_bgm_loop,
    v_chapter.draft_effect, v_chapter.draft_vfx_trigger, v_chapter.draft_vfx_duration_ms, v_chapter.draft_metadata,
    v_pub_version, v_chapter.published_at, true
  )
  ON CONFLICT (chapter_id) DO UPDATE SET
    novel_id = EXCLUDED.novel_id,
    legacy_id = EXCLUDED.legacy_id,
    legacy_index = EXCLUDED.legacy_index,
    sort_order = EXCLUDED.sort_order,
    num = EXCLUDED.num,
    title = EXCLUDED.title,
    setting = EXCLUDED.setting,
    feeling = EXCLUDED.feeling,
    is_prologue = EXCLUDED.is_prologue,
    is_ending = EXCLUDED.is_ending,
    content_html = EXCLUDED.content_html,
    content_doc = EXCLUDED.content_doc,
    bgm = EXCLUDED.bgm,
    bgm_url = EXCLUDED.bgm_url,
    bgm_volume = EXCLUDED.bgm_volume,
    bgm_loop = EXCLUDED.bgm_loop,
    effect = EXCLUDED.effect,
    vfx_trigger = EXCLUDED.vfx_trigger,
    vfx_duration_ms = EXCLUDED.vfx_duration_ms,
    metadata = EXCLUDED.metadata,
    published_version = EXCLUDED.published_version,
    published_at = EXCLUDED.published_at,
    is_published = true;

  UPDATE public.novels
  SET updated_at = now()
  WHERE id = v_chapter.novel_id;

  SELECT COALESCE(MAX(revision_number), 0) + 1
  INTO v_next_rev
  FROM public.chapter_revisions
  WHERE chapter_id = p_chapter_id;

  INSERT INTO public.chapter_revisions (
    chapter_id, revision_number, revision_kind,
    num, title, setting, feeling,
    doc_json, html_snapshot, audio_vfx_snapshot, created_by
  )
  VALUES (
    v_chapter.id, v_next_rev, 'publish',
    v_chapter.num, v_chapter.title, v_chapter.setting, v_chapter.feeling,
    v_chapter.draft_doc, v_chapter.draft_html,
    jsonb_build_object(
      'bgm', v_chapter.draft_bgm,
      'bgm_url', v_chapter.draft_bgm_url,
      'bgm_volume', v_chapter.draft_bgm_volume,
      'bgm_loop', v_chapter.draft_bgm_loop,
      'effect', v_chapter.draft_effect,
      'vfx_trigger', v_chapter.draft_vfx_trigger,
      'vfx_duration_ms', v_chapter.draft_vfx_duration_ms
    ),
    auth.uid()
  );

  RETURN v_chapter;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_chapter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_chapter(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_publication_on_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived' OR NEW.status = 'draft' THEN
    UPDATE public.chapter_publications
    SET is_published = false
    WHERE chapter_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chapters_sync_archive ON public.chapters;
CREATE TRIGGER trg_chapters_sync_archive
  AFTER UPDATE OF status ON public.chapters
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_publication_on_archive();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chapters;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Supabase Storage Bucket (`novel-assets`) & RLS Policies
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('novel-assets', 'novel-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "novel_assets_public_select" ON storage.objects;
CREATE POLICY "novel_assets_public_select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'novel-assets');

DROP POLICY IF EXISTS "novel_assets_admin_insert" ON storage.objects;
CREATE POLICY "novel_assets_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'novel-assets' AND public.is_active_admin());

DROP POLICY IF EXISTS "novel_assets_admin_update" ON storage.objects;
CREATE POLICY "novel_assets_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'novel-assets' AND public.is_active_admin())
  WITH CHECK (bucket_id = 'novel-assets' AND public.is_active_admin());

DROP POLICY IF EXISTS "novel_assets_admin_delete" ON storage.objects;
CREATE POLICY "novel_assets_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'novel-assets' AND public.is_active_admin());

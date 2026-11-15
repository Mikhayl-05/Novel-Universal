-- ============================================================================
-- Migration 000002: Row Level Security (RLS), Admin Authorization & Publish RPC
-- ============================================================================

-- Helper: checks whether the current JWT belongs to an active allowlisted admin.
-- Uses SECURITY DEFINER so RLS on `admin_users` does not cause recursion.
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

-- Enable RLS across all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. admin_users policies
-- ============================================================================
-- Users can check their own admin row; only active admins can view/manage allowlist
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

-- ============================================================================
-- 2. novels policies
-- ============================================================================
-- Public/anon can read published novels only; active admins can read/write all
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

-- ============================================================================
-- 3. chapters policies (ADMIN ONLY — strict draft isolation!)
-- ============================================================================
-- Anonymous users and non-admin authenticated users CANNOT read any row in `chapters`.
DROP POLICY IF EXISTS "chapters_admin_all" ON public.chapters;
CREATE POLICY "chapters_admin_all"
  ON public.chapters
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- ============================================================================
-- 4. chapter_publications policies (PUBLIC PUBLISHED SNAPSHOTS ONLY)
-- ============================================================================
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

-- ============================================================================
-- 5. chapter_revisions policies (ADMIN ONLY)
-- ============================================================================
DROP POLICY IF EXISTS "chapter_revisions_admin_all" ON public.chapter_revisions;
CREATE POLICY "chapter_revisions_admin_all"
  ON public.chapter_revisions
  FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- ============================================================================
-- 6. chapter_assets policies
-- ============================================================================
-- Public can read non-private image/audio assets attached to published novels;
-- Only active admins can insert/update/delete assets.
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
-- 7. Publish & Unpublish / Archive RPCs
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
    content_html, content_doc, bgm, bgm_volume, bgm_loop,
    effect, vfx_trigger, vfx_duration_ms, metadata,
    published_version, published_at, is_published
  )
  VALUES (
    v_chapter.id, v_chapter.novel_id, v_chapter.legacy_id, v_chapter.legacy_index, v_chapter.sort_order,
    v_chapter.num, v_chapter.title, v_chapter.setting, v_chapter.feeling, v_chapter.is_prologue, v_chapter.is_ending,
    v_chapter.draft_html, v_chapter.draft_doc, v_chapter.draft_bgm, v_chapter.draft_bgm_volume, v_chapter.draft_bgm_loop,
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
    bgm_volume = EXCLUDED.bgm_volume,
    bgm_loop = EXCLUDED.bgm_loop,
    effect = EXCLUDED.effect,
    vfx_trigger = EXCLUDED.vfx_trigger,
    vfx_duration_ms = EXCLUDED.vfx_duration_ms,
    metadata = EXCLUDED.metadata,
    published_version = EXCLUDED.published_version,
    published_at = EXCLUDED.published_at,
    is_published = true;

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

-- Unpublish / Archive helper keeps chapter_publications synchronized
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

-- Enable Supabase Realtime on chapters for multi-tab conflict detection
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chapters;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

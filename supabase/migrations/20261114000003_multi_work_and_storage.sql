-- ============================================================================
-- Migration 000003: Multi-Work Types (Novel, Cerpen, Notes), Custom BGM URL,
--                   & Supabase Storage Bucket (`novel-assets`)
-- ============================================================================

-- 1. Add `work_type` to `public.novels`
ALTER TABLE public.novels
  ADD COLUMN IF NOT EXISTS work_type text NOT NULL DEFAULT 'novel'
  CHECK (work_type IN ('novel', 'cerpen', 'notes'));

CREATE INDEX IF NOT EXISTS idx_novels_work_type_status
  ON public.novels(work_type, status);

-- 2. Add custom uploaded BGM URL columns to `chapters` & `chapter_publications`
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS draft_bgm_url text,
  ADD COLUMN IF NOT EXISTS published_bgm_url text;

ALTER TABLE public.chapter_publications
  ADD COLUMN IF NOT EXISTS bgm_url text;

-- 3. Update `publish_chapter` RPC to include `draft_bgm_url` -> `published_bgm_url` & `bgm_url`
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

-- 4. Supabase Storage Bucket (`novel-assets`) & RLS Policies
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

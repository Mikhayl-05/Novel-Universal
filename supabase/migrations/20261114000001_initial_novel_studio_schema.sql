-- ============================================================================
-- Migration 000001: Ruang Karya — Studio Initial Schema
-- ============================================================================
-- Architecture:
--   1. admin_users          : Allowlisted administrator accounts linked to auth.users
--   2. novels               : Novel metadata & configuration
--   3. chapters             : Admin-only workspace table (draft_* & published_* snapshots)
--   4. chapter_publications : Public read-only table synced exclusively on Publish
--   5. chapter_revisions    : Immutable revision snapshots for undo/restore history
--   6. chapter_assets       : Image / SFX / audio / cover asset registry per novel/chapter
--
-- Security Design:
--   Anonymous and non-admin users CANNOT query `chapters`, `chapter_revisions`,
--   `chapter_assets`, or `admin_users` at all. Public readers read exclusively
--   from `novels` (published) and `chapter_publications` (published snapshots),
--   guaranteeing unpublished drafts or post-publish draft edits never leak via API.
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

-- 2. Novels
CREATE TABLE IF NOT EXISTS public.novels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  synopsis text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  default_bgm text NOT NULL DEFAULT 'default',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_novels_status ON public.novels(status);

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

  -- Draft metadata & status
  num text NOT NULL,
  title text NOT NULL,
  setting text NOT NULL DEFAULT '',
  feeling text,
  is_prologue boolean NOT NULL DEFAULT false,
  is_ending boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Draft rich-text content (Tiptap/ProseMirror JSONB + rendered HTML)
  draft_doc jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  draft_html text NOT NULL DEFAULT '',
  draft_bgm text NOT NULL DEFAULT 'default',
  draft_bgm_volume numeric(3,2) NOT NULL DEFAULT 0.42 CHECK (draft_bgm_volume >= 0 AND draft_bgm_volume <= 1),
  draft_bgm_loop boolean NOT NULL DEFAULT true,
  draft_effect text NOT NULL DEFAULT 'none',
  draft_vfx_trigger text NOT NULL DEFAULT 'scroll_40' CHECK (draft_vfx_trigger IN ('scroll_40', 'immediate', 'none')),
  draft_vfx_duration_ms integer NOT NULL DEFAULT 25000 CHECK (draft_vfx_duration_ms >= 1000 AND draft_vfx_duration_ms <= 120000),
  draft_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_version integer NOT NULL DEFAULT 1,

  -- Last published snapshot reference (admin tracking)
  published_doc jsonb,
  published_html text,
  published_num text,
  published_title text,
  published_setting text,
  published_feeling text,
  published_is_prologue boolean,
  published_is_ending boolean,
  published_bgm text,
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

CREATE INDEX IF NOT EXISTS idx_chapters_novel_sort ON public.chapters(novel_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_chapters_legacy_id ON public.chapters(legacy_id) WHERE legacy_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_chapters_updated_at ON public.chapters;
CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Chapter Publications (Public-safe snapshot table — zero draft columns!)
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

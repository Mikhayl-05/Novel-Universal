import { useCallback, useEffect, useState } from 'react';
import { audioManager } from '../services/audioManager';
import {
  fetchPublishedWorkAndChaptersBySlug,
  fetchPublishedWorksForBeranda,
  type PublishedReaderChapter,
} from '../studio/services/studioRepository';
import { isSupabaseConfigured } from '../studio/services/supabaseClient';
import type { PublishedWork } from '../types/novel';

export function usePublishedWorksFeed() {
  const [works, setWorks] = useState<PublishedWork[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) {
      setWorks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchPublishedWorksForBeranda()
      .then((list) => {
        setWorks(list);
        // Warm first work's BGM preset/URL lightly in background if available
        if (list[0]) {
          audioManager.preloadChapterBgm({
            bgm: list[0].firstChapterBgm ?? list[0].defaultBgm,
            bgmUrl: list[0].firstChapterBgmUrl,
          });
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar karya dari Supabase.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    works,
    loading,
    error,
    isSupabaseConfigured,
    reload,
  };
}

export function usePublishedWorkReader(slug?: string) {
  const [work, setWork] = useState<PublishedWork | null>(null);
  const [chapters, setChapters] = useState<PublishedReaderChapter[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(slug && isSupabaseConfigured));
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!slug || !isSupabaseConfigured) {
      setWork(null);
      setChapters([]);
      setLoading(false);
      setNotFound(!slug);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    void fetchPublishedWorkAndChaptersBySlug(slug)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setWork(null);
          setChapters([]);
          setNotFound(true);
          return;
        }
        setWork(payload.work);
        setChapters(payload.chapters);
        if (payload.chapters[0]) {
          audioManager.preloadChapterBgm(payload.chapters[0]);
        }
        if (payload.chapters[1]) {
          audioManager.preloadChapterBgm(payload.chapters[1]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWork(null);
          setChapters([]);
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    work,
    chapters,
    loading,
    notFound,
    isSupabaseConfigured,
  };
}

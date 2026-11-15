import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadWorkReaderState, saveFavorites } from '../services/storageService';
import type { Chapter, ChapterId } from '../types/novel';
import { vibrate } from '../utils/haptics';

interface UseFavoritesParams {
  workSlug: string;
  chapters: Chapter[];
  showToast: (message: string) => void;
}

export function useFavorites({
  workSlug,
  chapters,
  showToast,
}: UseFavoritesParams) {
  const [favorites, setFavorites] = useState<ChapterId[]>(() =>
    loadWorkReaderState(workSlug).favorites,
  );

  useEffect(() => {
    setFavorites(loadWorkReaderState(workSlug).favorites);
  }, [workSlug]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (chapterId: ChapterId) => favoriteSet.has(chapterId),
    [favoriteSet],
  );

  const toggleFavorite = useCallback(
    (chapterId: ChapterId) => {
      const ch = chapters.find((item) => item.id === chapterId);
      setFavorites((prev) => {
        const exists = prev.includes(chapterId);
        const next = exists
          ? prev.filter((id) => id !== chapterId)
          : [...prev, chapterId];
        saveFavorites(workSlug, next);
        if (ch) {
          showToast(
            exists
              ? `💔 ${ch.num} dihapus dari Favorit`
              : `❤️ ${ch.num} disimpan ke Favorit`,
          );
        }
        return next;
      });
      vibrate(15);
    },
    [chapters, showToast, workSlug],
  );

  return {
    favorites,
    favoriteSet,
    isFavorite,
    toggleFavorite,
  };
}

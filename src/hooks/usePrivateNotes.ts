import { useCallback, useEffect, useState } from 'react';
import { loadWorkReaderState, saveNotesStore } from '../services/storageService';
import type { ChapterId, NotesStore } from '../types/novel';

export function usePrivateNotes(workSlug: string) {
  const [notes, setNotes] = useState<NotesStore>(() =>
    loadWorkReaderState(workSlug).notes,
  );

  useEffect(() => {
    setNotes(loadWorkReaderState(workSlug).notes);
  }, [workSlug]);

  const hasNote = useCallback(
    (chapterId: ChapterId) => {
      const entry = notes[chapterId];
      return !!(entry && entry.note && entry.note.trim() !== '');
    },
    [notes],
  );

  const getNote = useCallback(
    (chapterId: ChapterId) => notes[chapterId] ?? null,
    [notes],
  );

  const saveNote = useCallback(
    (chapterId: ChapterId, text: string) => {
      const updatedAt = Date.now();
      setNotes((prev) => {
        const next: NotesStore = { ...prev };
        if (text.trim() === '') {
          delete next[chapterId];
        } else {
          next[chapterId] = {
            chapterId,
            note: text,
            updatedAt,
          };
        }
        saveNotesStore(workSlug, next);
        return next;
      });
      return text.trim() === '' ? null : updatedAt;
    },
    [workSlug],
  );

  return {
    notes,
    hasNote,
    getNote,
    saveNote,
  };
}

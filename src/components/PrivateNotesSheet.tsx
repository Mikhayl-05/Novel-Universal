import { useEffect, useRef, useState } from 'react';
import type { Chapter, ChapterId, NoteEntry } from '../types/novel';
import { vibrate } from '../utils/haptics';

interface PrivateNotesSheetProps {
  open: boolean;
  chapter: Chapter;
  existingNote: NoteEntry | null;
  onSaveNote: (chapterId: ChapterId, text: string) => number | null;
  onClose: () => void;
}

function formatLastEdited(timestamp: number | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const formatted = d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Diedit ${formatted}`;
}

export function PrivateNotesSheet({
  open,
  chapter,
  existingNote,
  onSaveNote,
  onClose,
}: PrivateNotesSheetProps) {
  const [draft, setDraft] = useState('');
  const [lastEdited, setLastEdited] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const existingNoteRef = useRef(existingNote);
  existingNoteRef.current = existingNote;
  const onSaveNoteRef = useRef(onSaveNote);
  onSaveNoteRef.current = onSaveNote;
  const hasPendingSaveRef = useRef(false);
  const prevOpenRef = useRef(false);
  const prevChapterIdRef = useRef<ChapterId>(chapter.id);

  // Sync draft when sheet opens or chapter changes; flush pending edits on close/switch
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    const prevChapterId = prevChapterIdRef.current;

    if (wasOpen && (!open || prevChapterId !== chapter.id) && hasPendingSaveRef.current) {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      onSaveNoteRef.current(prevChapterId, draftRef.current);
      hasPendingSaveRef.current = false;
    }

    prevOpenRef.current = open;
    prevChapterIdRef.current = chapter.id;

    if (open) {
      const currentNote = existingNoteRef.current;
      setDraft(currentNote ? currentNote.note : '');
      setLastEdited(currentNote ? currentNote.updatedAt : null);
      hasPendingSaveRef.current = false;
      if (!wasOpen) {
        vibrate(10);
      }
      const focusTimer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
      return () => clearTimeout(focusTimer);
    }
    return undefined;
  }, [open, chapter.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setDraft(nextText);
    hasPendingSaveRef.current = true;
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updated = onSaveNoteRef.current(chapter.id, nextText);
      setLastEdited(updated);
      hasPendingSaveRef.current = false;
      saveTimerRef.current = null;
    }, 500);
  };

  const handleClose = () => {
    if (!open) return;
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const updated = onSaveNoteRef.current(chapter.id, draftRef.current);
    setLastEdited(updated);
    hasPendingSaveRef.current = false;
    onClose();
  };

  return (
    <>
      <div
        className={`notes-sheet-overlay${open ? ' visible' : ''}`}
        id="notes-sheet-overlay"
        onClick={handleClose}
      />
      <div
        className={`notes-sheet${open ? ' visible' : ''}`}
        id="notes-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Catatan Pribadi"
      >
        <div className="notes-sheet-handle" />
        <div className="notes-sheet-header">
          <span className="notes-sheet-title" id="notes-sheet-chapter-title">
            {open ? `Catatan — ${chapter.title}` : 'Catatan Bab'}
          </span>
          <button
            type="button"
            className="notes-sheet-close"
            id="notes-sheet-close"
            aria-label="Tutup Catatan"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>
        <div className="notes-sheet-body">
          <textarea
            ref={textareaRef}
            id="notes-textarea"
            placeholder="Tulis catatan pribadimu tentang bab ini..."
            aria-label="Isi catatan"
            value={draft}
            onChange={handleChange}
          />
          <div className="notes-sheet-footer">
            <span id="notes-char-counter">{draft.length} karakter</span>
            <span id="notes-last-edited">{formatLastEdited(lastEdited)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

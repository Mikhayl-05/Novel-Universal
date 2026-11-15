import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterTransitionPhase } from '../hooks/useChapterNavigation';
import type { Chapter, PublishedWork } from '../types/novel';
import { stripHtmlToText } from '../utils/chapterHtml';
import { findFirstMatchingParagraph } from '../utils/searchEngine';

interface ChapterReaderProps {
  work: PublishedWork;
  chapter: Chapter;
  chapterHtml: string;
  totalChapters: number;
  fontScale: number;
  transitionPhase: ChapterTransitionPhase;
  subtitleTransitioning: boolean;
  focusMode: boolean;
  pendingHighlightQuery: string | null;
  onHighlightConsumed: () => void;
  onBrandClick: () => void;
  onToggleFocusUi: () => void;
}

const WORK_TYPE_LABELS = {
  novel: 'Novel',
  cerpen: 'Cerita Pendek',
  notes: 'Catatan Penulis',
} as const;

export function ChapterReader({
  work,
  chapter,
  chapterHtml,
  totalChapters,
  fontScale,
  transitionPhase,
  subtitleTransitioning,
  focusMode,
  pendingHighlightQuery,
  onHighlightConsumed,
  onBrandClick,
  onToggleFocusUi,
}: ChapterReaderProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHighlightConsumedRef = useRef(onHighlightConsumed);
  onHighlightConsumedRef.current = onHighlightConsumed;

  const isPrologue = !!chapter.isPrologue;
  const metaThemeClass = isPrologue ? 'theme-prologue' : 'theme-main';

  const readingMinutes = useMemo(() => {
    const words = stripHtmlToText(chapter.content).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [chapter.content]);

  const subtitleText =
    work.workType === 'cerpen'
      ? `${WORK_TYPE_LABELS.cerpen} · ${readingMinutes} menit baca${work.authorName ? ` · ${work.authorName}` : ''}`
      : work.workType === 'notes'
        ? `${WORK_TYPE_LABELS.notes} · ${readingMinutes} menit baca${work.authorName ? ` · ${work.authorName}` : ''}`
        : isPrologue
          ? 'Bagian Pembuka / Prolog'
          : work.subtitle || (work.authorName ? `Oleh ${work.authorName}` : 'Kisah Utama');

  const articleTransitionClass =
    transitionPhase === 'fade-out'
      ? ' fade-out'
      : transitionPhase === 'fade-in'
        ? ' fade-in'
        : '';

  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    const proseSize = `${1.05 * (fontScale / 100)}rem`;
    const dialogueSize = `${0.98 * (fontScale / 100)}rem`;
    container.querySelectorAll<HTMLElement>('.prose').forEach((el) => {
      el.style.fontSize = proseSize;
    });
    container.querySelectorAll<HTMLElement>('.dialogue').forEach((el) => {
      el.style.fontSize = dialogueSize;
    });
  }, [chapterHtml, fontScale]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingHighlightQuery || !articleRef.current) return;
    const container = articleRef.current;
    const target = findFirstMatchingParagraph(container, pendingHighlightQuery);
    if (!target) {
      onHighlightConsumedRef.current();
      return;
    }

    const scrollTimer = setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('para-highlight-flash');
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = setTimeout(() => {
        target.classList.remove('para-highlight-flash');
        flashTimerRef.current = null;
      }, 1800);
      onHighlightConsumedRef.current();
    }, 400);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [pendingHighlightQuery, chapterHtml]);

  return (
    <main className={`reader-work-${work.workType}`}>
      <div className={`book-meta ${metaThemeClass}`}>
        <a
          href="#"
          className="book-title"
          onClick={(e) => {
            e.preventDefault();
            onBrandClick();
          }}
          style={{
            textDecoration: 'none',
            display: 'block',
            color: 'inherit',
          }}
        >
          {work.title}
        </a>
        <span className="ornament">✦</span>
        <p
          className={`book-subtitle${
            subtitleTransitioning ? ' transitioning' : ''
          }`}
          id="book-subtitle-text"
        >
          {subtitleText}
        </p>
      </div>

      <article
        ref={articleRef}
        className={`chapter-content${articleTransitionClass}`}
        id="chapter-container"
        onClick={() => {
          if (focusMode) onToggleFocusUi();
        }}
        dangerouslySetInnerHTML={{ __html: chapterHtml }}
      />

      {totalChapters <= 1 && (
        <div className="reader-single-footer">
          <Link to="/" className="reader-return-beranda">
            ← Kembali ke Beranda Ruang Karya
          </Link>
        </div>
      )}
    </main>
  );
}

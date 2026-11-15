import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Chapter,
  ChapterId,
  DrawerTab,
  SearchIndexEntry,
  SearchMatchInfo,
} from '../types/novel';
import {
  buildSearchIndex,
  chapterMatchesSearch,
  getSearchMatchInfo,
} from '../utils/searchEngine';

const MOVE_CANCEL_THRESHOLD = 5;
const LONG_PRESS_DURATION_MS = 800;

interface DrawerChapterItemProps {
  chapter: Chapter;
  drawerOpen: boolean;
  isActive: boolean;
  isFavorite: boolean;
  hasNote: boolean;
  searchInfo: SearchMatchInfo | null;
  activeQuery: string;
  onSelect: (chapterId: ChapterId, matchQuery?: string) => void;
  onToggleFavorite: (chapterId: ChapterId) => void;
}

function DrawerChapterItem({
  chapter,
  drawerOpen,
  isActive,
  isFavorite,
  hasNote,
  searchInfo,
  activeQuery,
  onSelect,
  onToggleFavorite,
}: DrawerChapterItemProps) {
  const [isPressing, setIsPressing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const pressStartXRef = useRef(0);
  const pressStartYRef = useRef(0);

  useEffect(() => {
    if (drawerOpen && isActive && buttonRef.current) {
      buttonRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [drawerOpen, isActive]);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressing(false);
  };

  const onPressStart = (clientX?: number, clientY?: number) => {
    longPressedRef.current = false;
    if (clientX !== undefined && clientY !== undefined) {
      pressStartXRef.current = clientX;
      pressStartYRef.current = clientY;
    }
    setIsPressing(true);
    if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      pressTimerRef.current = null;
      setIsPressing(false);
      onToggleFavorite(chapter.id);
    }, LONG_PRESS_DURATION_MS);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (pressTimerRef.current === null || !e.touches || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - pressStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - pressStartYRef.current);
    if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
      clearPressTimer();
    }
  };

  const handleClick = () => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    if (searchInfo && searchInfo.snippetHtml && activeQuery !== '') {
      onSelect(chapter.id, activeQuery);
    } else {
      onSelect(chapter.id);
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`drawer-item ${isActive ? 'active' : ''} ${
        isFavorite ? 'is-fav' : ''
      } ${isPressing ? 'pressing' : ''}`.trim()}
      onMouseDown={(e) => {
        if (e.button === 0) onPressStart();
      }}
      onMouseUp={clearPressTimer}
      onMouseLeave={clearPressTimer}
      onTouchStart={(e) => {
        const touch = e.touches?.[0];
        onPressStart(touch?.clientX, touch?.clientY);
      }}
      onTouchMove={onTouchMove}
      onTouchEnd={clearPressTimer}
      onTouchCancel={clearPressTimer}
      onClick={handleClick}
    >
      <span className="ch-num-lbl">
        {hasNote ? `📝 ${chapter.num}` : chapter.num}
      </span>
      <span className="ch-title-lbl">{chapter.title}</span>

      {searchInfo && searchInfo.snippetHtml && (
        <span
          className="search-snippet"
          dangerouslySetInnerHTML={{ __html: searchInfo.snippetHtml }}
        />
      )}

      <div className="press-progress" />
      <span className="fav-indicator">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </span>
    </button>
  );
}

interface ChapterDrawerProps {
  open: boolean;
  chapters: Chapter[];
  activeChapterId: ChapterId;
  favoriteSet: ReadonlySet<ChapterId>;
  favoritesCount: number;
  hasNote: (chapterId: ChapterId) => boolean;
  onClose: () => void;
  onSelectChapter: (chapterId: ChapterId, matchQuery?: string) => void;
  onToggleFavorite: (chapterId: ChapterId) => void;
}

export function ChapterDrawer({
  open,
  chapters,
  activeChapterId,
  favoriteSet,
  favoritesCount,
  hasNote,
  onClose,
  onSelectChapter,
  onToggleFavorite,
}: ChapterDrawerProps) {
  const [currentTab, setCurrentTab] = useState<DrawerTab>('all');
  const [inputQuery, setInputQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchIndex = useMemo<Map<ChapterId, SearchIndexEntry>>(
    () => buildSearchIndex(chapters),
    [chapters],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputQuery(val);
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(val);
    }, 280);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    setInputQuery('');
    setDebouncedQuery('');
    searchInputRef.current?.focus();
  };

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearching = normalizedQuery !== '';

  const filteredChapters = useMemo(() => {
    return chapters
      .filter((ch) => {
        if (currentTab === 'favorites' && !favoriteSet.has(ch.id)) {
          return false;
        }
        if (isSearching) {
          return chapterMatchesSearch(ch, searchIndex, normalizedQuery);
        }
        return true;
      })
      .map((ch) => ({
        chapter: ch,
        searchInfo: isSearching
          ? getSearchMatchInfo(ch, searchIndex, normalizedQuery)
          : null,
      }));
  }, [chapters, currentTab, favoriteSet, isSearching, searchIndex, normalizedQuery]);

  return (
    <>
      <div
        className={`drawer-overlay${open ? ' visible' : ''}`}
        id="overlay"
        onClick={onClose}
      />

      <aside className={`chapter-drawer${open ? ' open' : ''}`} id="drawer">
        <div className="drawer-header">
          <span className="drawer-title">Daftar Isi</span>
          <div className="drawer-header-actions">
            <button
              type="button"
              className="drawer-close"
              id="drawer-close"
              aria-label="Tutup Daftar Isi"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="drawer-controls">
          <div className="drawer-search-wrap">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              id="drawer-search-input"
              placeholder="Cari bab atau kata kunci..."
              aria-label="Cari bab"
              value={inputQuery}
              onChange={handleSearchChange}
            />
            <button
              type="button"
              id="drawer-search-clear"
              style={{
                display: inputQuery.trim() !== '' ? 'block' : 'none',
              }}
              title="Bersihkan pencarian"
              onClick={handleClearSearch}
            >
              &times;
            </button>
          </div>

          <div className="drawer-tabs">
            <button
              type="button"
              className={`tab-btn${currentTab === 'all' ? ' active' : ''}`}
              id="tab-all-btn"
              onClick={() => setCurrentTab('all')}
            >
              <span>Semua</span>
            </button>
            <button
              type="button"
              className={`tab-btn${
                currentTab === 'favorites' ? ' active' : ''
              }`}
              id="tab-fav-btn"
              onClick={() => setCurrentTab('favorites')}
            >
              <svg
                className="heart-icon"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ verticalAlign: 'middle' }}
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>Favorit</span>
              <span className="fav-count-badge" id="fav-count">
                {favoritesCount}
              </span>
            </button>
          </div>
        </div>

        <div className="drawer-list" id="drawer-list">
          {filteredChapters.length === 0 ? (
            <div className="drawer-empty-state">
              {currentTab === 'favorites' ? (
                <>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Belum ada bagian favorit</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      opacity: 0.7,
                      maxWidth: '220px',
                      lineHeight: 1.4,
                    }}
                  >
                    Tekan &amp; tahan (long press) salah satu bab untuk
                    menandainya sebagai favorit!
                  </span>
                </>
              ) : (
                <>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Bagian tidak ditemukan</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                    Coba cari kata kunci atau judul lain.
                  </span>
                </>
              )}
            </div>
          ) : (
            filteredChapters.map(({ chapter, searchInfo }) => (
              <DrawerChapterItem
                key={chapter.id}
                chapter={chapter}
                drawerOpen={open}
                isActive={chapter.id === activeChapterId}
                isFavorite={favoriteSet.has(chapter.id)}
                hasNote={hasNote(chapter.id)}
                searchInfo={searchInfo}
                activeQuery={normalizedQuery}
                onSelect={(id, matchQuery) => {
                  onSelectChapter(id, matchQuery);
                  onClose();
                }}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}

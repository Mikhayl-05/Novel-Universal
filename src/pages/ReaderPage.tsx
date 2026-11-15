import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AudioFab } from '../components/AudioFab';
import { BottomHint } from '../components/BottomHint';
import { BottomNav } from '../components/BottomNav';
import { ChapterDrawer } from '../components/ChapterDrawer';
import { ChapterReader } from '../components/ChapterReader';
import { EndingCinematic } from '../components/EndingCinematic';
import { Header } from '../components/Header';
import { PrivateNotesSheet } from '../components/PrivateNotesSheet';
import { SettingsPanel } from '../components/SettingsPanel';
import { Toast } from '../components/Toast';
import { UpdateBanner } from '../components/UpdateBanner';
import { VisualEffectsLayer } from '../components/VisualEffectsLayer';
import { useChapterNavigation } from '../hooks/useChapterNavigation';
import { useFavorites } from '../hooks/useFavorites';
import { usePrivateNotes } from '../hooks/usePrivateNotes';
import { usePublishedWorkReader } from '../hooks/usePublishedNovelFeed';
import { usePwa } from '../hooks/usePwa';
import { useReaderSettings } from '../hooks/useReaderSettings';
import { useToastAndHint } from '../hooks/useToastAndHint';
import { audioManager } from '../services/audioManager';
import { loadGlobalReaderPreferences } from '../services/storageService';
import type { ChapterId } from '../types/novel';
import { vibrate } from '../utils/haptics';

export function ReaderPage() {
  const { slug } = useParams<{ slug: string }>();
  const workSlug = slug ?? '';

  const initialPrefsRef = useRef(loadGlobalReaderPreferences());
  const initialPrefs = initialPrefsRef.current;

  const { work, chapters, loading, notFound, isSupabaseConfigured } =
    usePublishedWorkReader(workSlug);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(audioManager.isMuted);
  const [pendingHighlightQuery, setPendingHighlightQuery] = useState<
    string | null
  >(null);

  const startedSlugRef = useRef<string | null>(null);

  const {
    toastMessage,
    toastVisible,
    showToast,
    bottomHintMessage,
    bottomHintVisible,
    showBottomHint,
  } = useToastAndHint();

  const {
    theme,
    fontScale,
    focusMode,
    reduceMotion,
    toggleTheme,
    adjustFontSize,
    toggleFocusMode,
    toggleFocusUiVisibility,
    setReduceMotionEnabled,
  } = useReaderSettings({
    initialTheme: initialPrefs.theme,
    initialFontScale: initialPrefs.fontScale,
    initialFocusMode: initialPrefs.focusMode,
    initialReduceMotion: initialPrefs.reduceMotion,
    showToast,
    showBottomHint,
  });

  const { favorites, favoriteSet, toggleFavorite } = useFavorites({
    workSlug,
    chapters,
    showToast,
  });

  const { hasNote, getNote, saveNote } = usePrivateNotes(workSlug);

  const { canInstall, installApp, hasUpdate, applyUpdate } = usePwa(showToast);

  const handleCloseModals = useCallback(() => {
    setNotesOpen(false);
    setDrawerOpen(false);
    setSettingsOpen(false);
  }, []);

  const storyOpened = Boolean(work && chapters.length > 0 && !loading);

  const {
    activeChapter,
    activeIndex,
    displayedChapter,
    displayedChapterHtml,
    totalChapters,
    transitionPhase,
    subtitleTransitioning,
    endingCinematicOpen,
    completeEndingCinematic,
    goToChapter,
    goToIndex,
    changeChapter,
  } = useChapterNavigation({
    workSlug,
    chapters,
    storyOpened,
    focusMode,
    onCloseModals: handleCloseModals,
  });

  useEffect(() => {
    document.body.classList.remove('studio-mode');
    document.body.classList.add('story-revealed');
    audioManager.init();
    const unsub = audioManager.subscribeMute(setIsAudioMuted);

    const handleGestureUnlock = () => {
      audioManager.unlock();
    };
    window.addEventListener('pointerdown', handleGestureUnlock, { passive: true });
    window.addEventListener('keydown', handleGestureUnlock, { passive: true });

    return () => {
      unsub();
      window.removeEventListener('pointerdown', handleGestureUnlock);
      window.removeEventListener('keydown', handleGestureUnlock);
      audioManager.stop();
    };
  }, []);

  // Update page title cleanly when work loads
  useEffect(() => {
    if (work?.title) {
      document.title = `${work.title} — Ruang Karya`;
    } else {
      document.title = 'Ruang Karya — Reader';
    }
  }, [work?.title]);

  // Trigger zero-delay opening BGM once the work and opening chapter are ready
  useEffect(() => {
    if (!storyOpened || !work || !activeChapter) return;
    if (startedSlugRef.current === work.slug) return;
    startedSlugRef.current = work.slug;

    const openingBgm = activeChapter.bgm || work.defaultBgm || 'default';
    audioManager.play(openingBgm, {
      bgmUrl: activeChapter.bgmUrl,
      volume: activeChapter.bgmVolume,
      loop: activeChapter.bgmLoop,
    });
  }, [storyOpened, work, activeChapter]);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
    vibrate(10);
  }, []);

  const handleSelectChapterFromDrawer = useCallback(
    (chapterId: ChapterId, matchQuery?: string) => {
      if (matchQuery) {
        goToChapter(chapterId, () => {
          setPendingHighlightQuery(matchQuery);
        });
      } else {
        goToChapter(chapterId);
      }
    },
    [goToChapter],
  );

  const handleHighlightConsumed = useCallback(() => {
    setPendingHighlightQuery(null);
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="reader-state-shell">
        <div className="reader-state-card">
          <h2>Database Belum Terkonfigurasi</h2>
          <p>
            Hubungkan Supabase di file <code>.env</code> untuk membuka dan membaca
            karya yang dipublikasikan.
          </p>
          <div className="beranda-state-actions">
            <Link to="/" className="beranda-primary-btn">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="reader-state-shell" aria-busy="true">
        <div className="reader-state-card">
          <span className="beranda-state-ornament">✦</span>
          <h2>Membuka Naskah…</h2>
          <p>Menyiapkan halaman dan latar audio agar nyaman dibaca.</p>
          <Link to="/" className="beranda-secondary-btn">
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  if (notFound || !work) {
    return (
      <div className="reader-state-shell">
        <div className="reader-state-card">
          <span className="beranda-state-ornament">✦</span>
          <h2>Karya Tidak Ditemukan</h2>
          <p>
            Karya yang Anda cari tidak tersedia atau belum dipublikasikan ke
            rak publik.
          </p>
          <div className="beranda-state-actions">
            <Link to="/" className="beranda-primary-btn">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!activeChapter || !displayedChapter) {
    return (
      <div className="reader-state-shell">
        <div className="reader-state-card">
          <span className="beranda-state-ornament">✦</span>
          <h2>{work.title}</h2>
          <p>
            Karya ini belum memiliki bagian atau bab yang dipublikasikan saat ini.
          </p>
          <div className="beranda-state-actions">
            <Link to="/" className="beranda-primary-btn">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showDrawer = work.workType === 'novel' || chapters.length > 1;

  return (
    <>
      <Header
        title={work.title}
        theme={theme}
        showDrawerToggle={showDrawer}
        onBrandClick={() => goToIndex(0)}
        onToggleDrawer={handleToggleDrawer}
        onToggleSettings={() => setSettingsOpen((prev) => !prev)}
        onToggleTheme={toggleTheme}
        onOpenNotes={() => setNotesOpen(true)}
        onToggleFocusMode={toggleFocusMode}
      />

      {showDrawer && (
        <ChapterDrawer
          open={drawerOpen}
          chapters={chapters}
          activeChapterId={activeChapter.id}
          favoriteSet={favoriteSet}
          favoritesCount={favorites.length}
          hasNote={hasNote}
          onClose={handleToggleDrawer}
          onSelectChapter={handleSelectChapterFromDrawer}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <ChapterReader
        work={work}
        chapter={displayedChapter}
        chapterHtml={displayedChapterHtml}
        totalChapters={totalChapters}
        fontScale={fontScale}
        transitionPhase={transitionPhase}
        subtitleTransitioning={subtitleTransitioning}
        focusMode={focusMode}
        pendingHighlightQuery={pendingHighlightQuery}
        onHighlightConsumed={handleHighlightConsumed}
        onBrandClick={() => goToIndex(0)}
        onToggleFocusUi={toggleFocusUiVisibility}
      />

      <SettingsPanel
        visible={settingsOpen}
        fontScale={fontScale}
        reduceMotion={reduceMotion}
        canInstallPwa={canInstall}
        onAdjustFontSize={adjustFontSize}
        onToggleReduceMotion={setReduceMotionEnabled}
        onQuickFocusMode={toggleFocusMode}
        onQuickNotes={() => {
          setSettingsOpen(false);
          setNotesOpen(true);
        }}
        onInstallPwa={() => {
          void installApp();
        }}
      />

      <BottomNav
        currentIndex={activeIndex}
        totalChapters={totalChapters}
        onPrev={() => changeChapter(-1)}
        onNext={() => changeChapter(1)}
      />

      <Toast message={toastMessage} visible={toastVisible} />
      <BottomHint message={bottomHintMessage} visible={bottomHintVisible} />

      <EndingCinematic
        open={endingCinematicOpen}
        workTitle={work.title}
        onComplete={completeEndingCinematic}
      />

      <AudioFab
        isMuted={isAudioMuted}
        onToggleMute={() => audioManager.toggleMute()}
      />

      <PrivateNotesSheet
        open={notesOpen}
        chapter={activeChapter}
        existingNote={getNote(activeChapter.id)}
        onSaveNote={saveNote}
        onClose={() => setNotesOpen(false)}
      />

      <VisualEffectsLayer
        chapterId={displayedChapter.id}
        effect={displayedChapter.effect}
        triggerMode={displayedChapter.vfxTrigger}
        durationMs={displayedChapter.vfxDurationMs}
      />

      <UpdateBanner visible={hasUpdate} onReload={applyUpdate} />
    </>
  );
}

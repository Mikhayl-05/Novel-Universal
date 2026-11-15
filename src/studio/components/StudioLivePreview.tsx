import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Moon,
  Music,
  Sparkles,
  Square,
  Sun,
} from 'lucide-react';
import { VisualEffectsLayer } from '../../components/VisualEffectsLayer';
import { audioMap } from '../../data/audioMap';
import { audioManager } from '../../services/audioManager';
import type { Chapter } from '../../types/novel';
import { buildChapterHtml } from '../../utils/chapterHtml';
import type { StudioChapter, StudioViewMode } from '../types/studio';

interface StudioLivePreviewProps {
  mode: Exclude<StudioViewMode, 'editor'>;
  chapters: StudioChapter[];
  activeChapter: StudioChapter;
  initialTheme?: 'dark' | 'light';
  onExitPreview: () => void;
  onChangeMode: (mode: StudioViewMode) => void;
}

function toPreviewReaderChapter(
  ch: StudioChapter,
  usePublishedSnapshot: boolean,
): Chapter | null {
  if (usePublishedSnapshot) {
    if (!ch.publishedAt || !ch.publishedHtml) return null;
    return {
      id: ch.legacyId || ch.id,
      num: ch.publishedNum ?? ch.num,
      title: ch.publishedTitle ?? ch.title,
      setting: ch.publishedSetting ?? ch.setting,
      feeling: ch.publishedFeeling ?? undefined,
      isPrologue: Boolean(ch.publishedIsPrologue),
      isEnding: Boolean(ch.publishedIsEnding),
      bgm: ch.publishedBgm ?? ch.draftBgm,
      bgmUrl: ch.publishedBgmUrl ?? ch.draftBgmUrl,
      bgmVolume: ch.publishedBgmVolume ?? ch.draftBgmVolume,
      bgmLoop: ch.publishedBgmLoop ?? ch.draftBgmLoop,
      effect: ch.publishedEffect ?? ch.draftEffect,
      vfxTrigger: ch.publishedVfxTrigger ?? ch.draftVfxTrigger,
      vfxDurationMs: ch.publishedVfxDurationMs ?? ch.draftVfxDurationMs,
      content: ch.publishedHtml,
    };
  }

  return {
    id: ch.legacyId || ch.id,
    num: ch.num,
    title: ch.title,
    setting: ch.setting,
    feeling: ch.feeling || undefined,
    isPrologue: ch.isPrologue,
    isEnding: ch.isEnding,
    bgm: ch.draftBgm,
    bgmUrl: ch.draftBgmUrl,
    bgmVolume: ch.draftBgmVolume,
    bgmLoop: ch.draftBgmLoop,
    effect: ch.draftEffect,
    vfxTrigger: ch.draftVfxTrigger,
    vfxDurationMs: ch.draftVfxDurationMs,
    content: ch.draftHtml,
  };
}

export function StudioLivePreview({
  mode,
  chapters,
  activeChapter,
  initialTheme = 'dark',
  onExitPreview,
  onChangeMode,
}: StudioLivePreviewProps) {
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>(initialTheme);
  const [novelIndex, setNovelIndex] = useState(() =>
    Math.max(
      0,
      chapters.findIndex((c) => c.id === activeChapter.id),
    ),
  );
  const [audioPlaying, setAudioPlaying] = useState(false);

  useEffect(() => {
    const idx = chapters.findIndex((c) => c.id === activeChapter.id);
    if (idx !== -1) setNovelIndex(idx);
  }, [activeChapter.id, chapters]);

  useEffect(() => {
    return () => {
      audioManager.stopPreview();
    };
  }, []);

  const targetStudioChapter =
    mode === 'preview-novel'
      ? (chapters[novelIndex] ?? activeChapter)
      : activeChapter;

  const isPublishedView = mode === 'preview-published';
  const readerChapter = useMemo(
    () => toPreviewReaderChapter(targetStudioChapter, isPublishedView),
    [targetStudioChapter, isPublishedView],
  );

  const renderedHtml = useMemo(
    () => (readerChapter ? buildChapterHtml(readerChapter) : ''),
    [readerChapter],
  );

  const toggleBgm = () => {
    if (!readerChapter) return;
    if (audioPlaying) {
      audioManager.stopPreview();
      setAudioPlaying(false);
      return;
    }
    const bgmKey = readerChapter.bgm || 'default';
    const url =
      readerChapter.bgmUrl ||
      (bgmKey === 'default' ? audioMap.default[0] : audioMap[bgmKey]);
    if (url) {
      audioManager.playPreview(
        url,
        readerChapter.bgmVolume ?? 0.42,
        readerChapter.bgmLoop !== false,
      );
      setAudioPlaying(true);
    }
  };

  return (
    <div
      className="studio-preview-shell studio-allow-select"
      data-theme={previewTheme}
    >
      <div className="studio-preview-bar">
        <div className="studio-preview-modes">
          <button
            type="button"
            className={`studio-preview-pill${mode === 'preview-chapter' ? ' is-active' : ''}`}
            onClick={() => onChangeMode('preview-chapter')}
          >
            Draft Bagian Ini
          </button>
          <button
            type="button"
            className={`studio-preview-pill${mode === 'preview-novel' ? ' is-active' : ''}`}
            onClick={() => onChangeMode('preview-novel')}
          >
            Simulasi Karya
          </button>
          <button
            type="button"
            className={`studio-preview-pill${mode === 'preview-published' ? ' is-active' : ''}`}
            onClick={() => onChangeMode('preview-published')}
          >
            Versi Publik (Live)
          </button>
        </div>

        <div className="studio-preview-actions">
          {mode === 'preview-novel' && (
            <div className="studio-preview-pager">
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                disabled={novelIndex <= 0}
                onClick={() => setNovelIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={14} />
                <span>Sebelumnya</span>
              </button>
              <span className="studio-preview-index tabular-nums">
                {novelIndex + 1} / {chapters.length}
              </span>
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                disabled={novelIndex >= chapters.length - 1}
                onClick={() =>
                  setNovelIndex((i) => Math.min(chapters.length - 1, i + 1))
                }
              >
                <span>Berikutnya</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {readerChapter && (
            <>
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                onClick={toggleBgm}
              >
                {audioPlaying ? <Square size={13} /> : <Music size={13} />}
                <span>
                  {audioPlaying
                    ? 'Stop BGM'
                    : readerChapter.bgmUrl
                      ? 'BGM: Musik Kustom'
                      : `BGM: ${readerChapter.bgm}`}
                </span>
              </button>
              {readerChapter.effect && readerChapter.effect !== 'none' && (
                <button
                  type="button"
                  className="studio-btn studio-btn-secondary studio-btn-sm"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('studio:test-vfx', {
                        detail: {
                          effect: readerChapter.effect,
                          durationMs: readerChapter.vfxDurationMs ?? 25000,
                        },
                      }),
                    );
                  }}
                >
                  <Sparkles size={13} />
                  <span>Uji VFX</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="studio-btn studio-btn-secondary studio-btn-sm"
            onClick={() =>
              setPreviewTheme((t) => (t === 'dark' ? 'light' : 'dark'))
            }
          >
            {previewTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{previewTheme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>

          <button
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={onExitPreview}
          >
            <Eye size={14} />
            <span>Kembali ke Editor</span>
          </button>
        </div>
      </div>

      <div
        className={`studio-preview-stage theme-${previewTheme}`}
        data-theme={previewTheme}
      >
        {!readerChapter ? (
          <div className="studio-preview-unpublished">
            <h2>Bagian ini belum pernah dipublikasikan</h2>
            <p>
              Publikasikan terlebih dahulu agar pembaca publik dapat melihat
              snapshot live di Ruang Karya Reader.
            </p>
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => onChangeMode('preview-chapter')}
            >
              Lihat Pratinjau Draft
            </button>
          </div>
        ) : (
          <main className="reader-container studio-preview-reader">
            <div
              className="chapter-content fade-in"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
            <VisualEffectsLayer
              chapterId={readerChapter.id}
              effect={readerChapter.effect}
              triggerMode={readerChapter.vfxTrigger ?? 'immediate'}
              durationMs={readerChapter.vfxDurationMs}
            />
          </main>
        )}
      </div>
    </div>
  );
}

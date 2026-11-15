import { EditorContent, type Editor } from '@tiptap/react';
import type { MarginPreset, StudioChapter } from '../types/studio';

interface DocumentWorkspaceCanvasProps {
  editor: Editor | null;
  chapter: StudioChapter | null;
  zoom: number;
  showRuler: boolean;
  marginPreset: MarginPreset;
  onUpdateHeaderField: (
    field: 'num' | 'title' | 'setting' | 'feeling',
    value: string,
  ) => void;
}

const MARGIN_PX_MAP: Record<MarginPreset, number> = {
  narrow: 44,
  normal: 76,
  wide: 112,
};

const RULER_INCHES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function DocumentWorkspaceCanvas({
  editor,
  chapter,
  zoom,
  showRuler,
  marginPreset,
  onUpdateHeaderField,
}: DocumentWorkspaceCanvasProps) {
  const paddingX = MARGIN_PX_MAP[marginPreset] ?? 76;

  if (!chapter) {
    return (
      <section className="studio-canvas-scroll studio-allow-select">
        <div className="studio-canvas-empty">
          <h2>Pilih atau buat naskah baru</h2>
          <p>
            Gunakan panel kiri untuk membuka bagian yang sudah ada atau membuat
            bab, cerita pendek, maupun catatan baru.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="studio-canvas-scroll studio-allow-select"
      aria-label="Kanvas penyuntingan naskah"
    >
      {showRuler && (
        <div className="studio-ruler-sticky" aria-hidden="true">
          <div
            className="studio-ruler-track"
            style={{ width: `${Math.round(816 * zoom)}px` }}
          >
            <div
              className="studio-ruler-margin left"
              style={{ width: `${Math.round(paddingX * zoom)}px` }}
            />
            <div
              className="studio-ruler-margin right"
              style={{ width: `${Math.round(paddingX * zoom)}px` }}
            />
            <div className="studio-ruler-ticks">
              {RULER_INCHES.map((n) => (
                <div key={n} className="studio-ruler-unit">
                  <span className="studio-ruler-num">{n}</span>
                  <div className="studio-ruler-subticks">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="studio-paper-stage">
        <div
          className="studio-paper-scaler"
          style={{
            width: `${Math.round(816 * zoom)}px`,
          }}
        >
          <article
            className="studio-paper-page"
            style={{
              width: '816px',
              paddingLeft: `${paddingX}px`,
              paddingRight: `${paddingX}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <header className="studio-page-chapter-head">
              <div className="studio-page-head-row">
                <input
                  type="text"
                  className="studio-doc-num-input"
                  aria-label="Nomor atau label bab"
                  placeholder="Bab I / Prolog"
                  value={chapter.num}
                  onChange={(e) => onUpdateHeaderField('num', e.target.value)}
                />
                {chapter.isPrologue && (
                  <span className="studio-doc-flag">Prolog</span>
                )}
                {chapter.isEnding && (
                  <span className="studio-doc-flag">Ending</span>
                )}
              </div>

              <input
                type="text"
                className="studio-doc-title-input"
                aria-label="Judul bab"
                placeholder="Judul Bab…"
                value={chapter.title}
                onChange={(e) => onUpdateHeaderField('title', e.target.value)}
              />

              <div className="studio-doc-meta-inputs">
                <input
                  type="text"
                  className="studio-doc-setting-input"
                  aria-label="Latar tempat dan waktu"
                  placeholder="📍 Latar tempat & waktu (mis. Halaman SD · 2012)"
                  value={chapter.setting}
                  onChange={(e) => onUpdateHeaderField('setting', e.target.value)}
                />
                <input
                  type="text"
                  className="studio-doc-feeling-input"
                  aria-label="Suasana atau feeling bab"
                  placeholder="Suasana bab (opsional)"
                  value={chapter.feeling}
                  onChange={(e) => onUpdateHeaderField('feeling', e.target.value)}
                />
              </div>
            </header>

            <div className="studio-editor-surface">
              <EditorContent editor={editor} />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

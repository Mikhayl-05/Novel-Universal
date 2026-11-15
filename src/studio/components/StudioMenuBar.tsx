import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Search, X } from 'lucide-react';
import type { MarginPreset, StudioViewMode } from '../types/studio';

type MenuKey = 'file' | 'edit' | 'view' | 'insert' | 'format' | 'tools' | 'help';

interface StudioMenuBarProps {
  editor: Editor | null;
  viewMode: StudioViewMode;
  studioTheme: 'dark' | 'light';
  showSidebar: boolean;
  showInspector: boolean;
  showRuler: boolean;
  marginPreset: MarginPreset;
  onSaveNow: () => void;
  onRefreshFromServer: () => void;
  onNewChapter: () => void;
  onDuplicateChapter: () => void;
  onOpenNewNovel: () => void;
  onOpenWorkSettings: () => void;
  onOpenPublishModal: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onToggleRuler: () => void;
  onChangeMarginPreset: (preset: MarginPreset) => void;
  onChangeViewMode: (mode: StudioViewMode) => void;
  onInsertBlock: (blockType: string) => void;
  onOpenLinkModal: () => void;
  onOpenWordCountModal: () => void;
  onOpenShortcutsModal: () => void;
  onPrint: () => void;
}

export function StudioMenuBar({
  editor,
  viewMode,
  studioTheme,
  showSidebar,
  showInspector,
  showRuler,
  marginPreset,
  onSaveNow,
  onRefreshFromServer,
  onNewChapter,
  onDuplicateChapter,
  onOpenNewNovel,
  onOpenWorkSettings,
  onOpenPublishModal,
  onToggleTheme,
  onToggleSidebar,
  onToggleInspector,
  onToggleRuler,
  onChangeMarginPreset,
  onChangeViewMode,
  onInsertBlock,
  onOpenLinkModal,
  onOpenWordCountModal,
  onOpenShortcutsModal,
  onPrint,
}: StudioMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findStatus, setFindStatus] = useState<string>('');
  const barRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});

  const updateDropdownPosition = (key: MenuKey) => {
    const btn = triggerRefs.current[key];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 264;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - dropdownWidth - 8),
    );
    setDropdownPos({ left, top: rect.bottom + 4 });
  };

  useLayoutEffect(() => {
    if (!openMenu) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPosition(openMenu);
    const onResize = () => updateDropdownPosition(openMenu);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [openMenu]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpenMenu(null);
    fn();
  };

  const handleFindNext = () => {
    if (!editor || !findQuery.trim()) return;
    const docText = editor.state.doc.textBetween(
      0,
      editor.state.doc.content.size,
      '\n',
    );
    const needle = findQuery.toLowerCase();
    const haystack = docText.toLowerCase();
    const matchCount = haystack.split(needle).length - 1;
    if (matchCount === 0) {
      setFindStatus('Tidak ditemukan');
      return;
    }

    let foundFrom = -1;
    let foundTo = -1;
    const currentTo = editor.state.selection.to;
    const positions: Array<{ from: number; to: number }> = [];

    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const lower = node.text.toLowerCase();
      let idx = 0;
      while ((idx = lower.indexOf(needle, idx)) !== -1) {
        positions.push({ from: pos + idx, to: pos + idx + findQuery.length });
        idx += needle.length;
      }
    });

    if (positions.length === 0) {
      setFindStatus('Tidak ditemukan');
      return;
    }

    const nextPos = positions.find((p) => p.from >= currentTo) ?? positions[0];
    foundFrom = nextPos.from;
    foundTo = nextPos.to;

    editor.chain().focus().setTextSelection({ from: foundFrom, to: foundTo }).run();
    const activeIndex = positions.indexOf(nextPos) + 1;
    setFindStatus(`${activeIndex}/${positions.length}`);
  };

  const handleReplaceCurrent = () => {
    if (!editor || !findQuery.trim()) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    if (selected.toLowerCase() === findQuery.toLowerCase()) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, replaceQuery)
        .run();
      handleFindNext();
    } else {
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!editor || !findQuery.trim()) return;
    const needle = findQuery.toLowerCase();
    const ranges: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const lower = node.text.toLowerCase();
      let idx = 0;
      while ((idx = lower.indexOf(needle, idx)) !== -1) {
        ranges.push({ from: pos + idx, to: pos + idx + findQuery.length });
        idx += needle.length;
      }
    });
    if (ranges.length === 0) {
      setFindStatus('0 diganti');
      return;
    }
    const tr = editor.state.tr;
    for (let i = ranges.length - 1; i >= 0; i--) {
      tr.insertText(replaceQuery, ranges[i].from, ranges[i].to);
    }
    editor.view.dispatch(tr);
    setFindStatus(`${ranges.length} diganti`);
  };

  const menus: Array<{ key: MenuKey; label: string }> = [
    { key: 'file', label: 'File' },
    { key: 'edit', label: 'Edit' },
    { key: 'view', label: 'View' },
    { key: 'insert', label: 'Insert' },
    { key: 'format', label: 'Format' },
    { key: 'tools', label: 'Tools' },
    { key: 'help', label: 'Help' },
  ];

  return (
    <div ref={barRef} className="studio-menubar-wrap">
      <nav className="studio-menubar" aria-label="Menu dokumen">
        {menus.map((m) => (
          <div key={m.key} className="studio-menu-item-wrap">
            <button
              ref={(el) => {
                triggerRefs.current[m.key] = el;
              }}
              type="button"
              className={`studio-menu-trigger${openMenu === m.key ? ' is-open' : ''}`}
              aria-expanded={openMenu === m.key}
              aria-haspopup="menu"
              onClick={() =>
                setOpenMenu((prev) => (prev === m.key ? null : m.key))
              }
              onMouseEnter={() => {
                if (openMenu) setOpenMenu(m.key);
              }}
            >
              {m.label}
            </button>
          </div>
        ))}
      </nav>

      {openMenu && dropdownPos && (
        <div
          className="studio-menu-dropdown studio-menu-dropdown-fixed"
          role="menu"
          style={{
            left: `${dropdownPos.left}px`,
            top: `${dropdownPos.top}px`,
          }}
        >
          {openMenu === 'file' && (
            <>
              <button type="button" role="menuitem" onClick={() => run(onNewChapter)}>
                <span>Bab Baru</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onDuplicateChapter)}
              >
                <span>Duplikat Bab Ini</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onOpenNewNovel)}
              >
                <span>Buat Karya Baru (Novel / Cerpen / Notes)…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onOpenWorkSettings)}
              >
                <span>Pengaturan Karya Aktif…</span>
              </button>
              <div className="studio-menu-sep" />
              <button type="button" role="menuitem" onClick={() => run(onSaveNow)}>
                <span>Simpan Draft Sekarang</span>
                <kbd>Ctrl+S</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onRefreshFromServer)}
              >
                <span>Muat Ulang dari Cloud</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onOpenPublishModal)}
              >
                <span>Publikasikan Bagian Ini…</span>
              </button>
              <div className="studio-menu-sep" />
              <button type="button" role="menuitem" onClick={() => run(onPrint)}>
                <span>Cetak / Print Manuskrip</span>
                <kbd>Ctrl+P</kbd>
              </button>
            </>
          )}

          {openMenu === 'edit' && (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={!editor?.can().undo()}
                onClick={() => run(() => editor?.chain().focus().undo().run())}
              >
                <span>Undo</span>
                <kbd>Ctrl+Z</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!editor?.can().redo()}
                onClick={() => run(() => editor?.chain().focus().redo().run())}
              >
                <span>Redo</span>
                <kbd>Ctrl+Y</kbd>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().selectAll().run())}
              >
                <span>Pilih Semua</span>
                <kbd>Ctrl+A</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  run(() => {
                    setFindOpen((prev) => !prev);
                  })
                }
              >
                <span>Cari &amp; Ganti…</span>
              </button>
            </>
          )}

          {openMenu === 'view' && (
            <>
              <button type="button" role="menuitem" onClick={() => run(onToggleTheme)}>
                <span>
                  {studioTheme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                </span>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeViewMode('editor'))}
              >
                <span>{viewMode === 'editor' ? '✓ ' : ''}Mode Editor</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeViewMode('preview-chapter'))}
              >
                <span>
                  {viewMode === 'preview-chapter' ? '✓ ' : ''}Pratinjau Bab (Draft)
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeViewMode('preview-novel'))}
              >
                <span>
                  {viewMode === 'preview-novel' ? '✓ ' : ''}Pratinjau Novel Lengkap
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeViewMode('preview-published'))}
              >
                <span>
                  {viewMode === 'preview-published' ? '✓ ' : ''}Pratinjau Versi Publik
                </span>
              </button>
              <div className="studio-menu-sep" />
              <button type="button" role="menuitem" onClick={() => run(onToggleSidebar)}>
                <span>{showSidebar ? '✓ ' : ''}Sidebar Bab &amp; Outline</span>
              </button>
              <button type="button" role="menuitem" onClick={() => run(onToggleInspector)}>
                <span>{showInspector ? '✓ ' : ''}Panel Inspektur &amp; Audio/VFX</span>
              </button>
              <button type="button" role="menuitem" onClick={() => run(onToggleRuler)}>
                <span>{showRuler ? '✓ ' : ''}Penggaris Halaman (Ruler)</span>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeMarginPreset('narrow'))}
              >
                <span>{marginPreset === 'narrow' ? '✓ ' : ''}Margin Sempit</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeMarginPreset('normal'))}
              >
                <span>{marginPreset === 'normal' ? '✓ ' : ''}Margin Normal</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeMarginPreset('wide'))}
              >
                <span>{marginPreset === 'wide' ? '✓ ' : ''}Margin Lebar</span>
              </button>
            </>
          )}

          {openMenu === 'insert' && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('dialogueBlock'))}
              >
                <span>Blok Dialog Karakter</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('innerThoughtBlock'))}
              >
                <span>Blok Monolog Batin</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('customNarrativeBlock'))}
              >
                <span>Blok Naratif (Flashback / Chat / Surat)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('chapterHeading'))}
              >
                <span>Penanda Sub-Bab (Chapter Heading)</span>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('sceneBreak'))}
              >
                <span>Pemisah Adegan (Scene Break)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('pageBreak'))}
              >
                <span>Batas Halaman (Page Break)</span>
                <kbd>Ctrl+Enter</kbd>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('sfxBlock'))}
              >
                <span>SFX Cue</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('vfxBlock'))}
              >
                <span>VFX Cue</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('bgmCue'))}
              >
                <span>BGM Cue</span>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onInsertBlock('imageBlock'))}
              >
                <span>Gambar Ilustrasi</span>
              </button>
              <button type="button" role="menuitem" onClick={() => run(onOpenLinkModal)}>
                <span>Tautan (Link)</span>
                <kbd>Ctrl+K</kbd>
              </button>
            </>
          )}

          {openMenu === 'format' && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().toggleBold().run())}
              >
                <span>Tebal (Bold)</span>
                <kbd>Ctrl+B</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}
              >
                <span>Miring (Italic)</span>
                <kbd>Ctrl+I</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}
              >
                <span>Garis Bawah (Underline)</span>
                <kbd>Ctrl+U</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().toggleStrike().run())}
              >
                <span>Coret (Strikethrough)</span>
                <kbd>Ctrl+Shift+X</kbd>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => editor?.chain().focus().setParagraph().run())}
              >
                <span>Paragraf Normal</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())
                }
              >
                <span>Heading 1</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())
                }
              >
                <span>Heading 2</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  run(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())
                }
              >
                <span>Heading 3</span>
              </button>
              <div className="studio-menu-sep" />
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  run(() => editor?.chain().focus().unsetAllMarks().clearNodes().run())
                }
              >
                <span>Hapus Format Teks</span>
              </button>
            </>
          )}

          {openMenu === 'tools' && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onOpenWordCountModal)}
              >
                <span>Statistik Kata &amp; Karakter…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => setFindOpen(true))}
              >
                <span>Cari &amp; Ganti dalam Bab…</span>
              </button>
            </>
          )}

          {openMenu === 'help' && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onOpenShortcutsModal)}
              >
                <span>Pintasan Keyboard &amp; Menu '/'…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onChangeViewMode('preview-chapter'))}
              >
                <span>Uji Tampilan Reader</span>
              </button>
            </>
          )}
        </div>
      )}

      {findOpen && (
        <div className="studio-find-bar" role="region" aria-label="Cari dan ganti">
          <Search size={14} className="studio-find-icon" />
          <input
            type="text"
            className="studio-find-input"
            placeholder="Cari kata…"
            aria-label="Cari kata"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFindNext();
            }}
          />
          <input
            type="text"
            className="studio-find-input"
            placeholder="Ganti dengan…"
            aria-label="Ganti dengan"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
          />
          <button type="button" className="studio-find-btn" onClick={handleFindNext}>
            Cari Berikutnya
          </button>
          <button
            type="button"
            className="studio-find-btn"
            onClick={handleReplaceCurrent}
          >
            Ganti
          </button>
          <button type="button" className="studio-find-btn" onClick={handleReplaceAll}>
            Ganti Semua
          </button>
          {findStatus && <span className="studio-find-status">{findStatus}</span>}
          <button
            type="button"
            className="studio-icon-btn"
            aria-label="Tutup cari dan ganti"
            onClick={() => setFindOpen(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

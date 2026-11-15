import { Link } from 'react-router-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Keyboard,
  List,
  ListOrdered,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Moon,
  MoreHorizontal,
  Music,
  Redo2,
  RefreshCw,
  Save,
  Search,
  SeparatorHorizontal,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SplitSquareVertical,
  Strikethrough,
  Sun,
  Type,
  Underline,
  Undo2,
  UploadCloud,
  Volume2,
  X,
} from 'lucide-react';
import type { SaveState, StudioNovel } from '../types/studio';

export type MobileSheetKind = 'chapters' | 'format' | 'inspector' | 'more' | null;

interface StudioMobileDockProps {
  activeSheet: MobileSheetKind;
  saveState: SaveState;
  hasChapter: boolean;
  onToggleSheet: (sheet: Exclude<MobileSheetKind, null>) => void;
  onManualSave: () => void;
}

export function StudioMobileDock({
  activeSheet,
  saveState,
  hasChapter,
  onToggleSheet,
  onManualSave,
}: StudioMobileDockProps) {
  const isBusy = saveState === 'syncing' || saveState === 'saving';

  return (
    <nav className="studio-mobile-dock" aria-label="Menu cepat editor mobile">
      <button
        type="button"
        className={`studio-mobile-dock-btn${activeSheet === 'chapters' ? ' is-active' : ''}`}
        aria-expanded={activeSheet === 'chapters'}
        onClick={() => onToggleSheet('chapters')}
      >
        <BookOpen size={18} />
        <span>Bab</span>
      </button>

      <button
        type="button"
        className={`studio-mobile-dock-btn${activeSheet === 'format' ? ' is-active' : ''}`}
        disabled={!hasChapter}
        aria-expanded={activeSheet === 'format'}
        onClick={() => onToggleSheet('format')}
      >
        <Type size={18} />
        <span>Format</span>
      </button>

      <button
        type="button"
        className={`studio-mobile-dock-btn is-save${
          saveState === 'error' || saveState === 'offline' ? ' has-alert' : ''
        }`}
        disabled={!hasChapter || isBusy}
        onClick={onManualSave}
      >
        {isBusy ? (
          <Loader2 size={18} className="studio-spin" />
        ) : saveState === 'saved' ? (
          <Check size={18} />
        ) : (
          <Save size={18} />
        )}
        <span>{isBusy ? 'Menyimpan' : 'Simpan'}</span>
      </button>

      <button
        type="button"
        className={`studio-mobile-dock-btn${activeSheet === 'inspector' ? ' is-active' : ''}`}
        disabled={!hasChapter}
        aria-expanded={activeSheet === 'inspector'}
        onClick={() => onToggleSheet('inspector')}
      >
        <SlidersHorizontal size={18} />
        <span>Atur</span>
      </button>

      <button
        type="button"
        className={`studio-mobile-dock-btn${activeSheet === 'more' ? ' is-active' : ''}`}
        aria-expanded={activeSheet === 'more'}
        onClick={() => onToggleSheet('more')}
      >
        <MoreHorizontal size={18} />
        <span>Lainnya</span>
      </button>
    </nav>
  );
}

export function StudioMobileFormatSheet({
  editor,
  onInsertBlock,
  onClose,
}: {
  editor: Editor | null;
  onInsertBlock: (blockType: string) => void;
  onClose: () => void;
}) {
  const activeState = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor;
      if (!ed) {
        return {
          canUndo: false,
          canRedo: false,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          bulletList: false,
          orderedList: false,
          h1: false,
          h2: false,
          align: 'left',
        };
      }
      return {
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        h1: ed.isActive('heading', { level: 1 }),
        h2: ed.isActive('heading', { level: 2 }),
        align: ed.isActive({ textAlign: 'center' })
          ? 'center'
          : ed.isActive({ textAlign: 'right' })
            ? 'right'
            : ed.isActive({ textAlign: 'justify' })
              ? 'justify'
              : 'left',
      };
    },
  });

  const insertAndClose = (blockType: string) => {
    onInsertBlock(blockType);
    onClose();
  };

  return (
    <div className="studio-mobile-sheet-panel" role="dialog" aria-label="Format dan sisipkan blok">
      <div className="studio-mobile-sheet-head">
        <h3>Format &amp; Blok Cerita</h3>
        <button
          type="button"
          className="studio-icon-btn studio-mobile-close-btn"
          aria-label="Tutup panel format"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="studio-mobile-sheet-body">
        <div className="studio-mobile-format-section">
          <span className="studio-mobile-sec-label">Format Teks &amp; Paragraf</span>
          <div className="studio-mobile-tool-grid">
            <button
              type="button"
              className="studio-mobile-tool-btn"
              disabled={!activeState?.canUndo}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={16} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              className="studio-mobile-tool-btn"
              disabled={!activeState?.canRedo}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={16} />
              <span>Redo</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.bold ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={16} />
              <span>Tebal</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.italic ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} />
              <span>Miring</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.underline ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline size={16} />
              <span>Bawah</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.strike ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={16} />
              <span>Coret</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.h1 ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 size={16} />
              <span>H1</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.h2 ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 size={16} />
              <span>H2</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.bulletList ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={16} />
              <span>Poin</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.orderedList ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={16} />
              <span>Nomor</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.align === 'left' ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft size={16} />
              <span>Kiri</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.align === 'center' ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter size={16} />
              <span>Tengah</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.align === 'right' ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight size={16} />
              <span>Kanan</span>
            </button>
            <button
              type="button"
              className={`studio-mobile-tool-btn${activeState?.align === 'justify' ? ' is-active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify size={16} />
              <span>Rapi</span>
            </button>
          </div>
        </div>

        <div className="studio-mobile-format-section">
          <span className="studio-mobile-sec-label">Sisipkan Blok Cerita &amp; Cue</span>
          <div className="studio-mobile-block-grid">
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('dialogueBlock')}
            >
              <MessageSquareQuote size={16} />
              <span>Dialog Karakter</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('innerThoughtBlock')}
            >
              <Type size={16} />
              <span>Monolog Batin</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('customNarrativeBlock')}
            >
              <BookOpen size={16} />
              <span>Blok Naratif</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('imageBlock')}
            >
              <ImageIcon size={16} />
              <span>Gambar</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('sceneBreak')}
            >
              <SeparatorHorizontal size={16} />
              <span>Scene Break</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('pageBreak')}
            >
              <SplitSquareVertical size={16} />
              <span>Page Break</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('sfxBlock')}
            >
              <Volume2 size={16} />
              <span>SFX Cue</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('vfxBlock')}
            >
              <Sparkles size={16} />
              <span>VFX Cue</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('bgmCue')}
            >
              <Music size={16} />
              <span>BGM Cue</span>
            </button>
            <button
              type="button"
              className="studio-mobile-block-btn"
              onClick={() => insertAndClose('chapterHeading')}
            >
              <BookOpen size={16} />
              <span>Penanda Sub-Bab</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudioMobileMoreSheet({
  activeNovel,
  studioTheme,
  hasChapter,
  wordCount,
  onPublish,
  onPreview,
  onFindReplace,
  onRefreshFromServer,
  onOpenWorkSettings,
  onOpenWordCount,
  onOpenShortcuts,
  onToggleTheme,
  onBackToHub,
  onSignOut,
  onClose,
}: {
  activeNovel: StudioNovel | null;
  studioTheme: 'dark' | 'light';
  hasChapter: boolean;
  wordCount: number;
  onPublish: () => void;
  onPreview: () => void;
  onFindReplace: () => void;
  onRefreshFromServer: () => void;
  onOpenWorkSettings: () => void;
  onOpenWordCount: () => void;
  onOpenShortcuts: () => void;
  onToggleTheme: () => void;
  onBackToHub: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const act = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <div className="studio-mobile-sheet-panel" role="dialog" aria-label="Menu lainnya">
      <div className="studio-mobile-sheet-head">
        <h3>Aksi Dokumen &amp; Proyek</h3>
        <button
          type="button"
          className="studio-icon-btn studio-mobile-close-btn"
          aria-label="Tutup menu"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="studio-mobile-sheet-body">
        <div className="studio-mobile-more-list">
          <button
            type="button"
            className="studio-mobile-more-btn is-primary"
            disabled={!hasChapter}
            onClick={() => act(onPublish)}
          >
            <UploadCloud size={17} />
            <span>Publikasikan Bagian Ini ke Reader</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            disabled={!hasChapter}
            onClick={() => act(onPreview)}
          >
            <Eye size={17} />
            <span>Pratinjau Tampilan Reader</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            disabled={!hasChapter}
            onClick={() => act(onFindReplace)}
          >
            <Search size={17} />
            <span>Cari &amp; Ganti dalam Bab</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            disabled={!activeNovel}
            onClick={() => act(onOpenWorkSettings)}
          >
            <Settings size={17} />
            <span>Pengaturan Karya (Judul / Sampul / Status)</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            disabled={!hasChapter}
            onClick={() => act(onRefreshFromServer)}
          >
            <RefreshCw size={17} />
            <span>Muat Ulang dari Supabase</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            onClick={() => act(onOpenWordCount)}
          >
            <Type size={17} />
            <span className="tabular-nums">
              Statistik Kata ({wordCount.toLocaleString('id-ID')} kata)
            </span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            onClick={() => act(onOpenShortcuts)}
          >
            <Keyboard size={17} />
            <span>Pintasan Keyboard &amp; Menu &apos;/&apos;</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn"
            onClick={() => act(onToggleTheme)}
          >
            {studioTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            <span>
              {studioTheme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            </span>
          </button>

          {activeNovel && (
            <Link
              to={`/read/${activeNovel.slug}`}
              className="studio-mobile-more-btn"
              onClick={onClose}
            >
              <ExternalLink size={17} />
              <span>Buka Halaman Reader Publik</span>
            </Link>
          )}

          <div className="studio-menu-sep" />

          <button
            type="button"
            className="studio-mobile-more-btn"
            onClick={() => act(onBackToHub)}
          >
            <ArrowLeft size={17} />
            <span>Kembali ke Beranda Studio (Semua Proyek)</span>
          </button>

          <button
            type="button"
            className="studio-mobile-more-btn is-danger"
            onClick={() => act(onSignOut)}
          >
            <LogOut size={17} />
            <span>Keluar dari Studio Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}

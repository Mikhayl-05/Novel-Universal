import { useEffect, useRef, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Plus,
  Printer,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';

interface StudioToolbarProps {
  editor: Editor | null;
  zoom: number;
  onChangeZoom: (zoom: number) => void;
  onPrint: () => void;
  onOpenLinkModal: () => void;
  onInsertBlock: (blockType: string) => void;
}

const FONT_FAMILIES = [
  { label: 'Lora (Serif Novel)', value: "'Lora', Georgia, serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'System Sans', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Monospace', value: "'JetBrains Mono', 'Courier New', monospace" },
];

const FONT_SIZES = ['12px', '14px', '16px', '17px', '18px', '20px', '24px', '28px'];
const LINE_SPACINGS = [
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '1.8 (Novel)', value: '1.8' },
  { label: '2.0', value: '2.0' },
];

const TEXT_COLORS = [
  { label: 'Otomatis', value: '' },
  { label: 'Krem Hangat', value: '#eadecc' },
  { label: 'Tinta Gelap', value: '#1a1814' },
  { label: 'Terakota', value: '#e0926d' },
  { label: 'Karat', value: '#c97d5a' },
  { label: 'Emas', value: '#eab308' },
  { label: 'Zamrud', value: '#4ade80' },
  { label: 'Biru Lembut', value: '#60a5fa' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Tanpa Sorotan', value: '' },
  { label: 'Terakota Lembut', value: 'rgba(224, 146, 109, 0.28)' },
  { label: 'Kuning', value: 'rgba(250, 204, 21, 0.28)' },
  { label: 'Biru Lembut', value: 'rgba(96, 165, 250, 0.25)' },
  { label: 'Hijau Lembut', value: 'rgba(74, 222, 128, 0.24)' },
  { label: 'Mawar', value: 'rgba(244, 114, 182, 0.24)' },
];

export function StudioToolbar({
  editor,
  zoom,
  onChangeZoom,
  onPrint,
  onOpenLinkModal,
  onInsertBlock,
}: StudioToolbarProps) {
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const blockWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!blockMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (blockWrapRef.current && !blockWrapRef.current.contains(e.target as Node)) {
        setBlockMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlockMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [blockMenuOpen]);

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
          link: false,
          bulletList: false,
          orderedList: false,
          blockType: 'paragraph',
          fontFamily: "'Lora', Georgia, serif",
          fontSize: '17px',
          lineHeight: '1.8',
          color: '',
          highlight: '',
          align: 'left',
        };
      }
      const attrs = ed.getAttributes('textStyle') as {
        fontFamily?: string;
        fontSize?: string;
        color?: string;
      };
      const hlAttrs = ed.getAttributes('highlight') as { color?: string };
      const paraAttrs = ed.getAttributes('paragraph') as { lineHeight?: string };
      const blockType = ed.isActive('heading', { level: 1 })
        ? 'h1'
        : ed.isActive('heading', { level: 2 })
          ? 'h2'
          : ed.isActive('heading', { level: 3 })
            ? 'h3'
            : ed.isActive('dialogueBlock')
              ? 'dialogue'
              : ed.isActive('innerThoughtBlock')
                ? 'thought'
                : 'paragraph';

      const align = ed.isActive({ textAlign: 'center' })
        ? 'center'
        : ed.isActive({ textAlign: 'right' })
          ? 'right'
          : ed.isActive({ textAlign: 'justify' })
            ? 'justify'
            : 'left';

      return {
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        link: ed.isActive('link'),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        blockType,
        fontFamily: attrs.fontFamily || "'Lora', Georgia, serif",
        fontSize: attrs.fontSize || '17px',
        lineHeight: paraAttrs.lineHeight || '1.8',
        color: attrs.color || '',
        highlight: hlAttrs.color || '',
        align,
      };
    },
  });

  const handleStyleChange = (value: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === 'paragraph') chain.setParagraph().run();
    else if (value === 'h1') chain.toggleHeading({ level: 1 }).run();
    else if (value === 'h2') chain.toggleHeading({ level: 2 }).run();
    else if (value === 'h3') chain.toggleHeading({ level: 3 }).run();
    else if (value === 'dialogue') onInsertBlock('dialogueBlock');
    else if (value === 'thought') onInsertBlock('innerThoughtBlock');
  };

  const applyLineHeight = (lh: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .updateAttributes('paragraph', { lineHeight: lh })
      .updateAttributes('heading', { lineHeight: lh })
      .updateAttributes('dialogueBlock', { lineHeight: lh })
      .updateAttributes('innerThoughtBlock', { lineHeight: lh })
      .run();
  };

  return (
    <div className="studio-toolbar" role="toolbar" aria-label="Toolbar pemformatan dokumen">
      <div className="studio-tb-group">
        <button
          type="button"
          className="studio-tb-btn"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={!activeState?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="studio-tb-btn"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          disabled={!activeState?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          className="studio-tb-btn"
          title="Cetak Manuskrip"
          aria-label="Cetak manuskrip"
          onClick={onPrint}
        >
          <Printer size={15} />
        </button>
      </div>

      <div className="studio-tb-sep" />

      <div className="studio-tb-group">
        <select
          className="studio-tb-select studio-tb-zoom"
          aria-label="Zoom halaman"
          title="Zoom halaman"
          value={zoom}
          onChange={(e) => onChangeZoom(Number(e.target.value))}
        >
          <option value={0.75}>75%</option>
          <option value={0.9}>90%</option>
          <option value={1}>100%</option>
          <option value={1.15}>115%</option>
          <option value={1.25}>125%</option>
          <option value={1.5}>150%</option>
        </select>

        <select
          className="studio-tb-select"
          aria-label="Gaya paragraf"
          title="Gaya paragraf"
          value={activeState?.blockType ?? 'paragraph'}
          onChange={(e) => handleStyleChange(e.target.value)}
        >
          <option value="paragraph">Teks Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="dialogue">Blok Dialog</option>
          <option value="thought">Monolog Batin</option>
        </select>

        <select
          className="studio-tb-select studio-tb-font"
          aria-label="Jenis font"
          title="Jenis font"
          value={activeState?.fontFamily ?? "'Lora', Georgia, serif"}
          onChange={(e) =>
            editor?.chain().focus().setFontFamily(e.target.value).run()
          }
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="studio-tb-select studio-tb-size"
          aria-label="Ukuran font"
          title="Ukuran font"
          value={activeState?.fontSize ?? '17px'}
          onChange={(e) =>
            editor?.chain().focus().setFontSize(e.target.value).run()
          }
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
        </select>
      </div>

      <div className="studio-tb-sep" />

      <div className="studio-tb-group">
        <button
          type="button"
          className={`studio-tb-btn${activeState?.bold ? ' is-active' : ''}`}
          title="Tebal (Ctrl+B)"
          aria-label="Tebal"
          aria-pressed={activeState?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.italic ? ' is-active' : ''}`}
          title="Miring (Ctrl+I)"
          aria-label="Miring"
          aria-pressed={activeState?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.underline ? ' is-active' : ''}`}
          title="Garis Bawah (Ctrl+U)"
          aria-label="Garis bawah"
          aria-pressed={activeState?.underline}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.strike ? ' is-active' : ''}`}
          title="Coret (Ctrl+Shift+X)"
          aria-label="Coret teks"
          aria-pressed={activeState?.strike}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={15} />
        </button>

        <label className="studio-tb-color-wrap" title="Warna teks" aria-label="Warna teks">
          <span
            className="studio-tb-color-letter"
            style={{
              borderBottomColor: activeState?.color || 'var(--studio-accent)',
            }}
          >
            A
          </span>
          <select
            className="studio-tb-color-select"
            aria-label="Pilih warna teks"
            value={activeState?.color || ''}
            onChange={(e) => {
              if (!editor) return;
              if (!e.target.value) {
                editor.chain().focus().unsetColor().run();
              } else {
                editor.chain().focus().setColor(e.target.value).run();
              }
            }}
          >
            {TEXT_COLORS.map((c) => (
              <option key={c.label} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="studio-tb-color-wrap" title="Sorotan (Highlight)" aria-label="Sorotan teks">
          <Highlighter size={14} />
          <select
            className="studio-tb-color-select"
            aria-label="Pilih warna sorotan"
            value={activeState?.highlight || ''}
            onChange={(e) => {
              if (!editor) return;
              if (!e.target.value) {
                editor.chain().focus().unsetHighlight().run();
              } else {
                editor
                  .chain()
                  .focus()
                  .setHighlight({ color: e.target.value })
                  .run();
              }
            }}
          >
            {HIGHLIGHT_COLORS.map((hl) => (
              <option key={hl.label} value={hl.value}>
                {hl.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="studio-tb-sep" />

      <div className="studio-tb-group">
        <button
          type="button"
          className={`studio-tb-btn${activeState?.link ? ' is-active' : ''}`}
          title="Sisipkan Tautan (Ctrl+K)"
          aria-label="Sisipkan tautan"
          onClick={onOpenLinkModal}
        >
          <LinkIcon size={15} />
        </button>
        <button
          type="button"
          className="studio-tb-btn"
          title="Sisipkan Blok Gambar"
          aria-label="Sisipkan blok gambar"
          onClick={() => onInsertBlock('imageBlock')}
        >
          <ImageIcon size={15} />
        </button>
      </div>

      <div className="studio-tb-sep" />

      <div className="studio-tb-group">
        <button
          type="button"
          className={`studio-tb-btn${activeState?.align === 'left' ? ' is-active' : ''}`}
          title="Rata Kiri"
          aria-label="Rata kiri"
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.align === 'center' ? ' is-active' : ''}`}
          title="Rata Tengah"
          aria-label="Rata tengah"
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.align === 'right' ? ' is-active' : ''}`}
          title="Rata Kanan"
          aria-label="Rata kanan"
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.align === 'justify' ? ' is-active' : ''}`}
          title="Rata Kiri-Kanan (Justify)"
          aria-label="Rata kiri kanan"
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify size={15} />
        </button>

        <select
          className="studio-tb-select studio-tb-size"
          aria-label="Spasi baris"
          title="Spasi baris"
          value={activeState?.lineHeight || '1.8'}
          onChange={(e) => applyLineHeight(e.target.value)}
        >
          {LINE_SPACINGS.map((ls) => (
            <option key={ls.value} value={ls.value}>
              ↕ {ls.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`studio-tb-btn${activeState?.bulletList ? ' is-active' : ''}`}
          title="Daftar Poin"
          aria-label="Daftar poin"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={`studio-tb-btn${activeState?.orderedList ? ' is-active' : ''}`}
          title="Daftar Bernomor"
          aria-label="Daftar bernomor"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </button>
      </div>

      <div className="studio-tb-sep" />

      <div ref={blockWrapRef} className="studio-tb-group studio-tb-blocks-wrap">
        <button
          type="button"
          className="studio-tb-insert-btn"
          aria-expanded={blockMenuOpen}
          onClick={() => setBlockMenuOpen((prev) => !prev)}
        >
          <Plus size={14} />
          <span>Blok Novel</span>
          <ChevronDown size={13} />
        </button>

        {blockMenuOpen && (
          <div className="studio-menu-dropdown studio-blocks-dropdown" role="menu">
            {[
              { type: 'dialogueBlock', label: 'Dialog Karakter' },
              { type: 'innerThoughtBlock', label: 'Monolog Batin (Inner Thought)' },
              { type: 'customNarrativeBlock', label: 'Blok Naratif (Flashback / Chat / Surat)' },
              { type: 'sceneBreak', label: 'Scene Break (✦ ✦ ✦)' },
              { type: 'pageBreak', label: 'Page Break (Ctrl+Enter)' },
              { type: 'chapterHeading', label: 'Chapter Heading Marker' },
              { type: 'sfxBlock', label: 'SFX Cue (Efek Suara)' },
              { type: 'vfxBlock', label: 'VFX Cue (Efek Visual)' },
              { type: 'bgmCue', label: 'BGM Cue (Musik Latar)' },
              { type: 'imageBlock', label: 'Gambar Ilustrasi' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                onClick={() => {
                  setBlockMenuOpen(false);
                  onInsertBlock(item.type);
                }}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, type ChangeEvent } from 'react';
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import {
  BookOpen,
  Image as ImageIcon,
  ImagePlus,
  Music,
  Play,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { audioMap } from '../../data/audioMap';
import { audioManager } from '../../services/audioManager';
import type { BgmKey, VfxKey } from '../../types/novel';
import { uploadCoverImageFile } from '../services/studioRepository';
import type { NarrativeVariant } from '../types/studio';

const SFX_PRESETS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Pilih Preset Audio…', url: '' },
  { label: 'Chime Lembut (Cute)', url: '/audio/cute.mp3' },
  { label: 'Napas Hening (Breathe)', url: '/audio/breathe.mp3' },
  { label: 'Gema Lembut (Somebody)', url: '/audio/somebody.mp3' },
];

export const BGM_OPTIONS: ReadonlyArray<{ value: BgmKey; label: string }> = [
  { value: 'default', label: 'Default Playlist (default_1 / default_2)' },
  { value: 'robbers', label: 'Robbers (Prolog / Nostalgia)' },
  { value: 'breathe', label: 'Breathe (Melankolis / SMA)' },
  { value: 'somebody', label: 'Somebody (TK / SD Awal)' },
  { value: 'about_you', label: 'About You (Emosional)' },
  { value: 'watchsleep', label: 'Watch Sleep (Malam / Tenang)' },
  { value: 'kota', label: 'Kota (Perjalanan)' },
  { value: 'cute', label: 'Cute (Manis / Ringan)' },
];

export const VFX_OPTIONS: ReadonlyArray<{ value: VfxKey; label: string }> = [
  { value: 'none', label: 'Tanpa Efek' },
  { value: 'pasir_jambu', label: 'Pasir & Daun Jambu' },
  { value: 'ice_teh', label: 'Gelembung Es Teh' },
  { value: 'dust_motes', label: 'Debu Cahaya (Dust Motes)' },
  { value: 'purple_butterfly', label: 'Kupu-kupu Ungu' },
  { value: 'red_fog', label: 'Kabut Merah (Heartbeat)' },
  { value: 'sketch_lines', label: 'Garis Sketsa' },
  { value: 'love_pop', label: 'Love Pop Hearts' },
];

export function DialogueBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const speaker = String(node.attrs.speaker ?? '');

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-dialogue${selected ? ' is-selected' : ''}`}
      data-block-type="dialogue"
    >
      <div className="studio-block-bar" contentEditable={false}>
        <span className="studio-block-kind">Dialog</span>
        <input
          type="text"
          className="studio-block-inline-input"
          placeholder="Nama pembicara (opsional)"
          aria-label="Nama pembicara dialog"
          value={speaker}
          onChange={(e) => updateAttributes({ speaker: e.target.value })}
        />
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus blok dialog"
          aria-label="Hapus blok dialog"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="studio-dialogue-surface">
        {speaker.trim() !== '' && (
          <div className="studio-dialogue-speaker-preview" contentEditable={false}>
            {speaker}
          </div>
        )}
        <NodeViewContent className="studio-dialogue-content" />
      </div>
    </NodeViewWrapper>
  );
}

export function InnerThoughtBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const tone = String(node.attrs.tone ?? 'reflective');

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-thought${selected ? ' is-selected' : ''}`}
      data-block-type="inner-thought"
    >
      <div className="studio-block-bar" contentEditable={false}>
        <span className="studio-block-kind">Monolog Batin</span>
        <select
          className="studio-block-inline-select"
          aria-label="Nada monolog batin"
          value={tone}
          onChange={(e) => updateAttributes({ tone: e.target.value })}
        >
          <option value="reflective">Reflektif</option>
          <option value="anxious">Cemas / Ragu</option>
          <option value="warm">Hangat</option>
        </select>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus blok monolog batin"
          aria-label="Hapus blok monolog batin"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <NodeViewContent className="studio-thought-content" />
    </NodeViewWrapper>
  );
}

export function SceneBreakView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const symbol = String(node.attrs.symbol ?? '✦ ✦ ✦');
  const style = String(node.attrs.style ?? 'ornament');

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-atom studio-block-scene-break${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-atom-row">
        <span className="studio-block-kind">Scene Break</span>
        <select
          className="studio-block-inline-select"
          aria-label="Gaya pemisah adegan"
          value={style}
          onChange={(e) => {
            const nextStyle = e.target.value;
            updateAttributes({
              style: nextStyle,
              symbol: nextStyle === 'line' ? '—' : symbol === '—' ? '✦ ✦ ✦' : symbol,
            });
          }}
        >
          <option value="ornament">Ornamen (✦ ✦ ✦)</option>
          <option value="line">Garis Pembatas</option>
        </select>
        {style === 'ornament' && (
          <input
            type="text"
            className="studio-block-inline-input studio-input-sm"
            aria-label="Simbol pemisah adegan"
            value={symbol}
            onChange={(e) => updateAttributes({ symbol: e.target.value })}
          />
        )}
        <div className="studio-scene-preview">
          {style === 'line' ? '──────────' : symbol}
        </div>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus scene break"
          aria-label="Hapus scene break"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export function PageBreakView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const label = String(node.attrs.label ?? 'Page Break');

  return (
    <NodeViewWrapper
      className={`studio-page-break${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-page-break-line" />
      <div className="studio-page-break-badge">
        <input
          type="text"
          className="studio-page-break-input"
          aria-label="Label batas halaman"
          value={label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
        />
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus page break"
          aria-label="Hapus page break"
          onClick={deleteNode}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="studio-page-break-line" />
    </NodeViewWrapper>
  );
}

export function SfxBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const cueName = String(node.attrs.cueName ?? 'Efek Suara');
  const audioUrl = String(node.attrs.audioUrl ?? '');
  const trigger = String(node.attrs.trigger ?? 'scroll');
  const volume = Number(node.attrs.volume ?? 0.7);

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-cue${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-cue-row">
        <Volume2 size={15} className="studio-cue-icon" />
        <span className="studio-block-kind">SFX Cue</span>
        <input
          type="text"
          className="studio-block-inline-input"
          placeholder="Nama SFX (mis. Hujan, Notifikasi)"
          aria-label="Nama efek suara"
          value={cueName}
          onChange={(e) => updateAttributes({ cueName: e.target.value })}
        />
        <select
          className="studio-block-inline-select"
          aria-label="Preset SFX bawaan"
          value={SFX_PRESETS.some((p) => p.url === audioUrl) ? audioUrl : ''}
          onChange={(e) => {
            if (e.target.value) updateAttributes({ audioUrl: e.target.value });
          }}
        >
          {SFX_PRESETS.map((p) => (
            <option key={p.label} value={p.url}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="studio-block-inline-input"
          placeholder="URL audio (/audio/...)"
          aria-label="URL file audio SFX"
          value={audioUrl}
          onChange={(e) => updateAttributes({ audioUrl: e.target.value })}
        />
        <select
          className="studio-block-inline-select"
          aria-label="Pemicu SFX"
          value={trigger}
          onChange={(e) => updateAttributes({ trigger: e.target.value })}
        >
          <option value="scroll">Saat Scroll</option>
          <option value="enter">Masuk Bab</option>
          <option value="manual">Manual</option>
        </select>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          className="studio-block-inline-input studio-input-xs"
          aria-label="Volume SFX"
          value={volume}
          onChange={(e) =>
            updateAttributes({ volume: Math.min(1, Math.max(0, Number(e.target.value))) })
          }
        />
        <button
          type="button"
          className="studio-cue-btn"
          title="Uji putar SFX"
          aria-label="Uji putar SFX"
          onClick={() => {
            if (audioUrl) audioManager.playSfx(audioUrl, volume);
          }}
        >
          <Play size={12} />
        </button>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus SFX cue"
          aria-label="Hapus SFX cue"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export function VfxBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const effect = String(node.attrs.effect ?? 'dust_motes') as VfxKey;
  const trigger = String(node.attrs.trigger ?? 'scroll');
  const durationMs = Number(node.attrs.durationMs ?? 25000);

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-cue${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-cue-row">
        <Sparkles size={15} className="studio-cue-icon" />
        <span className="studio-block-kind">VFX Cue</span>
        <select
          className="studio-block-inline-select"
          aria-label="Jenis efek visual"
          value={effect}
          onChange={(e) => updateAttributes({ effect: e.target.value })}
        >
          {VFX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="studio-block-inline-select"
          aria-label="Pemicu VFX"
          value={trigger}
          onChange={(e) => updateAttributes({ trigger: e.target.value })}
        >
          <option value="scroll">Scroll 40%</option>
          <option value="immediate">Segera</option>
          <option value="chapter_end">Akhir Bab</option>
        </select>
        <input
          type="number"
          min={1000}
          max={120000}
          step={1000}
          className="studio-block-inline-input studio-input-sm"
          aria-label="Durasi VFX (ms)"
          value={durationMs}
          onChange={(e) =>
            updateAttributes({ durationMs: Math.max(1000, Number(e.target.value) || 25000) })
          }
        />
        <button
          type="button"
          className="studio-cue-btn"
          title="Uji VFX"
          aria-label="Uji efek visual"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('studio:test-vfx', {
                detail: { effect, durationMs },
              }),
            );
          }}
        >
          <Play size={12} />
        </button>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus VFX cue"
          aria-label="Hapus VFX cue"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export function BgmCueView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [previewing, setPreviewing] = useState(false);
  const bgmKey = String(node.attrs.bgmKey ?? 'default') as BgmKey;
  const action = String(node.attrs.action ?? 'play');
  const volume = Number(node.attrs.volume ?? 0.42);
  const loop = node.attrs.loop !== false;

  const togglePreview = () => {
    if (previewing) {
      audioManager.stopPreview();
      setPreviewing(false);
    } else {
      const targetUrl =
        bgmKey === 'default' ? audioMap.default[0] : audioMap[bgmKey];
      if (targetUrl) {
        audioManager.playPreview(targetUrl, volume, loop);
        setPreviewing(true);
      }
    }
  };

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-cue${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-cue-row">
        <Music size={15} className="studio-cue-icon" />
        <span className="studio-block-kind">BGM Cue</span>
        <select
          className="studio-block-inline-select"
          aria-label="Pilih trek BGM"
          value={bgmKey}
          onChange={(e) => updateAttributes({ bgmKey: e.target.value })}
        >
          {BGM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="studio-block-inline-select"
          aria-label="Aksi BGM"
          value={action}
          onChange={(e) => updateAttributes({ action: e.target.value })}
        >
          <option value="play">Putar</option>
          <option value="crossfade">Crossfade</option>
          <option value="pause">Jeda (Pause)</option>
          <option value="fadeout">Fade Out &amp; Stop</option>
          <option value="stop">Hentikan Seketika</option>
        </select>
        <label className="studio-cue-check">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => updateAttributes({ loop: e.target.checked })}
          />
          <span>Loop</span>
        </label>
        <button
          type="button"
          className="studio-cue-btn"
          title={previewing ? 'Hentikan pratinjau' : 'Pratinjau BGM'}
          aria-label={previewing ? 'Hentikan pratinjau BGM' : 'Putar pratinjau BGM'}
          onClick={togglePreview}
        >
          {previewing ? <Square size={12} /> : <Play size={12} />}
        </button>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus BGM cue"
          aria-label="Hapus BGM cue"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export function ChapterHeadingView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const num = String(node.attrs.num ?? '');
  const title = String(node.attrs.title ?? '');
  const setting = String(node.attrs.setting ?? '');

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-chapter-heading${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-block-bar">
        <span className="studio-block-kind">
          <BookOpen size={12} /> Chapter Heading Marker
        </span>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus chapter heading"
          aria-label="Hapus chapter heading"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="studio-ch-marker-grid">
        <input
          type="text"
          className="studio-ch-marker-num"
          placeholder="Bab I / Bagian 2"
          aria-label="Nomor bagian bab"
          value={num}
          onChange={(e) => updateAttributes({ num: e.target.value })}
        />
        <input
          type="text"
          className="studio-ch-marker-title"
          placeholder="Judul sub-bab atau pembuka bagian"
          aria-label="Judul bagian bab"
          value={title}
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <input
          type="text"
          className="studio-ch-marker-setting"
          placeholder="Latar tempat & waktu"
          aria-label="Latar tempat dan waktu"
          value={setting}
          onChange={(e) => updateAttributes({ setting: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  );
}

export function ImageBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const src = String(node.attrs.src ?? '');
  const alt = String(node.attrs.alt ?? '');
  const caption = String(node.attrs.caption ?? '');
  const width = String(node.attrs.width ?? 'normal');

  const handleUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    setImgError(false);
    try {
      const publicUrl = await uploadCoverImageFile(file);
      updateAttributes({
        src: publicUrl,
        alt: alt || file.name.replace(/\.[^/.]+$/, ''),
      });
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-image${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="studio-block-bar">
        <span className="studio-block-kind">
          <ImageIcon size={12} /> Gambar
        </span>
        <label className="studio-cue-btn studio-block-upload-label" title="Upload gambar dari perangkat">
          <ImagePlus size={12} />
          <span>{uploading ? '…' : 'Upload'}</span>
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={uploading}
            onChange={(e) => void handleUploadImage(e)}
          />
        </label>
        <input
          type="text"
          className="studio-block-inline-input"
          placeholder="URL gambar (/asset/preview.jpg atau https://...)"
          aria-label="URL gambar"
          value={src}
          onChange={(e) => {
            setImgError(false);
            setUploadErr(null);
            updateAttributes({ src: e.target.value });
          }}
        />
        <select
          className="studio-block-inline-select"
          aria-label="Lebar gambar"
          value={width}
          onChange={(e) => updateAttributes({ width: e.target.value })}
        >
          <option value="normal">Normal</option>
          <option value="wide">Lebar</option>
          <option value="full">Penuh</option>
        </select>
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus gambar"
          aria-label="Hapus blok gambar"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {uploadErr && <p className="studio-inline-error">{uploadErr}</p>}
      <div className={`studio-image-preview width-${width}`}>
        {src && !imgError ? (
          <img
            src={src}
            alt={alt || caption || 'Ilustrasi novel'}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="studio-image-fallback">
            <ImageIcon size={24} />
            <span>
              {src
                ? 'Gambar tidak dapat dimuat. Periksa URL atau upload file baru.'
                : 'Klik Upload atau masukkan URL gambar di atas.'}
            </span>
          </div>
        )}
        <input
          type="text"
          className="studio-image-caption-input"
          placeholder="Tambahkan keterangan gambar (opsional)"
          aria-label="Keterangan gambar"
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  );
}

export function CustomNarrativeBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const variant = String(node.attrs.variant ?? 'flashback') as NarrativeVariant;
  const label = String(node.attrs.label ?? 'Flashback');

  return (
    <NodeViewWrapper
      className={`studio-block studio-block-narrative variant-${variant}${selected ? ' is-selected' : ''}`}
    >
      <div className="studio-block-bar" contentEditable={false}>
        <span className="studio-block-kind">Blok Naratif</span>
        <select
          className="studio-block-inline-select"
          aria-label="Tipe blok naratif"
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
        >
          <option value="flashback">Flashback</option>
          <option value="chat">Chat Log</option>
          <option value="letter">Surat / Memo</option>
          <option value="timestamp">Penanda Waktu</option>
          <option value="note">Catatan Narator</option>
        </select>
        <input
          type="text"
          className="studio-block-inline-input"
          placeholder="Label blok (mis. Flashback — SMA)"
          aria-label="Label blok naratif"
          value={label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
        />
        <button
          type="button"
          className="studio-block-remove"
          title="Hapus blok naratif"
          aria-label="Hapus blok naratif"
          onClick={deleteNode}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="studio-narrative-body">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}

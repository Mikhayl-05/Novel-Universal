import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookPlus,
  CheckCircle2,
  ImagePlus,
  Keyboard,
  Link as LinkIcon,
  Settings,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { WorkType } from '../../types/novel';
import { uploadCoverImageFile } from '../services/studioRepository';
import type {
  ConflictPayload,
  DocumentMetrics,
  NovelStatus,
  StudioChapter,
  StudioNovel,
} from '../types/studio';
import { validateChapterForPublish } from '../utils/novelContentCodec';

const WORK_TYPE_OPTIONS: ReadonlyArray<{
  value: WorkType;
  label: string;
  desc: string;
}> = [
  { value: 'novel', label: 'Novel', desc: 'Karya berseri dengan banyak bab' },
  { value: 'cerpen', label: 'Cerpen', desc: 'Cerita pendek utuh' },
  { value: 'notes', label: 'Notes', desc: 'Catatan, esai, atau refleksi' },
];

export function ConflictBanner({
  conflict,
  onUseServer,
  onKeepMine,
  onDismiss,
}: {
  conflict: ConflictPayload;
  onUseServer: () => Promise<void>;
  onKeepMine: () => Promise<unknown>;
  onDismiss: () => void;
}) {
  return (
    <div className="studio-conflict-banner" role="alert">
      <div className="studio-conflict-info">
        <AlertTriangle size={16} />
        <span>
          <strong>Konflik Sinkronisasi Terdeteksi:</strong> Versi server (v
          {conflict.serverVersion}) lebih baru daripada dasar edit Anda (v
          {conflict.localVersion}). Pilih tindakan agar tidak ada naskah yang
          hilang.
        </span>
      </div>
      <div className="studio-conflict-actions">
        <button
          type="button"
          className="studio-btn studio-btn-secondary studio-btn-sm"
          onClick={() => void onUseServer()}
        >
          Muat Versi Server
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => void onKeepMine()}
        >
          Pertahankan Versi Saya
        </button>
        <button
          type="button"
          className="studio-icon-btn"
          aria-label="Tutup peringatan konflik"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function PublishModal({
  open,
  chapter,
  publishing,
  onConfirmPublish,
  onClose,
}: {
  open: boolean;
  chapter: StudioChapter | null;
  publishing: boolean;
  onConfirmPublish: () => Promise<void>;
  onClose: () => void;
}) {
  if (!open || !chapter) return null;
  const validation = validateChapterForPublish(chapter);

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pub-modal-title"
    >
      <div className="studio-modal-card studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="pub-modal-title">
            <UploadCloud size={18} /> Publikasikan ke Reader Publik
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="studio-modal-body">
          <p className="studio-modal-lead">
            <strong>
              {chapter.num} — {chapter.title}
            </strong>
          </p>
          <p className="studio-modal-sub">
            Tindakan ini akan menyalin isi draft, metadata, musik latar (
            <code>{chapter.draftBgmUrl ? 'Musik Upload Kustom' : chapter.draftBgm}</code>),
            dan VFX (<code>{chapter.draftEffect}</code>) ke snapshot publik{' '}
            <code>chapter_publications</code> secara atomik. Editan draft Anda setelah
            ini tidak akan mengubah tampilan pembaca hingga Anda menekan Publikasikan lagi.
          </p>

          {!validation.valid ? (
            <div className="studio-auth-notice error">
              <AlertTriangle size={16} />
              <div>
                <strong>Validasi Publikasi Gagal:</strong>
                <ul className="studio-modal-err-list">
                  {validation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="studio-auth-notice ok">
              <CheckCircle2 size={16} />
              <span>
                Naskah valid dan siap dipublikasikan ke semua pembaca publik.
              </span>
            </div>
          )}
        </div>

        <div className="studio-modal-foot">
          <button
            type="button"
            className="studio-btn studio-btn-secondary"
            onClick={onClose}
            disabled={publishing}
          >
            Batal
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            disabled={!validation.valid || publishing}
            onClick={() => void onConfirmPublish()}
          >
            <UploadCloud size={15} />
            <span>{publishing ? 'Memublikasikan…' : 'Konfirmasi & Publikasikan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteChapterModal({
  chapter,
  deleting,
  onConfirmDelete,
  onClose,
}: {
  chapter: StudioChapter | null;
  deleting: boolean;
  onConfirmDelete: (chapter: StudioChapter) => Promise<void>;
  onClose: () => void;
}) {
  if (!chapter) return null;

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-modal-title"
    >
      <div className="studio-modal-card studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="del-modal-title">
            <Trash2 size={18} /> Hapus Bagian Permanen?
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="studio-modal-body">
          <p className="studio-modal-sub">
            Anda akan menghapus{' '}
            <strong>
              {chapter.num} — {chapter.title}
            </strong>{' '}
            beserta seluruh riwayat revisi dan snapshot publikasinya. Jika hanya
            ingin menyembunyikan dari editor dan pembaca, gunakan{' '}
            <strong>Arsipkan</strong>.
          </p>
        </div>
        <div className="studio-modal-foot">
          <button
            type="button"
            className="studio-btn studio-btn-secondary"
            onClick={onClose}
            disabled={deleting}
          >
            Batal
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-danger"
            disabled={deleting}
            onClick={() => void onConfirmDelete(chapter)}
          >
            <Trash2 size={15} />
            <span>{deleting ? 'Menghapus…' : 'Hapus Permanen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewWorkModal({
  open,
  busy,
  onCreateWork,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  onCreateWork: (input: {
    title: string;
    subtitle: string;
    authorName: string;
    synopsis: string;
    workType: WorkType;
    coverImageUrl: string | null;
    status: NovelStatus;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [workType, setWorkType] = useState<WorkType>('novel');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [status, setStatus] = useState<NovelStatus>('published');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverErr, setCoverErr] = useState<string | null>(null);

  if (!open) return null;

  const handleCoverFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCover(true);
    setCoverErr(null);
    try {
      const publicUrl = await uploadCoverImageFile(file);
      setCoverImageUrl(publicUrl);
    } catch (err) {
      setCoverErr(err instanceof Error ? err.message : 'Gagal mengunggah sampul.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateWork({
      title,
      subtitle,
      authorName,
      synopsis,
      workType,
      coverImageUrl: coverImageUrl.trim() || null,
      status,
    });
    setWorkType('novel');
    setTitle('');
    setSubtitle('');
    setAuthorName('');
    setSynopsis('');
    setCoverImageUrl('');
    setStatus('published');
    setCoverErr(null);
  };

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="novel-modal-title"
    >
      <div className="studio-modal-card studio-modal-scroll studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="novel-modal-title">
            <BookPlus size={18} /> Buat Karya Baru
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="studio-modal-body studio-modal-form">
            <div className="studio-field">
              <label>Jenis Karya</label>
              <div className="studio-type-grid" role="radiogroup" aria-label="Jenis karya">
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={workType === opt.value}
                    className={`studio-type-btn${workType === opt.value ? ' is-active' : ''}`}
                    onClick={() => setWorkType(opt.value)}
                  >
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-field">
              <label htmlFor="new-novel-title">Judul Karya</label>
              <input
                id="new-novel-title"
                type="text"
                required
                placeholder="Mis. Senja di Stasiun Gambir"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="new-novel-subtitle">Subjudul</label>
              <input
                id="new-novel-subtitle"
                type="text"
                placeholder="Subjudul atau tagline karya (opsional)"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="new-novel-author">Nama Penulis</label>
              <input
                id="new-novel-author"
                type="text"
                placeholder="Nama penulis"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="new-novel-synopsis">Sinopsis Singkat</label>
              <textarea
                id="new-novel-synopsis"
                rows={3}
                placeholder="Ringkasan yang akan muncul di kartu Beranda…"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label>Sampul Karya (Opsional)</label>
              <div className="studio-cover-picker">
                {coverImageUrl && (
                  <img
                    src={coverImageUrl}
                    alt="Pratinjau sampul"
                    className="studio-cover-thumb"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="studio-cover-controls">
                  <label className="studio-btn studio-btn-secondary studio-btn-sm studio-file-label">
                    <ImagePlus size={14} />
                    <span>{uploadingCover ? 'Mengunggah…' : 'Upload Gambar Sampul'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingCover}
                      onChange={(e) => void handleCoverFile(e)}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="Atau tempel URL gambar (https://...)"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                  />
                </div>
              </div>
              {coverErr && <p className="studio-inline-error">{coverErr}</p>}
            </div>

            <div className="studio-field">
              <label htmlFor="new-novel-status">Visibilitas di Beranda</label>
              <select
                id="new-novel-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as NovelStatus)}
              >
                <option value="published">Terbit di Beranda (Publik setelah bab terbit)</option>
                <option value="draft">Draft (Sembunyikan dari Beranda)</option>
              </select>
            </div>
          </div>

          <div className="studio-modal-foot">
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={busy || uploadingCover || !title.trim()}
            >
              {busy ? 'Membuat…' : 'Buat Karya'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WorkSettingsModal({
  open,
  novel,
  busy,
  onSaveWork,
  onDeleteWork,
  onClose,
}: {
  open: boolean;
  novel: StudioNovel | null;
  busy: boolean;
  onSaveWork: (
    novelId: string,
    patch: {
      title: string;
      subtitle: string;
      authorName: string;
      synopsis: string;
      workType: WorkType;
      coverImageUrl: string | null;
      status: NovelStatus;
    },
  ) => Promise<void>;
  onDeleteWork: (novel: StudioNovel) => Promise<void>;
  onClose: () => void;
}) {
  const [workType, setWorkType] = useState<WorkType>('novel');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [status, setStatus] = useState<NovelStatus>('published');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverErr, setCoverErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !novel) return;
    setWorkType(novel.workType);
    setTitle(novel.title);
    setSubtitle(novel.subtitle);
    setAuthorName(novel.authorName);
    setSynopsis(novel.synopsis);
    setCoverImageUrl(novel.coverImageUrl ?? '');
    setStatus(novel.status);
    setCoverErr(null);
    setConfirmDelete(false);
  }, [open, novel]);

  if (!open || !novel) return null;

  const handleCoverFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCover(true);
    setCoverErr(null);
    try {
      const publicUrl = await uploadCoverImageFile(file);
      setCoverImageUrl(publicUrl);
    } catch (err) {
      setCoverErr(err instanceof Error ? err.message : 'Gagal mengunggah sampul.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSaveWork(novel.id, {
      title,
      subtitle,
      authorName,
      synopsis,
      workType,
      coverImageUrl: coverImageUrl.trim() || null,
      status,
    });
  };

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-settings-title"
    >
      <div className="studio-modal-card studio-modal-scroll studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="work-settings-title">
            <Settings size={18} /> Pengaturan Karya
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="studio-modal-body studio-modal-form">
            <div className="studio-field">
              <label>Jenis Karya</label>
              <div className="studio-type-grid" role="radiogroup" aria-label="Jenis karya">
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={workType === opt.value}
                    className={`studio-type-btn${workType === opt.value ? ' is-active' : ''}`}
                    onClick={() => setWorkType(opt.value)}
                  >
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-field">
              <label htmlFor="edit-work-title">Judul Karya</label>
              <input
                id="edit-work-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="edit-work-subtitle">Subjudul</label>
              <input
                id="edit-work-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="edit-work-author">Nama Penulis</label>
              <input
                id="edit-work-author"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="edit-work-synopsis">Sinopsis</label>
              <textarea
                id="edit-work-synopsis"
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label>Sampul Karya</label>
              <div className="studio-cover-picker">
                {coverImageUrl && (
                  <img
                    src={coverImageUrl}
                    alt="Sampul karya"
                    className="studio-cover-thumb"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="studio-cover-controls">
                  <div className="studio-ins-btn-row">
                    <label className="studio-btn studio-btn-secondary studio-btn-sm studio-file-label">
                      <ImagePlus size={14} />
                      <span>{uploadingCover ? 'Mengunggah…' : 'Ganti Sampul'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={uploadingCover}
                        onChange={(e) => void handleCoverFile(e)}
                      />
                    </label>
                    {coverImageUrl && (
                      <button
                        type="button"
                        className="studio-btn studio-btn-secondary studio-btn-sm"
                        onClick={() => setCoverImageUrl('')}
                      >
                        Hapus Sampul
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="Atau URL gambar (https://...)"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                  />
                </div>
              </div>
              {coverErr && <p className="studio-inline-error">{coverErr}</p>}
            </div>

            <div className="studio-field">
              <label htmlFor="edit-work-status">Status Beranda</label>
              <select
                id="edit-work-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as NovelStatus)}
              >
                <option value="published">Terbit di Beranda</option>
                <option value="draft">Draft (Tersembunyi)</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </div>

            <div className="studio-danger-zone">
              <div>
                <strong>Hapus Karya Permanen</strong>
                <p>Menghapus seluruh bab, revisi, dan publikasi milik karya ini.</p>
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="studio-btn studio-btn-secondary studio-btn-sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  <span>Hapus Karya</span>
                </button>
              ) : (
                <div className="studio-ins-btn-row">
                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-danger studio-btn-sm"
                    disabled={busy}
                    onClick={() => void onDeleteWork(novel)}
                  >
                    <Trash2 size={14} />
                    <span>{busy ? 'Menghapus…' : 'Ya, Hapus Permanen'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="studio-modal-foot">
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Tutup
            </button>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={busy || uploadingCover || !title.trim()}
            >
              {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InsertLinkModal({
  open,
  initialHref,
  onApplyLink,
  onRemoveLink,
  onClose,
}: {
  open: boolean;
  initialHref: string;
  onApplyLink: (href: string) => void;
  onRemoveLink: () => void;
  onClose: () => void;
}) {
  const [href, setHref] = useState(initialHref);

  useEffect(() => {
    if (open) setHref(initialHref);
  }, [open, initialHref]);

  if (!open) return null;

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-modal-title"
    >
      <div className="studio-modal-card studio-modal-sm studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="link-modal-title">
            <LinkIcon size={17} /> Sisipkan / Edit Tautan
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (href.trim()) onApplyLink(href.trim());
          }}
        >
          <div className="studio-modal-body">
            <div className="studio-field">
              <label htmlFor="studio-link-href">URL Tujuan</label>
              <input
                id="studio-link-href"
                type="url"
                autoFocus
                placeholder="https://..."
                value={href}
                onChange={(e) => setHref(e.target.value)}
              />
            </div>
          </div>
          <div className="studio-modal-foot">
            {initialHref && (
              <button
                type="button"
                className="studio-btn studio-btn-secondary"
                onClick={onRemoveLink}
              >
                Hapus Link
              </button>
            )}
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button type="submit" className="studio-btn studio-btn-primary">
              Terapkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WordCountModal({
  open,
  metrics,
  onClose,
}: {
  open: boolean;
  metrics: DocumentMetrics;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wc-modal-title"
    >
      <div className="studio-modal-card studio-modal-sm studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="wc-modal-title">Statistik Dokumen Ini</h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="studio-modal-body">
          <dl className="studio-stats-grid">
            <div>
              <dt>Jumlah Kata</dt>
              <dd className="tabular-nums">{metrics.wordCount.toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt>Jumlah Halaman</dt>
              <dd className="tabular-nums">{metrics.pageCount.toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt>Karakter (dengan spasi)</dt>
              <dd className="tabular-nums">
                {metrics.characterCount.toLocaleString('id-ID')}
              </dd>
            </div>
            <div>
              <dt>Karakter (tanpa spasi)</dt>
              <dd className="tabular-nums">
                {metrics.characterCountNoSpaces.toLocaleString('id-ID')}
              </dd>
            </div>
            <div>
              <dt>Paragraf &amp; Monolog</dt>
              <dd className="tabular-nums">
                {metrics.paragraphCount.toLocaleString('id-ID')}
              </dd>
            </div>
            <div>
              <dt>Blok Dialog</dt>
              <dd className="tabular-nums">{metrics.dialogueCount.toLocaleString('id-ID')}</dd>
            </div>
          </dl>
        </div>
        <div className="studio-modal-foot">
          <button type="button" className="studio-btn studio-btn-primary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const rows: Array<[string, string]> = [
    ['/ (Garis Miring)', 'Buka menu cepat sisipkan Dialog, Blok, Gambar, atau Format'],
    ['Ctrl / Cmd + Z', 'Undo'],
    ['Ctrl / Cmd + Y atau Shift+Z', 'Redo'],
    ['Ctrl / Cmd + B', 'Tebal (Bold)'],
    ['Ctrl / Cmd + I', 'Miring (Italic)'],
    ['Ctrl / Cmd + U', 'Garis Bawah (Underline)'],
    ['Ctrl / Cmd + Shift + X', 'Coret (Strikethrough)'],
    ['Ctrl / Cmd + K', 'Sisipkan / Edit Tautan'],
    ['Ctrl / Cmd + A', 'Pilih Semua Isi Bagian'],
    ['Ctrl / Cmd + S', 'Simpan Draft Sekarang'],
    ['Ctrl / Cmd + Enter', 'Sisipkan Page Break'],
  ];

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sc-modal-title"
    >
      <div className="studio-modal-card studio-allow-select">
        <div className="studio-modal-head">
          <h2 id="sc-modal-title">
            <Keyboard size={18} /> Pintasan Keyboard Novel Studio
          </h2>
          <button type="button" className="studio-icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="studio-modal-body">
          <table className="studio-shortcuts-table">
            <tbody>
              {rows.map(([keys, desc]) => (
                <tr key={keys}>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="studio-modal-foot">
          <button type="button" className="studio-btn studio-btn-primary" onClick={onClose}>
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

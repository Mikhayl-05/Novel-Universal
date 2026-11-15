import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Archive,
  CheckCircle2,
  FolderOpen,
  History,
  ImagePlus,
  Music,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { audioMap } from '../../data/audioMap';
import { audioManager } from '../../services/audioManager';
import type { BgmKey, VfxKey } from '../../types/novel';
import { BGM_OPTIONS, VFX_OPTIONS } from '../editor/NovelBlockViews';
import {
  createChapterRevision,
  deleteNovelAsset,
  fetchChapterRevisions,
  fetchNovelAssets,
  registerNovelAsset,
  uploadNovelAssetFile,
} from '../services/studioRepository';
import type {
  MarginPreset,
  StudioChapter,
  StudioChapterAsset,
  StudioChapterRevision,
  VfxTriggerMode,
} from '../types/studio';
import { hasUnpublishedChanges } from '../utils/chapterOrdering';

interface StudioInspectorPanelProps {
  novelId: string | null;
  chapter: StudioChapter | null;
  marginPreset: MarginPreset;
  onChangeMarginPreset: (preset: MarginPreset) => void;
  onUpdateChapterPatch: (patch: Partial<StudioChapter>) => void;
  onRestoreRevision: (rev: StudioChapterRevision) => void;
  onOpenPublishModal: () => void;
  onToggleArchive: (chapter: StudioChapter) => void;
  onInsertAssetToEditor: (asset: StudioChapterAsset) => void;
}

export function StudioInspectorPanel({
  novelId,
  chapter,
  marginPreset,
  onChangeMarginPreset,
  onUpdateChapterPatch,
  onRestoreRevision,
  onOpenPublishModal,
  onToggleArchive,
  onInsertAssetToEditor,
}: StudioInspectorPanelProps) {
  const [tab, setTab] = useState<'meta' | 'audio' | 'history'>('meta');
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const [revisions, setRevisions] = useState<StudioChapterRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const [assets, setAssets] = useState<StudioChapterAsset[]>([]);
  const [assetLabel, setAssetLabel] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetType, setAssetType] = useState<'image' | 'sfx' | 'audio'>('image');
  const [assetBusy, setAssetBusy] = useState(false);
  const [bgmUploading, setBgmUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setPreviewPlaying(false);
    audioManager.stopPreview();
  }, [chapter?.id]);

  useEffect(() => {
    if (!chapter?.id || tab !== 'history') return;
    let cancelled = false;
    setRevisionsLoading(true);
    void fetchChapterRevisions(chapter.id)
      .then((list) => {
        if (!cancelled) setRevisions(list);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      })
      .finally(() => {
        if (!cancelled) setRevisionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapter?.id, tab]);

  // Load assets whenever novelId changes (used by both Audio BGM selector and Riwayat/Aset tab)
  useEffect(() => {
    if (!novelId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    void fetchNovelAssets(novelId)
      .then((list) => {
        if (!cancelled) setAssets(list);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [novelId]);

  if (!chapter) {
    return (
      <aside className="studio-inspector" aria-label="Panel inspektur">
        <div className="studio-inspector-empty">Pilih bab atau bagian untuk melihat properti.</div>
      </aside>
    );
  }

  const audioAssets = assets.filter((a) => a.assetType === 'audio');

  const toggleBgmPreview = () => {
    if (previewPlaying) {
      audioManager.stopPreview();
      setPreviewPlaying(false);
      return;
    }
    const targetUrl =
      chapter.draftBgmUrl ||
      (chapter.draftBgm === 'default'
        ? audioMap.default[0]
        : audioMap[chapter.draftBgm]);
    if (targetUrl) {
      audioManager.playPreview(
        targetUrl,
        chapter.draftBgmVolume,
        chapter.draftBgmLoop,
      );
      setPreviewPlaying(true);
    }
  };

  const handleUploadBgmAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !novelId) return;
    setBgmUploading(true);
    setUploadError(null);
    try {
      const created = await uploadNovelAssetFile({
        novelId,
        chapterId: chapter.id,
        assetType: 'audio',
        file,
      });
      setAssets((prev) => [created, ...prev]);
      onUpdateChapterPatch({ draftBgmUrl: created.url });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal mengunggah file audio.',
      );
    } finally {
      setBgmUploading(false);
    }
  };

  const handleUploadGeneralAsset = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !novelId) return;
    setAssetBusy(true);
    setUploadError(null);
    try {
      const created = await uploadNovelAssetFile({
        novelId,
        chapterId: chapter.id,
        assetType,
        file,
        label: assetLabel.trim() || undefined,
      });
      setAssets((prev) => [created, ...prev]);
      setAssetLabel('');
      if (assetType === 'audio') {
        onUpdateChapterPatch({ draftBgmUrl: created.url });
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal mengunggah aset file.',
      );
    } finally {
      setAssetBusy(false);
    }
  };

  const handleSaveManualSnapshot = async () => {
    const created = await createChapterRevision(chapter, 'manual');
    setRevisions((prev) => [created, ...prev]);
  };

  const handleAddAsset = async (e: FormEvent) => {
    e.preventDefault();
    if (!novelId || !assetLabel.trim() || !assetUrl.trim()) return;
    setAssetBusy(true);
    setUploadError(null);
    try {
      const created = await registerNovelAsset({
        novelId,
        chapterId: chapter.id,
        assetType,
        label: assetLabel,
        url: assetUrl,
      });
      setAssets((prev) => [created, ...prev]);
      setAssetLabel('');
      setAssetUrl('');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal mendaftarkan aset.',
      );
    } finally {
      setAssetBusy(false);
    }
  };

  const handleDeleteAsset = async (asset: StudioChapterAsset) => {
    await deleteNovelAsset(asset);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    if (chapter.draftBgmUrl === asset.url) {
      onUpdateChapterPatch({ draftBgmUrl: null });
    }
  };

  const dirtyVsPublished = hasUnpublishedChanges(chapter);
  const activeUploadedAudio = audioAssets.find((a) => a.url === chapter.draftBgmUrl);

  return (
    <aside className="studio-inspector studio-allow-select" aria-label="Panel inspektur bab">
      <div className="studio-inspector-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'meta'}
          className={`studio-ins-tab${tab === 'meta' ? ' is-active' : ''}`}
          onClick={() => setTab('meta')}
        >
          <Sliders size={13} />
          <span>Metadata</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'audio'}
          className={`studio-ins-tab${tab === 'audio' ? ' is-active' : ''}`}
          onClick={() => setTab('audio')}
        >
          <Music size={13} />
          <span>Audio &amp; VFX</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`studio-ins-tab${tab === 'history' ? ' is-active' : ''}`}
          onClick={() => setTab('history')}
        >
          <History size={13} />
          <span>Aset &amp; Versi</span>
        </button>
      </div>

      <div className="studio-inspector-body">
        {tab === 'meta' && (
          <div className="studio-ins-section">
            <div className="studio-ins-pub-card">
              <div className="studio-ins-pub-row">
                <span className="studio-ins-label">Status Publikasi</span>
                <span className={`studio-status-label status-${chapter.status}`}>
                  {chapter.status === 'published'
                    ? 'Terpublikasi'
                    : chapter.status === 'archived'
                      ? 'Diarsipkan'
                      : 'Draft'}
                </span>
              </div>
              {chapter.publishedAt && (
                <p className="studio-ins-subtext">
                  Terakhir publish:{' '}
                  {new Date(chapter.publishedAt).toLocaleString('id-ID')} (v
                  {chapter.publishedVersion})
                </p>
              )}
              {dirtyVsPublished && (
                <p className="studio-ins-warn">
                  Ada perubahan draft yang belum dipublikasikan ke Reader.
                </p>
              )}
              <div className="studio-ins-btn-row">
                <button
                  type="button"
                  className="studio-btn studio-btn-primary studio-btn-sm"
                  onClick={onOpenPublishModal}
                >
                  <UploadCloud size={14} />
                  <span>Publikasikan</span>
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-secondary studio-btn-sm"
                  onClick={() => onToggleArchive(chapter)}
                >
                  <Archive size={14} />
                  <span>{chapter.status === 'archived' ? 'Pulihkan' : 'Arsipkan'}</span>
                </button>
              </div>
            </div>

            <div className="studio-field">
              <label htmlFor="ins-num">Nomor / Label Bagian</label>
              <input
                id="ins-num"
                type="text"
                value={chapter.num}
                onChange={(e) => onUpdateChapterPatch({ num: e.target.value })}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="ins-title">Judul Bagian / Bab</label>
              <input
                id="ins-title"
                type="text"
                value={chapter.title}
                onChange={(e) => onUpdateChapterPatch({ title: e.target.value })}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="ins-setting">Latar Tempat &amp; Waktu</label>
              <input
                id="ins-setting"
                type="text"
                value={chapter.setting}
                onChange={(e) => onUpdateChapterPatch({ setting: e.target.value })}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="ins-feeling">Suasana (Feeling Badge)</label>
              <input
                id="ins-feeling"
                type="text"
                placeholder="Mis. Hangat, Hening, Melankolis"
                value={chapter.feeling}
                onChange={(e) => onUpdateChapterPatch({ feeling: e.target.value })}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="ins-margin">Margin Halaman Editor</label>
              <select
                id="ins-margin"
                value={marginPreset}
                onChange={(e) => onChangeMarginPreset(e.target.value as MarginPreset)}
              >
                <option value="narrow">Sempit (Narrow)</option>
                <option value="normal">Normal (Standar)</option>
                <option value="wide">Lebar (Wide)</option>
              </select>
            </div>

            <div className="studio-ins-checks">
              <label className="studio-check-row">
                <input
                  type="checkbox"
                  checked={chapter.isPrologue}
                  onChange={(e) =>
                    onUpdateChapterPatch({ isPrologue: e.target.checked })
                  }
                />
                <span>Tandai sebagai Prolog (tanpa dropcap)</span>
              </label>

              <label className="studio-check-row">
                <input
                  type="checkbox"
                  checked={chapter.isEnding}
                  onChange={(e) =>
                    onUpdateChapterPatch({ isEnding: e.target.checked })
                  }
                />
                <span>Tandai sebagai Bagian Akhir (Ending Cinematic)</span>
              </label>
            </div>

            <div className="studio-ins-tech-meta">
              <div>
                <span>Chapter UUID</span>
                <code>{chapter.id}</code>
              </div>
              <div>
                <span>Draft Version</span>
                <code>v{chapter.draftVersion}</code>
              </div>
            </div>
          </div>
        )}

        {tab === 'audio' && (
          <div className="studio-ins-section">
            <h3 className="studio-ins-heading">
              <Music size={14} /> Musik Latar (BGM)
            </h3>

            <div className="studio-upload-box">
              <label className="studio-btn studio-btn-primary studio-btn-sm studio-file-label">
                <Upload size={13} />
                <span>{bgmUploading ? 'Mengunggah Audio…' : 'Upload Musik (.mp3 / .ogg)'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={bgmUploading || !novelId}
                  onChange={(e) => void handleUploadBgmAudio(e)}
                />
              </label>
              <p className="studio-ins-subtext">
                Audio akan tersimpan di cloud dan otomatis dipilih untuk bab ini.
              </p>
              {uploadError && <p className="studio-inline-error">{uploadError}</p>}
            </div>

            {audioAssets.length > 0 && (
              <div className="studio-field">
                <label htmlFor="ins-bgm-custom">Musik Upload di Karya Ini</label>
                <select
                  id="ins-bgm-custom"
                  value={chapter.draftBgmUrl ?? ''}
                  onChange={(e) =>
                    onUpdateChapterPatch({
                      draftBgmUrl: e.target.value || null,
                    })
                  }
                >
                  <option value="">— Gunakan Preset Bawaan —</option>
                  {audioAssets.map((a) => (
                    <option key={a.id} value={a.url}>
                      🎵 {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {chapter.draftBgmUrl && (
              <div className="studio-custom-bgm-banner">
                <span>
                  Aktif: <strong>{activeUploadedAudio?.label || 'Musik Upload Kustom'}</strong>
                </span>
                <button
                  type="button"
                  className="studio-btn studio-btn-secondary studio-btn-xs"
                  onClick={() => onUpdateChapterPatch({ draftBgmUrl: null })}
                >
                  Reset ke Preset
                </button>
              </div>
            )}

            <div className="studio-field">
              <label htmlFor="ins-bgm">Preset BGM Bawaan</label>
              <select
                id="ins-bgm"
                value={chapter.draftBgm}
                onChange={(e) =>
                  onUpdateChapterPatch({
                    draftBgm: e.target.value as BgmKey,
                    draftBgmUrl: null,
                  })
                }
              >
                {BGM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="studio-audio-preview-row">
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                onClick={toggleBgmPreview}
              >
                {previewPlaying ? <Square size={13} /> : <Play size={13} />}
                <span>{previewPlaying ? 'Hentikan Audio' : 'Pratinjau BGM'}</span>
              </button>

              <label className="studio-check-row">
                <input
                  type="checkbox"
                  checked={chapter.draftBgmLoop}
                  onChange={(e) =>
                    onUpdateChapterPatch({ draftBgmLoop: e.target.checked })
                  }
                />
                <span>Loop terus</span>
              </label>
            </div>

            <div className="studio-field">
              <label htmlFor="ins-bgm-vol">
                Volume BGM ({Math.round(chapter.draftBgmVolume * 100)}%)
              </label>
              <input
                id="ins-bgm-vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={chapter.draftBgmVolume}
                onChange={(e) =>
                  onUpdateChapterPatch({
                    draftBgmVolume: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="studio-ins-divider" />

            <h3 className="studio-ins-heading">
              <Sparkles size={14} /> Efek Visual (VFX)
            </h3>

            <div className="studio-field">
              <label htmlFor="ins-vfx">Pilih Efek Visual</label>
              <select
                id="ins-vfx"
                value={chapter.draftEffect}
                onChange={(e) =>
                  onUpdateChapterPatch({ draftEffect: e.target.value as VfxKey })
                }
              >
                {VFX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="studio-field">
              <label htmlFor="ins-vfx-trig">Pemicu Efek di Reader</label>
              <select
                id="ins-vfx-trig"
                value={chapter.draftVfxTrigger}
                onChange={(e) =>
                  onUpdateChapterPatch({
                    draftVfxTrigger: e.target.value as VfxTriggerMode,
                  })
                }
              >
                <option value="scroll_40">Aktif saat scroll 40% halaman</option>
                <option value="immediate">Aktif segera saat halaman dibuka</option>
                <option value="none">Nonaktif / Manual</option>
              </select>
            </div>

            <div className="studio-field">
              <label htmlFor="ins-vfx-dur">Durasi Efek (ms)</label>
              <input
                id="ins-vfx-dur"
                type="number"
                min={3000}
                max={120000}
                step={1000}
                value={chapter.draftVfxDurationMs}
                onChange={(e) =>
                  onUpdateChapterPatch({
                    draftVfxDurationMs: Math.max(
                      3000,
                      Number(e.target.value) || 25000,
                    ),
                  })
                }
              />
            </div>

            <button
              type="button"
              className="studio-btn studio-btn-secondary studio-btn-sm"
              disabled={chapter.draftEffect === 'none'}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('studio:test-vfx', {
                    detail: {
                      effect: chapter.draftEffect,
                      durationMs: chapter.draftVfxDurationMs,
                    },
                  }),
                );
              }}
            >
              <Sparkles size={13} />
              <span>Uji Efek Visual</span>
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div className="studio-ins-section">
            <div className="studio-ins-head-row">
              <h3 className="studio-ins-heading">
                <History size={14} /> Riwayat Revisi
              </h3>
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-xs"
                onClick={() => void handleSaveManualSnapshot()}
              >
                <Save size={12} />
                <span>Simpan Snapshot</span>
              </button>
            </div>

            {revisionsLoading ? (
              <p className="studio-ins-subtext">Memuat riwayat revisi…</p>
            ) : revisions.length === 0 ? (
              <p className="studio-ins-subtext">
                Belum ada snapshot revisi tersimpan untuk bagian ini.
              </p>
            ) : (
              <ul className="studio-revision-list">
                {revisions.map((rev) => (
                  <li key={rev.id} className="studio-revision-item">
                    <div className="studio-revision-top">
                      <span className="studio-rev-num">
                        #{rev.revisionNumber} · {rev.revisionKind}
                      </span>
                      <span className="studio-rev-time">
                        {new Date(rev.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="studio-revision-title">
                      {rev.num} — {rev.title}
                    </div>
                    <button
                      type="button"
                      className="studio-btn studio-btn-secondary studio-btn-xs"
                      onClick={() => onRestoreRevision(rev)}
                    >
                      <RotateCcw size={12} />
                      <span>Pulihkan Versi Ini</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="studio-ins-divider" />

            <h3 className="studio-ins-heading">
              <FolderOpen size={14} /> Upload &amp; Aset Media Karya
            </h3>

            <form className="studio-asset-form" onSubmit={(e) => void handleAddAsset(e)}>
              <select
                aria-label="Jenis aset"
                value={assetType}
                onChange={(e) =>
                  setAssetType(e.target.value as 'image' | 'sfx' | 'audio')
                }
              >
                <option value="image">Gambar Ilustrasi</option>
                <option value="audio">Musik Latar (BGM)</option>
                <option value="sfx">Efek Suara (SFX)</option>
              </select>
              <input
                type="text"
                placeholder="Label aset (opsional saat upload file)"
                aria-label="Label aset"
                value={assetLabel}
                onChange={(e) => setAssetLabel(e.target.value)}
              />

              <label className="studio-btn studio-btn-primary studio-btn-sm studio-file-label">
                <Upload size={13} />
                <span>{assetBusy ? 'Mengunggah…' : 'Upload File dari Perangkat'}</span>
                <input
                  type="file"
                  accept={assetType === 'image' ? 'image/*' : 'audio/*'}
                  hidden
                  disabled={assetBusy || !novelId}
                  onChange={(e) => void handleUploadGeneralAsset(e)}
                />
              </label>

              <input
                type="text"
                placeholder="Atau URL eksternal (https://...)"
                aria-label="URL aset"
                value={assetUrl}
                onChange={(e) => setAssetUrl(e.target.value)}
              />
              <button
                type="submit"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                disabled={assetBusy || !assetLabel.trim() || !assetUrl.trim()}
              >
                <ImagePlus size={13} />
                <span>Daftarkan dari URL</span>
              </button>
              {uploadError && <p className="studio-inline-error">{uploadError}</p>}
            </form>

            {assets.length > 0 && (
              <ul className="studio-asset-list">
                {assets.map((asset) => (
                  <li key={asset.id} className="studio-asset-item">
                    <div className="studio-asset-info">
                      <strong>{asset.label}</strong>
                      <span>
                        {asset.assetType} · {asset.url}
                      </span>
                    </div>
                    <div className="studio-asset-btns">
                      {asset.assetType === 'audio' ? (
                        <button
                          type="button"
                          className="studio-mini-btn"
                          title="Jadikan BGM bab ini"
                          aria-label={`Jadikan ${asset.label} sebagai BGM`}
                          onClick={() => {
                            onUpdateChapterPatch({ draftBgmUrl: asset.url });
                          }}
                        >
                          <Music size={12} />
                        </button>
                      ) : (
                        (asset.assetType === 'image' ||
                          asset.assetType === 'sfx') && (
                          <button
                            type="button"
                            className="studio-mini-btn"
                            title="Sisipkan ke naskah"
                            aria-label={`Sisipkan ${asset.label}`}
                            onClick={() => onInsertAssetToEditor(asset)}
                          >
                            <CheckCircle2 size={12} />
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="studio-mini-btn danger"
                        title="Hapus aset"
                        aria-label={`Hapus ${asset.label}`}
                        onClick={() => void handleDeleteAsset(asset)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  FolderPlus,
  Loader2,
  LogOut,
  Moon,
  PenLine,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import type { WorkType } from '../../types/novel';
import type { NovelStatus, StudioNovelSummary } from '../types/studio';

interface StudioHubViewProps {
  works: StudioNovelSummary[];
  loading: boolean;
  userEmail?: string | null;
  studioTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSignOut: () => void;
  onOpenNewWork: () => void;
  onOpenWork: (work: StudioNovelSummary) => void;
  onOpenWorkSettings: (work: StudioNovelSummary) => void;
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  novel: 'Novel',
  cerpen: 'Cerpen',
  notes: 'Notes',
};

const STATUS_LABELS: Record<NovelStatus, string> = {
  published: 'Terbit',
  draft: 'Draft',
  archived: 'Diarsipkan',
};

function formatShortDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function StudioHubView({
  works,
  loading,
  userEmail,
  studioTheme,
  onToggleTheme,
  onSignOut,
  onOpenNewWork,
  onOpenWork,
  onOpenWorkSettings,
}: StudioHubViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | WorkType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NovelStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWorks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return works.filter((w) => {
      if (typeFilter !== 'all' && w.workType !== typeFilter) return false;
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.synopsis.toLowerCase().includes(q) ||
        w.authorName.toLowerCase().includes(q)
      );
    });
  }, [works, typeFilter, statusFilter, searchQuery]);

  const countByType = useMemo(() => {
    return {
      all: works.length,
      novel: works.filter((w) => w.workType === 'novel').length,
      cerpen: works.filter((w) => w.workType === 'cerpen').length,
      notes: works.filter((w) => w.workType === 'notes').length,
    };
  }, [works]);

  return (
    <div className={`studio-root studio-allow-select studio-theme-${studioTheme}`}>
      <header className="studio-header studio-hub-header">
        <div className="studio-header-left">
          <div className="studio-brand-mark" aria-hidden="true">
            <span>✦</span>
          </div>
          <div className="studio-doc-heading">
            <div className="studio-doc-title-row">
              <span className="studio-app-name">Ruang Karya Studio</span>
              <span className="studio-sep-dot" aria-hidden="true">
                ·
              </span>
              <span className="studio-doc-active-name">Beranda Penulis</span>
            </div>
            {userEmail && <div className="studio-save-status">{userEmail}</div>}
          </div>
        </div>

        <div className="studio-header-right">
          <button
            type="button"
            className="studio-btn studio-btn-secondary studio-btn-sm"
            aria-label={
              studioTheme === 'dark'
                ? 'Beralih ke Mode Terang'
                : 'Beralih ke Mode Gelap'
            }
            onClick={onToggleTheme}
          >
            {studioTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span className="studio-hide-xs">
              {studioTheme === 'dark' ? 'Terang' : 'Gelap'}
            </span>
          </button>

          <button
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={onOpenNewWork}
          >
            <FolderPlus size={14} />
            <span>Karya Baru</span>
          </button>

          <button
            type="button"
            className="studio-btn studio-btn-secondary studio-btn-sm"
            aria-label="Keluar dari Studio Editor"
            onClick={onSignOut}
          >
            <LogOut size={14} />
            <span className="studio-hide-xs">Keluar</span>
          </button>
        </div>
      </header>

      <main className="studio-hub-main">
        <div className="studio-hub-container">
          <section className="studio-hub-intro">
            <div>
              <p className="studio-hub-eyebrow">Meja Naskah Pribadi</p>
              <h1 className="studio-hub-title">Pilih Proyek atau Mulai Karya Baru</h1>
            </div>
            <p className="studio-hub-lead">
              Kelola Novel berseri, Cerpen utuh, dan Notes dalam satu ruang kerja.
              Pilih proyek untuk langsung melanjutkan bab terakhir yang dikerjakan.
            </p>
          </section>

          <section className="studio-hub-controls" aria-label="Filter daftar karya">
            <div className="studio-hub-type-tabs" role="tablist" aria-label="Filter jenis karya">
              {(
                [
                  { id: 'all', label: `Semua (${countByType.all})` },
                  { id: 'novel', label: `Novel (${countByType.novel})` },
                  { id: 'cerpen', label: `Cerpen (${countByType.cerpen})` },
                  { id: 'notes', label: `Notes (${countByType.notes})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === tab.id}
                  className={`studio-hub-tab tabular-nums${
                    typeFilter === tab.id ? ' is-active' : ''
                  }`}
                  onClick={() => setTypeFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="studio-hub-right-filters">
              <div className="studio-hub-search">
                <Search size={14} />
                <input
                  type="search"
                  aria-label="Cari karya"
                  placeholder="Cari judul atau sinopsis…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="studio-hub-status-select"
                aria-label="Filter status karya"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | NovelStatus)
                }
              >
                <option value="all">Semua Status</option>
                <option value="published">Terbit</option>
                <option value="draft">Draft</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </div>
          </section>

          {loading ? (
            <div className="studio-loading-pane">
              <Loader2 size={22} className="studio-spin" />
              <span>Memuat daftar proyek dari Supabase…</span>
            </div>
          ) : works.length === 0 ? (
            <div className="studio-hub-empty">
              <span className="studio-hub-empty-ornament">✦</span>
              <h2>Belum Ada Proyek Karya</h2>
              <p>
                Mulai tulisan pertama Anda—bisa berupa Novel berseri, Cerpen utuh,
                atau Notes catatan pribadi.
              </p>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={onOpenNewWork}
              >
                <FolderPlus size={15} />
                <span>Buat Karya Pertama</span>
              </button>
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="studio-hub-empty">
              <h2>Tidak Ada Karya yang Cocok</h2>
              <p>Coba ubah kata kunci pencarian atau filter status karya.</p>
              <button
                type="button"
                className="studio-btn studio-btn-secondary"
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <section className="studio-hub-grid" aria-label="Daftar proyek karya">
              {filteredWorks.map((work) => {
                const updatedLabel = formatShortDate(work.lastActivityAt);
                const isReadablePublicly =
                  work.status === 'published' && work.publishedCount > 0;

                return (
                  <article key={work.id} className="studio-hub-card">
                    <div className="studio-hub-card-top">
                      <button
                        type="button"
                        className="studio-hub-cover-btn"
                        aria-label={`Buka ${work.title}`}
                        onClick={() => onOpenWork(work)}
                      >
                        {work.coverImageUrl ? (
                          <img
                            src={work.coverImageUrl}
                            alt={`Sampul ${work.title}`}
                            className="studio-hub-cover-img"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="studio-hub-cover-fallback" aria-hidden="true">
                            <span>{work.title.slice(0, 1).toUpperCase()}</span>
                          </div>
                        )}
                      </button>

                      <div className="studio-hub-card-info">
                        <p className="studio-hub-card-meta tabular-nums">
                          <span>{WORK_TYPE_LABELS[work.workType]}</span>
                          <span>·</span>
                          <span className={`studio-hub-status status-${work.status}`}>
                            {STATUS_LABELS[work.status]}
                          </span>
                          <span>·</span>
                          <span>{work.chapterCount} bagian</span>
                        </p>

                        <h2 className="studio-hub-card-title">
                          <button
                            type="button"
                            className="studio-hub-title-btn"
                            onClick={() => onOpenWork(work)}
                          >
                            {work.title}
                          </button>
                        </h2>

                        {work.subtitle && (
                          <p className="studio-hub-card-subtitle">{work.subtitle}</p>
                        )}

                        <p className="studio-hub-card-activity tabular-nums">
                          {work.latestChapterTitle ? (
                            <>
                              Terakhir: <strong>{work.latestChapterNum}</strong> —{' '}
                              {work.latestChapterTitle}
                            </>
                          ) : (
                            'Belum ada bagian/bab ditulis'
                          )}
                          {updatedLabel ? ` · ${updatedLabel}` : ''}
                        </p>
                      </div>
                    </div>

                    {work.synopsis && (
                      <p className="studio-hub-card-synopsis">{work.synopsis}</p>
                    )}

                    <div className="studio-hub-card-actions">
                      <button
                        type="button"
                        className="studio-btn studio-btn-primary studio-hub-action-primary"
                        onClick={() => onOpenWork(work)}
                      >
                        <PenLine size={14} />
                        <span>
                          {work.chapterCount > 0 ? 'Lanjut Tulis' : 'Mulai Tulis'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="studio-btn studio-btn-secondary studio-hub-action-sec"
                        onClick={() => onOpenWorkSettings(work)}
                      >
                        <Settings size={14} />
                        <span>Pengaturan</span>
                      </button>

                      {isReadablePublicly && (
                        <Link
                          to={`/read/${work.slug}`}
                          className="studio-btn studio-btn-secondary studio-hub-action-sec"
                          title="Buka di Reader Publik"
                        >
                          <BookOpen size={14} />
                          <span>Baca</span>
                          <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

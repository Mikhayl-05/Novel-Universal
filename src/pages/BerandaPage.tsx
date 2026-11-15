import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Moon, Search, Sun, X } from 'lucide-react';
import { usePublishedWorksFeed } from '../hooks/usePublishedNovelFeed';
import { audioManager } from '../services/audioManager';
import {
  loadGlobalReaderPreferences,
  saveThemePreference,
} from '../services/storageService';
import type { PublishedWork, ThemeMode, WorkType } from '../types/novel';

type FilterTab = 'all' | WorkType;

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  novel: 'Novel',
  cerpen: 'Cerpen',
  notes: 'Notes',
};

const FILTER_TABS: ReadonlyArray<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'novel', label: 'Novel' },
  { key: 'cerpen', label: 'Cerpen' },
  { key: 'notes', label: 'Notes' },
];

function formatUpdatedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function WorkCardCover({ work }: { work: PublishedWork }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [work.coverImageUrl]);

  if (work.coverImageUrl && !imgError) {
    return (
      <img
        src={work.coverImageUrl}
        alt={`Sampul ${work.title}`}
        className="beranda-card-cover-img"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="beranda-cover-fallback" aria-hidden="true">
      <span className="beranda-cover-type">{WORK_TYPE_LABELS[work.workType]}</span>
      <span className="beranda-cover-title">{work.title}</span>
      <div className="beranda-cover-ornament">
        <span>{work.authorName || 'Ruang Karya'}</span>
        <span>✦</span>
      </div>
    </div>
  );
}

export function BerandaPage() {
  const { works, loading, error, isSupabaseConfigured, reload } =
    usePublishedWorksFeed();

  const [theme, setTheme] = useState<ThemeMode>(
    () => loadGlobalReaderPreferences().theme,
  );
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.body.classList.remove('studio-mode', 'focus-mode', 'focus-ui-visible');
    document.title = 'Ruang Karya — Rak Novel, Cerpen & Catatan';
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      saveThemePreference(next);
      return next;
    });
  };

  const counts = useMemo(() => {
    return {
      all: works.length,
      novel: works.filter((w) => w.workType === 'novel').length,
      cerpen: works.filter((w) => w.workType === 'cerpen').length,
      notes: works.filter((w) => w.workType === 'notes').length,
    };
  }, [works]);

  const filteredWorks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return works.filter((w) => {
      if (activeFilter !== 'all' && w.workType !== activeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.synopsis.toLowerCase().includes(q) ||
        w.authorName.toLowerCase().includes(q)
      );
    });
  }, [works, activeFilter, searchQuery]);

  const handleWarmAudio = (work: PublishedWork) => {
    audioManager.preloadChapterBgm({
      bgm: work.firstChapterBgm ?? work.defaultBgm,
      bgmUrl: work.firstChapterBgmUrl,
    });
  };

  const handleCardClick = (work: PublishedWork) => {
    audioManager.unlock();
    handleWarmAudio(work);
  };

  return (
    <div className="beranda-shell">
      <header className="beranda-topbar">
        <div className="beranda-topbar-inner">
          <Link to="/" className="beranda-brand">
            <span className="beranda-brand-ornament" aria-hidden="true">
              ✦
            </span>
            <span>Ruang Karya</span>
          </Link>

          <nav className="beranda-top-nav" aria-label="Filter kategori karya">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`beranda-nav-tab${activeFilter === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="beranda-top-actions">
            <button
              type="button"
              className="beranda-theme-btn"
              title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              aria-label={
                theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'
              }
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="beranda-main">
        <section className="beranda-hero">
          <div className="beranda-hero-copy">
            <p className="beranda-eyebrow">Pustaka Digital Pribadi</p>
            <h1 className="beranda-hero-title">Rak Cerita, Novel &amp; Catatan</h1>
            <p className="beranda-hero-desc">
              Baca karya pilihan lengkap dengan musik latar, efek suasana, dan ruang
              catatan pribadi per bagian.
            </p>
          </div>

          <div className="beranda-search-wrap">
            <Search size={16} className="beranda-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="beranda-search-input"
              placeholder="Cari judul, penulis, sinopsis…"
              aria-label="Cari karya"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim() !== '' && (
              <button
                type="button"
                className="beranda-search-clear"
                aria-label="Bersihkan pencarian"
                onClick={() => setSearchQuery('')}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </section>

        <section className="beranda-filter-bar" aria-label="Pilih jenis karya">
          <div className="beranda-filter-tabs">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`beranda-filter-btn${
                  activeFilter === tab.key ? ' is-active' : ''
                }`}
                onClick={() => setActiveFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="beranda-filter-count tabular-nums">
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          <span className="beranda-summary-meta tabular-nums">
            Menampilkan {filteredWorks.length} dari {works.length} karya
          </span>
        </section>

        {!isSupabaseConfigured ? (
          <div className="beranda-state-card">
            <span className="beranda-state-ornament">✦</span>
            <h2>Rak Karya Sedang Disiapkan</h2>
            <p>
              Pustaka digital ini belum terhubung ke database penerbitan. Silakan
              kunjungi kembali nanti saat koleksi karya sudah tersedia.
            </p>
          </div>
        ) : loading ? (
          <div className="beranda-grid" aria-busy="true" aria-label="Memuat karya">
            <div className="beranda-card-skeleton" />
            <div className="beranda-card-skeleton" />
            <div className="beranda-card-skeleton" />
          </div>
        ) : error ? (
          <div className="beranda-state-card">
            <span className="beranda-state-ornament">✦</span>
            <h2>Gagal Memuat Rak Karya</h2>
            <p>{error}</p>
            <div className="beranda-state-actions">
              <button
                type="button"
                className="beranda-primary-btn"
                onClick={reload}
              >
                Coba Muat Ulang
              </button>
            </div>
          </div>
        ) : works.length === 0 ? (
          <div className="beranda-state-card">
            <span className="beranda-state-ornament">✦</span>
            <h2>Rak Karya Masih Kosong</h2>
            <p>
              Belum ada Novel, Cerpen, atau Notes yang dipublikasikan saat ini.
              Kembali lagi nanti untuk membaca karya terbaru.
            </p>
          </div>
        ) : filteredWorks.length === 0 ? (
          <div className="beranda-state-card">
            <span className="beranda-state-ornament">✦</span>
            <h2>Karya Tidak Ditemukan</h2>
            <p>
              Tidak ada karya yang cocok dengan filter atau pencarian saat ini.
            </p>
            <div className="beranda-state-actions">
              <button
                type="button"
                className="beranda-secondary-btn"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filter &amp; Pencarian
              </button>
            </div>
          </div>
        ) : (
          <div className="beranda-grid">
            {filteredWorks.map((work) => {
              const countText =
                work.workType === 'novel'
                  ? `${work.publishedChapterCount} Bab`
                  : work.publishedChapterCount > 1
                    ? `${work.publishedChapterCount} Bagian`
                    : work.publishedChapterCount === 1
                      ? 'Terbit'
                      : 'Belum ada bab publik';

              const dateLabel = formatUpdatedDate(work.updatedAt);
              const metaSegments = [
                WORK_TYPE_LABELS[work.workType],
                countText,
                dateLabel,
              ].filter(Boolean);

              return (
                <Link
                  key={work.id}
                  to={`/read/${work.slug}`}
                  className="beranda-card"
                  onMouseEnter={() => handleWarmAudio(work)}
                  onFocus={() => handleWarmAudio(work)}
                  onClick={() => handleCardClick(work)}
                >
                  <div className="beranda-card-cover-wrap">
                    <WorkCardCover work={work} />
                  </div>

                  <div className="beranda-card-body">
                    <div className="beranda-card-meta tabular-nums">
                      {metaSegments.join(' · ')}
                    </div>
                    <h2 className="beranda-card-title">{work.title}</h2>
                    {work.subtitle && (
                      <p className="beranda-card-subtitle">{work.subtitle}</p>
                    )}
                    {work.synopsis && (
                      <p className="beranda-card-synopsis">{work.synopsis}</p>
                    )}

                    <div className="beranda-card-footer">
                      <span className="beranda-card-author">
                        {work.authorName ? `Oleh ${work.authorName}` : 'Karya Original'}
                      </span>
                      <span className="beranda-card-cta">
                        <span>
                          {work.workType === 'notes' ? 'Buka Catatan' : 'Baca Sekarang'}
                        </span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="beranda-footer">
        <span>Ruang Karya Digital</span>
      </footer>
    </div>
  );
}

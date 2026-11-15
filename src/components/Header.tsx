import { Link } from 'react-router-dom';
import type { ThemeMode } from '../types/novel';

interface HeaderProps {
  title: string;
  theme: ThemeMode;
  showDrawerToggle?: boolean;
  onBrandClick: () => void;
  onToggleDrawer: () => void;
  onToggleSettings: () => void;
  onToggleTheme: () => void;
  onOpenNotes: () => void;
  onToggleFocusMode: () => void;
}

export function Header({
  title,
  theme,
  showDrawerToggle = true,
  onBrandClick,
  onToggleDrawer,
  onToggleSettings,
  onToggleTheme,
  onOpenNotes,
  onToggleFocusMode,
}: HeaderProps) {
  return (
    <header>
      <div className="header-container">
        <div className="header-left-group">
          <Link
            to="/"
            className="header-back-home"
            title="Kembali ke Beranda"
            aria-label="Kembali ke Beranda"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="header-back-label">Beranda</span>
          </Link>

          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              onBrandClick();
            }}
          >
            {title}
          </a>
        </div>

        <div className="controls-right">
          {showDrawerToggle && (
            <button
              type="button"
              className="control-btn"
              id="menu-btn"
              title="Daftar Isi"
              aria-label="Daftar Isi"
              onClick={onToggleDrawer}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="control-btn"
            id="font-btn"
            title="Ukuran Huruf"
            aria-label="Ukuran Huruf"
            onClick={onToggleSettings}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </button>

          <button
            type="button"
            className="control-btn"
            id="theme-btn"
            title="Ganti Tema"
            aria-label="Ganti Tema"
            onClick={onToggleTheme}
          >
            <svg
              className="sun-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: theme === 'dark' ? 'block' : 'none' }}
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg
              className="moon-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: theme === 'dark' ? 'none' : 'block' }}
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          <button
            type="button"
            className="control-btn"
            id="notes-btn"
            title="Catatan Pribadi"
            aria-label="Catatan Pribadi untuk bagian ini"
            onClick={onOpenNotes}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          <button
            type="button"
            className="control-btn"
            id="focus-mode-btn"
            title="Focus Mode"
            aria-label="Aktifkan atau matikan Focus Mode"
            onClick={onToggleFocusMode}
          >
            <svg
              className="focus-icon-inactive"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
            <svg
              className="focus-icon-active"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

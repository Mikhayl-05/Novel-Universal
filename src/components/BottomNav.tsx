import { Link } from 'react-router-dom';

interface BottomNavProps {
  currentIndex: number;
  totalChapters: number;
  onPrev: () => void;
  onNext: () => void;
}

export function BottomNav({
  currentIndex,
  totalChapters,
  onPrev,
  onNext,
}: BottomNavProps) {
  if (totalChapters <= 1) {
    return (
      <nav className="bottom-nav">
        <div className="bottom-container">
          <Link to="/" className="nav-btn">
            ← Beranda
          </Link>
          <span className="progress-indicator-text tabular-nums">
            1 / 1
          </span>
          <span style={{ width: 80 }} />
        </div>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav">
      <div className="bottom-container">
        <button
          type="button"
          className="nav-btn"
          id="prev-btn"
          disabled={currentIndex <= 0}
          onClick={onPrev}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ verticalAlign: 'middle' }}
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Prev
        </button>

        <span className="progress-indicator-text tabular-nums" id="progress-indicator">
          {currentIndex + 1} / {totalChapters}
        </span>

        <button
          type="button"
          className="nav-btn"
          id="next-btn"
          disabled={currentIndex >= totalChapters - 1}
          onClick={onNext}
        >
          Next
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ verticalAlign: 'middle' }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

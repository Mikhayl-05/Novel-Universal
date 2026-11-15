interface SettingsPanelProps {
  visible: boolean;
  fontScale: number;
  reduceMotion: boolean;
  canInstallPwa: boolean;
  onAdjustFontSize: (dir: -1 | 1) => void;
  onToggleReduceMotion: (checked: boolean) => void;
  onQuickFocusMode: () => void;
  onQuickNotes: () => void;
  onInstallPwa: () => void;
}

export function SettingsPanel({
  visible,
  fontScale,
  reduceMotion,
  canInstallPwa,
  onAdjustFontSize,
  onToggleReduceMotion,
  onQuickFocusMode,
  onQuickNotes,
  onInstallPwa,
}: SettingsPanelProps) {
  return (
    <div
      className={`settings-panel${visible ? ' visible' : ''}`}
      id="settings-panel"
    >
      <div className="settings-row">
        <span className="settings-label">Ukuran Huruf:</span>
        <div className="settings-row-controls">
          <button
            type="button"
            className="font-size-btn"
            onClick={() => onAdjustFontSize(-1)}
          >
            A-
          </button>
          <span
            id="font-size-val"
            style={{ fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            {fontScale}%
          </span>
          <button
            type="button"
            className="font-size-btn"
            onClick={() => onAdjustFontSize(1)}
          >
            A+
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Reduce Motion:</span>
        <label className="settings-toggle">
          <input
            type="checkbox"
            id="reduce-motion-toggle"
            aria-label="Aktifkan Reduce Motion"
            checked={reduceMotion}
            onChange={(e) => onToggleReduceMotion(e.target.checked)}
          />
          <span className="settings-toggle-slider" />
        </label>
      </div>

      <div className="settings-row settings-quick-actions">
        <span className="settings-label">Quick Actions:</span>
        <div className="quick-action-buttons">
          <button
            type="button"
            className="quick-action-btn"
            id="qa-focus-mode"
            title="Focus Mode"
            aria-label="Toggle Focus Mode"
            onClick={onQuickFocusMode}
          >
            🎯
          </button>
          <button
            type="button"
            className="quick-action-btn"
            id="qa-notes"
            title="Catatan"
            aria-label="Buka Catatan"
            onClick={onQuickNotes}
          >
            📝
          </button>
        </div>
      </div>

      <div
        className="settings-row"
        id="pwa-install-row"
        style={{ display: canInstallPwa ? 'block' : 'none' }}
      >
        <button
          type="button"
          className="install-app-btn"
          id="install-app-btn"
          onClick={onInstallPwa}
        >
          📲 Pasang Reader ke Home Screen
        </button>
      </div>
    </div>
  );
}

interface UpdateBannerProps {
  visible: boolean;
  onReload: () => void;
}

export function UpdateBanner({ visible, onReload }: UpdateBannerProps) {
  return (
    <div
      className={`update-banner${visible ? ' show' : ''}`}
      id="update-banner"
    >
      <span>Versi baru reader tersedia.</span>
      <button type="button" id="update-reload-btn" onClick={onReload}>
        Muat Ulang
      </button>
    </div>
  );
}

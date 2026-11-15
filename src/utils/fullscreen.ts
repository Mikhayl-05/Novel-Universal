interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

export const FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
] as const;

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function enterFullscreen(): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement as FullscreenElement;
  const req =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (!req) return;
  try {
    const result = req.call(el);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch {
    // Graceful fallback — Focus Mode continues without browser fullscreen
  }
}

export function exitFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (!isFullscreenActive()) return;
  const doc = document as FullscreenDocument;
  const exit =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;
  if (!exit) return;
  try {
    const result = exit.call(doc);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch {
    // Graceful fallback
  }
}

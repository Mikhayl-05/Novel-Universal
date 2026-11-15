import { useEffect, type RefObject } from 'react';
import { audioManager } from '../services/audioManager';
import type { BgmKey, VfxKey } from '../types/novel';

interface UseReaderCuesOptions {
  containerRef: RefObject<HTMLElement | null>;
  contentKey: string;
  enabled?: boolean;
  scrollRootRef?: RefObject<HTMLElement | null>;
  onTriggerVfx?: (effect: VfxKey, durationMs: number) => void;
}

function executeSfxCue(el: HTMLElement) {
  const url = el.dataset.sfxUrl?.trim();
  if (!url) return;
  const vol = Number(el.dataset.volume ?? 0.7);
  audioManager.playSfx(url, Number.isFinite(vol) ? vol : 0.7);
}

function executeVfxCue(
  el: HTMLElement,
  onTriggerVfx?: (effect: VfxKey, durationMs: number) => void,
) {
  const effect = (el.dataset.vfxEffect || 'none') as VfxKey;
  if (!effect || effect === 'none') return;
  const durationMs = Number(el.dataset.vfxDuration ?? 25000);
  const safeDuration = Number.isFinite(durationMs) && durationMs >= 1000 ? durationMs : 25000;
  if (onTriggerVfx) {
    onTriggerVfx(effect, safeDuration);
    return;
  }
  window.dispatchEvent(
    new CustomEvent('reader:vfx-cue', {
      detail: { effect, durationMs: safeDuration },
    }),
  );
}

function executeBgmCue(el: HTMLElement) {
  const bgmKey = (el.dataset.bgmKey || 'default') as BgmKey;
  const action = (el.dataset.bgmAction || 'play').toLowerCase();
  const volume = Number(el.dataset.bgmVolume ?? 0.42);
  const loop = el.dataset.bgmLoop !== 'false';

  if (action === 'stop') {
    audioManager.stop();
    return;
  }
  if (action === 'pause') {
    audioManager.pause();
    return;
  }
  if (action === 'fadeout') {
    audioManager.fadeOut();
    return;
  }

  audioManager.play(bgmKey, {
    volume: Number.isFinite(volume) ? volume : 0.42,
    loop,
    restart: action === 'play',
  });
}

/**
 * Observes inline SFX, VFX, and BGM cue markers rendered inside a chapter's prose
 * and executes each cue once when entering view (or immediately / on chapter_end).
 */
export function useReaderCues({
  containerRef,
  contentKey,
  enabled = true,
  scrollRootRef,
  onTriggerVfx,
}: UseReaderCuesOptions) {
  useEffect(() => {
    if (!enabled) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const triggeredSet = new WeakSet<Element>();
    const cues = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.novel-sfx-cue, .novel-vfx-cue, .novel-bgm-cue',
      ),
    );
    if (cues.length === 0) return undefined;

    const triggerCue = (el: HTMLElement) => {
      if (triggeredSet.has(el)) return;
      triggeredSet.add(el);
      if (el.classList.contains('novel-sfx-cue')) {
        executeSfxCue(el);
      } else if (el.classList.contains('novel-vfx-cue')) {
        executeVfxCue(el, onTriggerVfx);
      } else if (el.classList.contains('novel-bgm-cue')) {
        executeBgmCue(el);
      }
    };

    const scrollTriggerCues: HTMLElement[] = [];
    const endTriggerCues: HTMLElement[] = [];

    for (const el of cues) {
      if (el.classList.contains('novel-sfx-cue')) {
        const trig = el.dataset.trigger || 'scroll';
        if (trig === 'manual') continue;
        if (trig === 'enter') {
          triggerCue(el);
          continue;
        }
        scrollTriggerCues.push(el);
      } else if (el.classList.contains('novel-vfx-cue')) {
        const trig = el.dataset.vfxTrigger || 'scroll';
        if (trig === 'immediate') {
          triggerCue(el);
          continue;
        }
        if (trig === 'chapter_end') {
          endTriggerCues.push(el);
          continue;
        }
        scrollTriggerCues.push(el);
      } else if (el.classList.contains('novel-bgm-cue')) {
        scrollTriggerCues.push(el);
      }
    }

    const scrollRootEl = scrollRootRef?.current ?? null;
    let observer: IntersectionObserver | null = null;

    if (scrollTriggerCues.length > 0 && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement;
              triggerCue(target);
              observer?.unobserve(target);
            }
          }
        },
        {
          root: scrollRootEl,
          threshold: 0.01,
          rootMargin: '0px 0px -12% 0px',
        },
      );
      for (const el of scrollTriggerCues) {
        observer.observe(el);
      }
    }

    const handleScrollForEnd = () => {
      if (endTriggerCues.length === 0) return;
      const scrolled = scrollRootEl
        ? scrollRootEl.scrollTop
        : window.scrollY || window.pageYOffset;
      const maxScroll = scrollRootEl
        ? scrollRootEl.scrollHeight - scrollRootEl.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll > 0 ? scrolled / maxScroll : 1;
      if (ratio >= 0.85) {
        for (const el of endTriggerCues) {
          triggerCue(el);
        }
      }
    };

    if (endTriggerCues.length > 0) {
      if (scrollRootEl) {
        scrollRootEl.addEventListener('scroll', handleScrollForEnd, { passive: true });
      } else {
        window.addEventListener('scroll', handleScrollForEnd, { passive: true });
      }
      // Also fire if the page isn't tall enough to scroll
      const rafCheck = requestAnimationFrame(handleScrollForEnd);
      return () => {
        cancelAnimationFrame(rafCheck);
        observer?.disconnect();
        if (scrollRootEl) {
          scrollRootEl.removeEventListener('scroll', handleScrollForEnd);
        } else {
          window.removeEventListener('scroll', handleScrollForEnd);
        }
      };
    }

    return () => {
      observer?.disconnect();
    };
  }, [containerRef, contentKey, enabled, onTriggerVfx, scrollRootRef]);
}

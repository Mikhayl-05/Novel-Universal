import { audioMap, getAudioSrcForKey } from '../data/audioMap';
import type { BgmKey } from '../types/novel';

type MuteListener = (isMuted: boolean) => void;

export interface PlayBgmOptions {
  bgmUrl?: string | null;
  volume?: number;
  loop?: boolean;
  restart?: boolean;
}

interface PendingIntent {
  key: BgmKey;
  options?: PlayBgmOptions;
}

/**
 * Dual-Deck Zero-Delay Audio Engine
 * --------------------------------------------------------------------------
 * - Maintains 2 independent HTMLAudioElement decks for gapless crossfades.
 * - Maintains an in-memory preload pool (`preloadPool`) so incoming chapters
 *   and pages already have buffered audio ready to start at t = 0ms.
 * - Preserves estafet continuity: if the resolved track URL/key matches what
 *   is already playing, playback continues uninterrupted across page/chapter jumps.
 */
class AudioManagerService {
  private decks: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private activeDeckIdx: 0 | 1 = 0;
  private previewAudio: HTMLAudioElement | null = null;

  private currentSourceId: string | null = null;
  private currentKey: BgmKey | null = null;
  private defPlaylist: string[] = [];
  private defIdx = 0;

  private crossfadeRaf: number | null = null;
  private crossfadeTimer: ReturnType<typeof setInterval> | null = null;
  private muteListeners = new Set<MuteListener>();
  private preloadPool = new Map<string, HTMLAudioElement>();

  private initialized = false;
  private unlocked = false;
  private pendingIntent: PendingIntent | null = null;
  private activeTargetVol = 0.42;
  private activeLoop = true;

  public isMuted = false;
  public readonly TARGET_VOL = 0.42;

  private configureDeck(deck: HTMLAudioElement, idx: 0 | 1): HTMLAudioElement {
    deck.preload = 'auto';
    deck.volume = 0;
    deck.addEventListener('ended', () => {
      if (this.activeDeckIdx !== idx) return;
      if (!this.activeLoop) return;

      if (this.currentSourceId === 'key:default' && this.defPlaylist.length > 0) {
        this.defIdx = (this.defIdx + 1) % this.defPlaylist.length;
        const nextSrc = this.defPlaylist[this.defIdx];
        if (!nextSrc) return;
        deck.src = nextSrc;
        deck.currentTime = 0;
        deck.volume = this.isMuted ? 0 : this.activeTargetVol;
        deck.play().catch(() => {});
      } else {
        deck.currentTime = 0;
        deck.volume = this.isMuted ? 0 : this.activeTargetVol;
        deck.play().catch(() => {});
      }
    });
    return deck;
  }

  public init(): void {
    if (this.initialized || typeof Audio === 'undefined') return;
    this.initialized = true;
    this.buildDefaultPlaylist();
    this.decks = [
      this.configureDeck(new Audio(), 0),
      this.configureDeck(new Audio(), 1),
    ];

    // Preload initial built-in default track right away for zero-delay entry
    if (this.defPlaylist[0]) {
      this.preloadTrack(this.defPlaylist[0]);
    }
  }

  public buildDefaultPlaylist(shuffleTail = true): string[] {
    const [first, ...rest] = [...audioMap.default];
    if (shuffleTail) {
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
    }
    this.defPlaylist = [first, ...rest].filter(Boolean);
    this.defIdx = 0;
    return this.defPlaylist;
  }

  public getCurrentKey(): BgmKey | null {
    return this.currentKey;
  }

  /**
   * Resolves a chapter's effective audio URL & identity key.
   */
  public resolveTrack(
    key?: BgmKey | null,
    bgmUrl?: string | null,
  ): { sourceId: string; src: string; resolvedKey: BgmKey } {
    const cleanUrl = typeof bgmUrl === 'string' ? bgmUrl.trim() : '';
    if (cleanUrl) {
      return {
        sourceId: `url:${cleanUrl}`,
        src: cleanUrl,
        resolvedKey: key || 'default',
      };
    }

    const k: BgmKey = key || 'default';
    if (k === 'default') {
      const src = this.defPlaylist[this.defIdx] ?? audioMap.default[0] ?? '';
      return {
        sourceId: 'key:default',
        src,
        resolvedKey: 'default',
      };
    }

    return {
      sourceId: `key:${k}`,
      src: getAudioSrcForKey(k),
      resolvedKey: k,
    };
  }

  /**
   * Warms a track in memory + browser cache so transitions start immediately.
   */
  public preloadTrack(srcOrKey?: string | null): void {
    if (typeof Audio === 'undefined' || !srcOrKey) return;
    this.init();

    const src =
      srcOrKey === 'default'
        ? (this.defPlaylist[this.defIdx] ?? audioMap.default[0] ?? '')
        : srcOrKey in audioMap
          ? getAudioSrcForKey(srcOrKey as BgmKey)
          : srcOrKey.trim();

    if (!src || this.preloadPool.has(src)) return;

    // Limit pool size cleanly to avoid unbounded memory
    if (this.preloadPool.size > 16) {
      const oldestKey = this.preloadPool.keys().next().value;
      if (oldestKey) {
        const oldEl = this.preloadPool.get(oldestKey);
        if (oldEl) {
          oldEl.src = '';
        }
        this.preloadPool.delete(oldestKey);
      }
    }

    const preloader = new Audio();
    preloader.preload = 'auto';
    preloader.src = src;
    preloader.load();
    this.preloadPool.set(src, preloader);
  }

  public preloadChapterBgm(chapter?: { bgm?: BgmKey; bgmUrl?: string | null } | null): void {
    if (!chapter) return;
    this.init();
    const { src } = this.resolveTrack(chapter.bgm, chapter.bgmUrl);
    if (src) this.preloadTrack(src);
  }

  /**
   * Called inside user gesture handlers (e.g. clicking a work card on Beranda)
   * so browsers authorize immediate unblocked audio playback on navigation.
   */
  public unlock(): void {
    this.init();
    if (this.unlocked || !this.decks) return;
    this.unlocked = true;

    if (this.pendingIntent) {
      const intent = this.pendingIntent;
      this.pendingIntent = null;
      this.play(intent.key, intent.options);
    }
  }

  private clearFadeTimers(): void {
    if (this.crossfadeRaf !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.crossfadeRaf);
      this.crossfadeRaf = null;
    }
    if (this.crossfadeTimer !== null) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
  }

  private crossfadeDecks(
    incoming: HTMLAudioElement,
    outgoing: HTMLAudioElement | null,
    targetVol: number,
    durationMs = 360,
  ): void {
    this.clearFadeTimers();

    if (this.isMuted) {
      incoming.volume = 0;
      if (outgoing && !outgoing.paused) {
        outgoing.volume = 0;
        outgoing.pause();
      }
      return;
    }

    const startOutVol = outgoing && !outgoing.paused ? outgoing.volume : 0;
    const startInVol = incoming.volume;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / Math.max(80, durationMs));
      // Smooth ease-in-out curve
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      incoming.volume = Math.max(0, Math.min(1, startInVol + (targetVol - startInVol) * eased));

      if (outgoing) {
        outgoing.volume = Math.max(0, Math.min(1, startOutVol * (1 - eased)));
      }

      if (t < 1) {
        if (typeof requestAnimationFrame === 'function') {
          this.crossfadeRaf = requestAnimationFrame(step);
        }
      } else {
        this.clearFadeTimers();
        incoming.volume = targetVol;
        if (outgoing) {
          outgoing.volume = 0;
          outgoing.pause();
        }
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this.crossfadeRaf = requestAnimationFrame(step);
    } else {
      incoming.volume = targetVol;
      if (outgoing) {
        outgoing.volume = 0;
        outgoing.pause();
      }
    }
  }

  public play(key?: BgmKey | null, options?: PlayBgmOptions): void {
    this.init();
    if (!this.decks) return;

    const { sourceId, src, resolvedKey } = this.resolveTrack(key, options?.bgmUrl);
    if (!src) return;

    const requestedVol =
      typeof options?.volume === 'number'
        ? Math.max(0, Math.min(1, options.volume))
        : this.TARGET_VOL;
    const requestedLoop =
      typeof options?.loop === 'boolean' ? options.loop : true;

    this.activeTargetVol = requestedVol;
    this.activeLoop = requestedLoop;

    const activeDeck = this.decks[this.activeDeckIdx];

    // Estafet: keep playing uninterrupted when same BGM source is already active
    if (!options?.restart && sourceId === this.currentSourceId && !activeDeck.paused) {
      this.currentKey = resolvedKey;
      this.crossfadeDecks(activeDeck, null, requestedVol, 180);
      return;
    }

    // Also reuse if same physical src URL is already playing (e.g. preset key vs equivalent URL)
    if (
      !options?.restart &&
      activeDeck.src &&
      activeDeck.src.endsWith(src) &&
      !activeDeck.paused
    ) {
      this.currentSourceId = sourceId;
      this.currentKey = resolvedKey;
      this.crossfadeDecks(activeDeck, null, requestedVol, 180);
      return;
    }

    const nextIdx: 0 | 1 = this.activeDeckIdx === 0 ? 1 : 0;
    const incomingDeck = this.decks[nextIdx];
    const outgoingDeck = activeDeck;

    // Ensure preloaded buffer is warm
    this.preloadTrack(src);

    this.currentSourceId = sourceId;
    this.currentKey = resolvedKey;
    this.activeDeckIdx = nextIdx;

    const needsSrcLoad = !incomingDeck.src || !incomingDeck.src.endsWith(src);
    if (needsSrcLoad) {
      incomingDeck.src = src;
    }
    incomingDeck.currentTime = 0;
    incomingDeck.volume = 0;

    // Start incoming deck IMMEDIATELY without waiting for outgoing fadeout (zero-delay crossfade)
    const playPromise = incomingDeck.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.unlocked = true;
          this.pendingIntent = null;
        })
        .catch(() => {
          // If browser blocked autoplay before interaction, queue intent for instant unlock on first gesture
          this.pendingIntent = { key: resolvedKey, options };
        });
    }

    const hasOutgoing = outgoingDeck !== incomingDeck && !outgoingDeck.paused;
    this.crossfadeDecks(incomingDeck, hasOutgoing ? outgoingDeck : null, requestedVol, 380);
  }

  public stop(): void {
    this.pendingIntent = null;
    this.clearFadeTimers();
    if (this.decks) {
      for (const deck of this.decks) {
        deck.pause();
        deck.currentTime = 0;
        deck.volume = 0;
      }
    }
    this.currentSourceId = null;
    this.currentKey = null;
  }

  public playPreview(keyOrUrl: BgmKey | string, volume = 0.5, loop = true): void {
    if (typeof Audio === 'undefined') return;
    this.stopPreview();
    const src =
      keyOrUrl in audioMap || keyOrUrl === 'default'
        ? getAudioSrcForKey(keyOrUrl as BgmKey)
        : keyOrUrl;
    if (!src) return;
    const preview = new Audio(src);
    preview.volume = Math.max(0, Math.min(1, volume));
    preview.loop = loop;
    this.previewAudio = preview;
    preview.play().catch(() => {});
  }

  public stopPreview(): void {
    if (!this.previewAudio) return;
    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewAudio = null;
  }

  public playSfx(url: string, volume = 0.7): void {
    if (typeof Audio === 'undefined' || !url || this.isMuted) return;
    const sfx = new Audio(url);
    sfx.volume = Math.max(0, Math.min(1, volume));
    sfx.play().catch(() => {});
  }

  public toggleMute(): boolean {
    this.init();
    this.isMuted = !this.isMuted;
    const activeDeck = this.decks ? this.decks[this.activeDeckIdx] : null;
    const standbyDeck = this.decks
      ? this.decks[this.activeDeckIdx === 0 ? 1 : 0]
      : null;

    if (this.isMuted) {
      if (standbyDeck && !standbyDeck.paused) standbyDeck.pause();
      if (activeDeck) {
        this.crossfadeDecks(activeDeck, null, 0, 220);
      }
    } else {
      if (activeDeck) {
        if (activeDeck.paused && this.currentSourceId) {
          activeDeck.play().catch(() => {});
        }
        this.crossfadeDecks(activeDeck, null, this.activeTargetVol, 220);
      } else if (this.pendingIntent) {
        const intent = this.pendingIntent;
        this.pendingIntent = null;
        this.play(intent.key, intent.options);
      }
    }

    for (const listener of this.muteListeners) {
      listener(this.isMuted);
    }
    return this.isMuted;
  }

  public subscribeMute(listener: MuteListener): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }
}

export const audioManager = new AudioManagerService();

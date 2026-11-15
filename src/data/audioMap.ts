import type { BgmKey } from '../types/novel';

export interface AudioMapConfig {
  default: readonly string[];
  about_you: string;
  somebody: string;
  robbers: string;
  breathe: string;
  watchsleep: string;
  kota: string;
  cute: string;
}

/**
 * Built-in BGM preset tracks retained from /audio/.
 * Used as default presets in Studio Editor alongside author-uploaded audio tracks.
 */
export const audioMap: AudioMapConfig = {
  default: ['/audio/default_1.mp3', '/audio/default_2.mp3'],
  about_you: '/audio/about_you.mp3',
  somebody: '/audio/somebody.mp3',
  robbers: '/audio/robbers.mp3',
  breathe: '/audio/breathe.mp3',
  watchsleep: '/audio/watchsleep.mp3',
  kota: '/audio/kota.mp3',
  cute: '/audio/cute.mp3',
};

export function getAudioSrcForKey(key: BgmKey): string {
  if (key === 'default') return audioMap.default[0] ?? '';
  return audioMap[key] ?? '';
}

export function getAllPreloadAudioUrls(): string[] {
  return [
    ...audioMap.default,
    audioMap.about_you,
    audioMap.somebody,
    audioMap.robbers,
    audioMap.breathe,
    audioMap.watchsleep,
    audioMap.kota,
    audioMap.cute,
  ].filter(Boolean);
}

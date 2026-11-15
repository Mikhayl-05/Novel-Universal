import { useCallback, useEffect, useState } from 'react';
import {
  clampFontScale,
  hasManualReduceMotionOverride,
  saveFocusModePreference,
  saveFontScalePreference,
  saveReduceMotionPreference,
  saveThemePreference,
} from '../services/storageService';
import type { ThemeMode } from '../types/novel';
import {
  enterFullscreen,
  exitFullscreen,
  FULLSCREEN_CHANGE_EVENTS,
  isFullscreenActive,
} from '../utils/fullscreen';
import { vibrate } from '../utils/haptics';

interface UseReaderSettingsParams {
  initialTheme: ThemeMode;
  initialFontScale: number;
  initialFocusMode: boolean;
  initialReduceMotion: boolean;
  showToast: (message: string) => void;
  showBottomHint: (message: string, duration?: number) => void;
}

export function useReaderSettings({
  initialTheme,
  initialFontScale,
  initialFocusMode,
  initialReduceMotion,
  showToast,
  showBottomHint,
}: UseReaderSettingsParams) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [fontScale, setFontScale] = useState<number>(initialFontScale);
  const [focusMode, setFocusMode] = useState<boolean>(initialFocusMode);
  const [focusUiVisible, setFocusUiVisible] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] =
    useState<boolean>(initialReduceMotion);

  // Sync theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync focus-mode & focus-ui-visible classes on <body>
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode);
    document.body.classList.toggle(
      'focus-ui-visible',
      focusMode && focusUiVisible,
    );
  }, [focusMode, focusUiVisible]);

  // Sync reduce-motion class on <body>
  useEffect(() => {
    document.body.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  // Sync Focus Mode when exiting browser fullscreen externally (Esc / Android back)
  useEffect(() => {
    const syncFocusModeWithFullscreen = () => {
      if (!isFullscreenActive() && focusMode) {
        setFocusMode(false);
        setFocusUiVisible(false);
        saveFocusModePreference(false);
      }
    };

    for (const evt of FULLSCREEN_CHANGE_EVENTS) {
      document.addEventListener(evt, syncFocusModeWithFullscreen);
    }
    return () => {
      for (const evt of FULLSCREEN_CHANGE_EVENTS) {
        document.removeEventListener(evt, syncFocusModeWithFullscreen);
      }
    };
  }, [focusMode]);

  // Listen to OS prefers-reduced-motion changes if user hasn't manually overridden
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handlePrefChange = (e: MediaQueryListEvent) => {
      if (!hasManualReduceMotionOverride() && e.matches) {
        setReduceMotion(true);
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', handlePrefChange);
      return () => mq.removeEventListener('change', handlePrefChange);
    }
    return undefined;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      saveThemePreference(next);
      showToast(
        next === 'dark' ? 'Tema Gelap diaktifkan' : 'Tema Terang diaktifkan',
      );
      return next;
    });
  }, [showToast]);

  const adjustFontSize = useCallback((dir: -1 | 1) => {
    setFontScale((prev) => {
      const next = clampFontScale(prev + dir * 10);
      saveFontScalePreference(next);
      return next;
    });
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      setFocusUiVisible(false);
      saveFocusModePreference(next);
      vibrate(15);
      if (next) {
        enterFullscreen();
        showToast('👁️ Focus Mode aktif');
        showBottomHint('👈 Geser layar ke kiri / kanan untuk pindah bab 👉');
      } else {
        exitFullscreen();
        showToast('👁️ Focus Mode nonaktif');
      }
      return next;
    });
  }, [showToast, showBottomHint]);

  const toggleFocusUiVisibility = useCallback(() => {
    if (!focusMode) return;
    setFocusUiVisible((prev) => !prev);
  }, [focusMode]);

  const setReduceMotionEnabled = useCallback(
    (isActive: boolean) => {
      setReduceMotion(isActive);
      saveReduceMotionPreference(isActive);
      showToast(
        isActive ? '🧘 Reduce Motion aktif' : '🧘 Reduce Motion nonaktif',
      );
    },
    [showToast],
  );

  return {
    theme,
    fontScale,
    focusMode,
    focusUiVisible,
    reduceMotion,
    toggleTheme,
    adjustFontSize,
    toggleFocusMode,
    toggleFocusUiVisibility,
    setReduceMotionEnabled,
  };
}

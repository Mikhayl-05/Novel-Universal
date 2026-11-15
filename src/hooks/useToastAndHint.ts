import { useCallback, useEffect, useRef, useState } from 'react';

export function useToastAndHint() {
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [bottomHintMessage, setBottomHintMessage] = useState('');
  const [bottomHintVisible, setBottomHintVisible] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, 2000);
  }, []);

  const showBottomHint = useCallback((message: string, duration = 3200) => {
    setBottomHintMessage(message);
    setBottomHintVisible(true);
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = setTimeout(() => {
      setBottomHintVisible(false);
      hintTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
    };
  }, []);

  return {
    toastMessage,
    toastVisible,
    showToast,
    bottomHintMessage,
    bottomHintVisible,
    showBottomHint,
  };
}

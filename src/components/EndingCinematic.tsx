import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface EndingCinematicProps {
  open: boolean;
  workTitle?: string;
  onComplete: () => void;
}

interface StarSpec {
  left: string;
  top: string;
  dur: string;
  delay: string;
  op: string;
  width: string;
  height: string;
}

interface PetalSpec {
  left: string;
  width: string;
  height: string;
  background: string;
  rotS: string;
  rotE: string;
  drift: string;
  op: string;
  dur: number;
  delay: number;
}

const PETAL_COLORS = [
  'rgba(224,146,109,0.55)',
  'rgba(201,125,90,0.45)',
  'rgba(240,165,129,0.5)',
  'rgba(180,100,70,0.4)',
] as const;

export function EndingCinematic({
  open,
  workTitle = 'Ruang Karya',
  onComplete,
}: EndingCinematicProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const completedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { stars, petals } = useMemo(() => {
    if (!open) return { stars: [] as StarSpec[], petals: [] as PetalSpec[] };

    const generatedStars: StarSpec[] = Array.from({ length: 60 }, () => {
      const size = 1 + Math.random() * 3;
      return {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        dur: `${3 + Math.random() * 5}s`,
        delay: `${Math.random() * 4}s`,
        op: `${0.3 + Math.random() * 0.7}`,
        width: `${size}px`,
        height: `${size}px`,
      };
    });

    const generatedPetals: PetalSpec[] = Array.from({ length: 18 }, () => {
      const size = 6 + Math.random() * 12;
      return {
        left: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size * 0.6}px`,
        background:
          PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
        rotS: `${Math.random() * 360}deg`,
        rotE: `${Math.random() * 720}deg`,
        drift: `${-80 + Math.random() * 160}px`,
        op: `${0.5 + Math.random() * 0.5}`,
        dur: 8 + Math.random() * 10,
        delay: Math.random() * 6,
      };
    });

    return { stars: generatedStars, petals: generatedPetals };
  }, [open]);

  const triggerDismiss = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (autoDismissRef.current !== null) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    setFadingOut(true);
    fadeTimerRef.current = setTimeout(() => {
      setFadingOut(false);
      onComplete();
    }, 1500);
  }, [onComplete]);

  useEffect(() => {
    if (!open) {
      completedRef.current = false;
      setFadingOut(false);
      return undefined;
    }

    completedRef.current = false;
    autoDismissRef.current = setTimeout(() => {
      triggerDismiss();
    }, 15000);

    return () => {
      if (autoDismissRef.current !== null) clearTimeout(autoDismissRef.current);
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    };
  }, [open, triggerDismiss]);

  return (
    <div
      id="ending-cinematic"
      className={`${open ? 'active' : ''}${
        fadingOut ? ' fade-out-ending' : ''
      }`.trim()}
    >
      <div className="ending-cin-particles" id="ending-cin-particles">
        {stars.map((s, idx) => (
          <div
            key={`star-${idx}`}
            className="ending-cin-star"
            style={
              {
                left: s.left,
                top: s.top,
                width: s.width,
                height: s.height,
                '--dur': s.dur,
                '--delay': s.delay,
                '--op': s.op,
              } as React.CSSProperties
            }
          />
        ))}
        {petals.map((p, idx) => (
          <div
            key={`petal-${idx}`}
            style={
              {
                position: 'absolute',
                left: p.left,
                top: '-20px',
                width: p.width,
                height: p.height,
                background: p.background,
                borderRadius: '50% 10% 50% 10%',
                '--rot-s': p.rotS,
                '--rot-e': p.rotE,
                '--drift': p.drift,
                '--op': p.op,
                animation: `petalFall ${p.dur}s ${p.delay}s linear infinite`,
                pointerEvents: 'none',
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="ending-cin-line" />
      <p className="ending-cin-label">{workTitle}</p>
      <h1 className="ending-cin-title">
        Kamu sudah sampai
        <br />
        di bagian terakhir karya ini
      </h1>
      <p className="ending-cin-subtitle">
        Terima kasih sudah membaca sampai akhir halaman.
      </p>
      <span className="ending-cin-ornament">✦</span>
      <button
        type="button"
        className="ending-cin-btn"
        id="ending-cin-btn"
        onClick={triggerDismiss}
      >
        Buka Halaman Terakhir →
      </button>
    </div>
  );
}

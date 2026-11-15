import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ChapterId, VfxKey } from '../types/novel';

interface VisualEffectsLayerProps {
  chapterId: ChapterId;
  effect?: VfxKey;
  triggerMode?: 'scroll_40' | 'immediate' | 'none';
  durationMs?: number;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  listenCueEvent?: boolean;
}

const PASIR_COLORS = [
  'rgba(201,125,90,0.62)',
  'rgba(240,215,160,0.55)',
  'rgba(160,200,120,0.52)',
  'rgba(230,190,100,0.55)',
  'rgba(200,160,130,0.5)',
] as const;

const LOVE_COLORS = [
  '#ff4b72',
  '#ff6f91',
  '#ff96ad',
  '#e06ebb',
  '#ff85a2',
  '#ff3366',
  '#ff66b2',
  '#ff99cc',
] as const;

const SKETCH_LINES: readonly [number, number, number, number, number][] = [
  [55, 90, 320, 175, 0.0],
  [110, 230, 430, 140, 0.15],
  [40, 350, 390, 290, 0.28],
  [200, 460, 540, 410, 0.4],
  [130, 560, 480, 510, 0.52],
  [320, 130, 620, 220, 0.63],
  [70, 620, 400, 580, 0.72],
  [250, 80, 560, 50, 0.18],
];

function ButterflyEffect() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const startY = window.innerHeight + 100;
    const endY = -150;
    const startX = window.innerWidth * 0.45;
    const DUR = 6500;
    let startTime: number | null = null;
    let rafId = 0;

    wrap.style.top = '0px';
    wrap.style.left = '0px';
    wrap.style.opacity = '0';

    const fly = (ts: number) => {
      if (startTime === null) startTime = ts;
      const p = Math.min((ts - startTime) / DUR, 1);
      const y = startY - p * (startY - endY);
      const x = startX + Math.sin(p * Math.PI * 4) * 50;
      const op = p < 0.1 ? p * 10 : p > 0.85 ? (1 - p) / 0.15 : 1;
      wrap.style.transform = `translate(${x}px, ${y}px)`;
      wrap.style.opacity = (op * 0.88).toFixed(3);
      if (p < 1) {
        rafId = requestAnimationFrame(fly);
      }
    };

    rafId = requestAnimationFrame(fly);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ position: 'fixed', pointerEvents: 'none', zIndex: 501 }}
    >
      <svg width="110" height="80" viewBox="0 0 110 80">
        <g className="vfx-wing-l">
          <ellipse cx="30" cy="32" rx="28" ry="22" fill="rgba(130,70,200,0.52)" />
          <ellipse cx="24" cy="54" rx="19" ry="13" fill="rgba(160,90,220,0.42)" />
        </g>
        <g className="vfx-wing-r">
          <ellipse cx="80" cy="32" rx="28" ry="22" fill="rgba(130,70,200,0.52)" />
          <ellipse cx="86" cy="54" rx="19" ry="13" fill="rgba(160,90,220,0.42)" />
        </g>
        <ellipse cx="55" cy="40" rx="3.5" ry="18" fill="rgba(70,30,90,0.65)" />
        <line
          x1="52"
          y1="22"
          x2="40"
          y2="8"
          stroke="rgba(70,30,90,0.5)"
          strokeWidth="1.2"
        />
        <line
          x1="58"
          y1="22"
          x2="70"
          y2="8"
          stroke="rgba(70,30,90,0.5)"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}

function PasirJambuEffect() {
  const { dots, leaves } = useMemo(() => {
    const generatedDots = Array.from({ length: 34 }, () => {
      const size = 3 + Math.random() * 5.5;
      return {
        size,
        x: Math.random() * 98,
        delay: Math.random() * 2.8,
        dur: 3.8 + Math.random() * 2.5,
        color: PASIR_COLORS[Math.floor(Math.random() * PASIR_COLORS.length)],
      };
    });
    const generatedLeaves = Array.from({ length: 9 }, () => {
      const w = 7 + Math.random() * 5;
      return {
        w,
        h: w * 1.4,
        x: Math.random() * 96,
        delay: Math.random() * 3.2,
        dur: 4.5 + Math.random() * 2,
        rot: Math.random() * 360,
      };
    });
    return { dots: generatedDots, leaves: generatedLeaves };
  }, []);

  return (
    <>
      {dots.map((d, i) => (
        <span
          key={`pasir-${i}`}
          style={{
            position: 'absolute',
            width: `${d.size}px`,
            height: `${d.size}px`,
            borderRadius: '50%',
            background: d.color,
            left: `${d.x}%`,
            top: '-14px',
            animation: `vfxParticleFall ${d.dur}s ${d.delay}s ease-in forwards`,
          }}
        />
      ))}
      {leaves.map((l, i) => (
        <span
          key={`leaf-${i}`}
          style={{
            position: 'absolute',
            width: `${l.w}px`,
            height: `${l.h}px`,
            borderRadius: '50% 0 50% 0',
            background: 'rgba(100,170,80,0.5)',
            left: `${l.x}%`,
            top: '-20px',
            transform: `rotate(${l.rot}deg)`,
            animation: `vfxParticleFall ${l.dur}s ${l.delay}s ease-in forwards`,
          }}
        />
      ))}
    </>
  );
}

function DustMotesEffect() {
  const dust = useMemo(
    () =>
      Array.from({ length: 35 }, () => ({
        size: 1.5 + Math.random() * 3.5,
        x: Math.random() * 100,
        y: Math.random() * 100,
        del: Math.random() * 5,
        dur: 8 + Math.random() * 12,
      })),
    [],
  );

  return (
    <>
      {dust.map((d, i) => (
        <span
          key={`dust-${i}`}
          style={{
            position: 'absolute',
            width: `${d.size}px`,
            height: `${d.size}px`,
            borderRadius: '50%',
            background: 'rgba(235,215,190,0.3)',
            boxShadow: `0 0 ${d.size * 2}px rgba(235,215,190,0.25)`,
            left: `${d.x}%`,
            top: `${d.y}%`,
            animation: `vfxDustFloat ${d.dur}s ${d.del}s ease-in-out forwards`,
          }}
        />
      ))}
    </>
  );
}

function IceTehEffect() {
  const drops = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        size: 6 + Math.random() * 12,
        x: Math.random() * 100,
        del: Math.random() * 8,
        dur: 8 + Math.random() * 6,
      })),
    [],
  );

  return (
    <>
      {drops.map((d, i) => (
        <span
          key={`ice-${i}`}
          style={{
            position: 'fixed',
            bottom: '-50px',
            width: `${d.size}px`,
            height: `${d.size * 1.25}px`,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.7), rgba(160,210,245,0.15))',
            border: '0.5px solid rgba(180,225,255,0.3)',
            left: `${d.x}%`,
            animation: `vfxIceRise ${d.dur}s ${d.del}s ease-in-out forwards`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

function SketchLinesEffect() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {SKETCH_LINES.map(([x1, y1, x2, y2, delayFrac], i) => (
        <line
          key={`sketch-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(90,80,70,0.22)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1200"
          strokeDashoffset="1200"
          style={{
            animation: `vfxSketchDraw 2s ${delayFrac * 1.5}s ease-out forwards`,
          }}
        />
      ))}
    </svg>
  );
}

function LovePopEffect() {
  const hearts = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        size: 14 + Math.random() * 16,
        x: Math.random() * 100,
        delay: Math.random() * 2.8,
        dur: 4.5 + Math.random() * 2.5,
        color: LOVE_COLORS[Math.floor(Math.random() * LOVE_COLORS.length)],
        driftX: -120 + Math.random() * 240,
        rotStart: -45 + Math.random() * 90,
        rotEnd: -180 + Math.random() * 360,
      })),
    [],
  );

  return (
    <>
      {hearts.map((h, i) => (
        <div
          key={`love-${i}`}
          style={
            {
              position: 'fixed',
              bottom: '-50px',
              left: `${h.x}%`,
              width: `${h.size}px`,
              height: `${h.size}px`,
              '--drift-x': `${h.driftX}px`,
              '--rot-start': `${h.rotStart}deg`,
              '--rot-end': `${h.rotEnd}deg`,
              animation: `vfxLovePopAnim ${h.dur}s ${h.delay}s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
              pointerEvents: 'none',
              zIndex: 501,
            } as React.CSSProperties
          }
        >
          <svg
            viewBox="0 0 24 24"
            width="100%"
            height="100%"
            style={{
              fill: h.color,
              filter: 'drop-shadow(0 2px 5px rgba(255, 75, 114, 0.22))',
            }}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      ))}
    </>
  );
}

export function VisualEffectsLayer({
  chapterId,
  effect,
  triggerMode = 'scroll_40',
  durationMs = 25000,
  scrollContainerRef,
  listenCueEvent = false,
}: VisualEffectsLayerProps) {
  const [triggeredEffect, setTriggeredEffect] = useState<VfxKey | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sketchFadeOut, setSketchFadeOut] = useState(false);
  const cueCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueSketchFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runEffect = (nextEffect: VfxKey, nextDurationMs: number) => {
    if (!nextEffect || nextEffect === 'none') return;
    if (cueCleanupRef.current !== null) clearTimeout(cueCleanupRef.current);
    if (cueSketchFadeRef.current !== null) clearTimeout(cueSketchFadeRef.current);

    setTriggeredEffect(null);
    setIsActive(false);
    setSketchFadeOut(false);

    requestAnimationFrame(() => {
      setTriggeredEffect(nextEffect);
      requestAnimationFrame(() => {
        setIsActive(true);
      });
    });

    if (nextEffect === 'sketch_lines') {
      cueSketchFadeRef.current = setTimeout(() => {
        setSketchFadeOut(true);
      }, Math.min(4500, Math.max(1200, nextDurationMs - 1500)));
    }
    cueCleanupRef.current = setTimeout(() => {
      setTriggeredEffect(null);
      setIsActive(false);
      setSketchFadeOut(false);
    }, Math.max(1000, nextDurationMs));
  };

  useEffect(() => {
    setTriggeredEffect(null);
    setIsActive(false);
    setSketchFadeOut(false);
    if (cueCleanupRef.current !== null) clearTimeout(cueCleanupRef.current);
    if (cueSketchFadeRef.current !== null) clearTimeout(cueSketchFadeRef.current);

    if (!effect || effect === 'none' || triggerMode === 'none') return undefined;

    let triggered = false;
    let shortTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    let sketchFadeTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollListenerAttached = false;
    const containerEl = scrollContainerRef?.current ?? null;

    const trigger = () => {
      if (triggered) return;
      triggered = true;
      setTriggeredEffect(effect);
      requestAnimationFrame(() => {
        setIsActive(true);
      });
      if (effect === 'sketch_lines') {
        sketchFadeTimer = setTimeout(() => {
          setSketchFadeOut(true);
        }, Math.min(4500, Math.max(1200, durationMs - 1500)));
      }
      cleanupTimer = setTimeout(() => {
        setTriggeredEffect(null);
        setIsActive(false);
        setSketchFadeOut(false);
      }, durationMs);
    };

    const getScrollStats = () => {
      if (containerEl) {
        return {
          scrolled: containerEl.scrollTop,
          totalHeight: containerEl.scrollHeight - containerEl.clientHeight,
        };
      }
      return {
        scrolled: window.scrollY || window.pageYOffset,
        totalHeight: document.documentElement.scrollHeight - window.innerHeight,
      };
    };

    const handleScroll = () => {
      if (triggered) return;
      const { scrolled, totalHeight } = getScrollStats();
      const progress = totalHeight > 0 ? scrolled / totalHeight : 0;
      if (progress >= 0.4) {
        trigger();
        if (containerEl) {
          containerEl.removeEventListener('scroll', handleScroll);
        } else {
          window.removeEventListener('scroll', handleScroll);
        }
        scrollListenerAttached = false;
      }
    };

    const rafId = requestAnimationFrame(() => {
      if (triggerMode === 'immediate') {
        trigger();
        return;
      }
      const { totalHeight } = getScrollStats();
      if (totalHeight <= 50) {
        shortTimer = setTimeout(() => {
          trigger();
        }, 2200);
      } else {
        scrollListenerAttached = true;
        if (containerEl) {
          containerEl.addEventListener('scroll', handleScroll, { passive: true });
        } else {
          window.addEventListener('scroll', handleScroll, { passive: true });
        }
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (scrollListenerAttached) {
        if (containerEl) {
          containerEl.removeEventListener('scroll', handleScroll);
        } else {
          window.removeEventListener('scroll', handleScroll);
        }
      }
      if (shortTimer !== null) clearTimeout(shortTimer);
      if (cleanupTimer !== null) clearTimeout(cleanupTimer);
      if (sketchFadeTimer !== null) clearTimeout(sketchFadeTimer);
    };
  }, [chapterId, effect, triggerMode, durationMs, scrollContainerRef]);

  useEffect(() => {
    if (!listenCueEvent) return undefined;
    const onCue = (ev: Event) => {
      const detail = (ev as CustomEvent<{ effect?: VfxKey; durationMs?: number }>).detail;
      if (!detail?.effect || detail.effect === 'none') return;
      runEffect(detail.effect, detail.durationMs ?? 25000);
    };
    window.addEventListener('reader:vfx-cue', onCue);
    window.addEventListener('studio:test-vfx', onCue);
    return () => {
      window.removeEventListener('reader:vfx-cue', onCue);
      window.removeEventListener('studio:test-vfx', onCue);
    };
  }, [listenCueEvent]);

  useEffect(() => {
    return () => {
      if (cueCleanupRef.current !== null) clearTimeout(cueCleanupRef.current);
      if (cueSketchFadeRef.current !== null) clearTimeout(cueSketchFadeRef.current);
    };
  }, []);

  if (!triggeredEffect || triggeredEffect === 'none') return null;

  const layerStyle: React.CSSProperties | undefined =
    triggeredEffect === 'red_fog'
      ? {
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          animation: 'vfxHeartbeatRed 3.5s ease-in-out 3 forwards',
          zIndex: 500,
        }
      : sketchFadeOut
        ? {
            transition: 'opacity 1.2s ease',
            opacity: 0,
          }
        : undefined;

  return (
    <div
      id="vfx-layer"
      className={isActive ? 'active' : undefined}
      style={layerStyle}
      data-effect={triggeredEffect}
    >
      {triggeredEffect === 'purple_butterfly' && <ButterflyEffect />}
      {triggeredEffect === 'pasir_jambu' && <PasirJambuEffect />}
      {triggeredEffect === 'dust_motes' && <DustMotesEffect />}
      {triggeredEffect === 'ice_teh' && <IceTehEffect />}
      {triggeredEffect === 'sketch_lines' && <SketchLinesEffect />}
      {triggeredEffect === 'love_pop' && <LovePopEffect />}
    </div>
  );
}

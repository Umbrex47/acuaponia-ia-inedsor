import { useEffect, useState } from 'react';
import gsap from 'gsap';

/** Geometría centrada del lienzo del medidor (sin desplazamiento lateral). */
export function gaugeCanvas(size, inset = 0.14) {
  const pad = size * inset;
  return {
    size,
    pad,
    w: size - pad * 2,
    h: size - pad * 2,
    x: pad,
    y: pad,
    cx: size / 2,
    cy: size / 2,
  };
}

export function useGaugeLevel(value, delay, inactive) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inactive) {
      setDisplayValue(0);
      return undefined;
    }

    const target = Math.max(0, Math.min(100, value));
    const counter = { v: 0 };
    const tl = gsap.timeline({ delay });

    tl.to(counter, {
      v: target,
      duration: 1.4,
      ease: 'power3.out',
      onUpdate: () => setDisplayValue(counter.v),
    });

    return () => tl.kill();
  }, [value, delay, inactive]);

  return Math.max(0, Math.min(100, displayValue));
}

export function GaugeFrame({ label, size, inactive, children }) {
  return (
    <div
      className={
        'flex flex-col items-center select-none transition-opacity ' +
        (inactive ? 'opacity-60' : '')
      }
    >
      <div className="relative" style={{ width: size, height: size }}>
        {children}
      </div>
      {label && (
        <div
          className={
            'mt-3 font-display font-semibold text-base sm:text-lg text-center ' +
            (inactive ? 'text-ink/45' : 'text-ink')
          }
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function GaugeValueOverlay({
  size,
  inactive,
  level,
  reading,
  status,
  inset = 0,
}) {
  const textColor = status ? status.color : '#0A0A0A';
  const pad = size * inset;

  return (
    <div
      className="absolute flex flex-col items-center justify-center text-center pointer-events-none"
      style={{ left: pad, top: pad, width: size - pad * 2, height: size - pad * 2 }}
    >
      {inactive ? (
        <>
          <span
            className="font-display font-bold text-ink/40 leading-none"
            style={{ fontSize: size * 0.16 }}
          >
            N/D
          </span>
          <span
            className="text-ink/40 mt-1 font-medium"
            style={{ fontSize: size * 0.085 }}
          >
            No disponible
          </span>
        </>
      ) : (
        <>
          <span
            className="font-display font-bold leading-none drop-shadow-sm"
            style={{ fontSize: size * 0.12, color: textColor }}
          >
            {status ? status.label : `${Math.round(level)}%`}
          </span>
          {reading != null && (
            <span
              className="mt-1 font-semibold text-ink leading-none drop-shadow-sm"
              style={{ fontSize: size * 0.095 }}
            >
              {reading}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Animación de flotación suave para un grupo SVG. */
export function floatGroup(el, { y = -8, duration = 2.5, delay = 0 } = {}) {
  if (!el) return;
  gsap.set(el, { y: 0 });
  gsap.to(el, {
    y,
    duration,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    delay,
  });
}

/** Burbuja que asciende y reinicia desde abajo. */
export function riseBubble(el, { distance, duration = 2.8, delay = 0 } = {}) {
  if (!el) return;
  gsap.timeline({ repeat: -1, delay })
    .set(el, { y: 0, opacity: 0.2 })
    .to(el, { y: -distance, opacity: 0.65, duration, ease: 'power1.out' })
    .set(el, { y: 0, opacity: 0.2 });
}

export function killAnimations(refs) {
  (refs.current ?? []).forEach((el) => {
    if (el) gsap.killTweensOf(el);
  });
}

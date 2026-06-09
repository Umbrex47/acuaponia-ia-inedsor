import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Gradiente clásico de la escala de pH: ácido (rojo) → neutro (verde) → alcalino (violeta).
const PH_GRADIENT =
  'linear-gradient(to right, #DC2626 0%, #F97316 21%, #FACC15 36%, #16A34A 50%, #14B8A6 64%, #2563EB 79%, #7C3AED 100%)';

export default function PhScaleBar({
  label = 'pH',
  value,
  min = 0,
  max = 14,
  size = 130,
  width = 170,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const markerRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(min);

  useEffect(() => {
    if (inactive) {
      setDisplayValue(min);
      if (markerRef.current) {
        gsap.set(markerRef.current, { left: '0%' });
      }
      return undefined;
    }

    const target = Math.max(min, Math.min(max, value));
    const pct = ((target - min) / (max - min)) * 100;

    const counter = { v: min };
    const tl = gsap.timeline({ delay });

    tl.fromTo(
      markerRef.current,
      { left: '0%' },
      { left: `${pct}%`, duration: 1.4, ease: 'power3.out' },
      0
    );

    tl.to(
      counter,
      {
        v: target,
        duration: 1.4,
        ease: 'power3.out',
        onUpdate: () => setDisplayValue(counter.v),
      },
      0
    );

    return () => tl.kill();
  }, [value, min, max, delay, inactive]);

  return (
    <div
      className={
        'flex flex-col items-center select-none transition-opacity ' +
        (inactive ? 'opacity-60' : '')
      }
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{ width, height: size }}
      >
        {inactive ? (
          <>
            <span
              className="font-display font-bold text-ink/40 leading-none"
              style={{ fontSize: size * 0.2 }}
            >
              N/D
            </span>
            <span
              className="text-ink/40 mt-1 font-medium"
              style={{ fontSize: size * 0.1 }}
            >
              No disponible
            </span>
          </>
        ) : (
          <>
            <span
              className="font-display font-bold leading-none"
              style={{
                fontSize: size * 0.16,
                color: status ? status.color : '#0A0A0A',
              }}
            >
              {status ? status.label : displayValue.toFixed(1)}
            </span>
            <span
              className="mt-1 font-semibold text-ink leading-none"
              style={{ fontSize: size * 0.13 }}
            >
              {displayValue.toFixed(1)}
            </span>
          </>
        )}

        <div className="relative mt-4" style={{ width }}>
          <div
            className="h-3 rounded-full border border-black/10"
            style={{
              background: PH_GRADIENT,
              filter: inactive ? 'grayscale(1)' : 'none',
            }}
          />
          {!inactive && (
            <div
              ref={markerRef}
              className="absolute top-1/2 w-[5px] h-[20px] rounded-full bg-ink ring-2 ring-white shadow"
              style={{ left: '0%', transform: 'translate(-50%, -50%)' }}
            />
          )}
        </div>

        <div
          className="flex justify-between text-ink/50 font-medium mt-1.5"
          style={{ width, fontSize: size * 0.085 }}
        >
          <span>{min}</span>
          <span>{(min + max) / 2}</span>
          <span>{max}</span>
        </div>
      </div>

      {label && (
        <div
          className={
            'mt-3 font-display font-semibold text-base sm:text-lg ' +
            (inactive ? 'text-ink/45' : 'text-ink')
          }
        >
          {label}
        </div>
      )}
    </div>
  );
}

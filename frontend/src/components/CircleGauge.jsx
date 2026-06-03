import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function CircleGauge({
  label,
  value,
  reading,
  size = 130,
  color = '#0A0A0A',
  delay = 0,
  inactive = false,
  status = null,
}) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const ringRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inactive) {
      setDisplayValue(0);
      if (ringRef.current) {
        gsap.set(ringRef.current, { strokeDashoffset: circumference });
      }
      return undefined;
    }

    const target = Math.max(0, Math.min(100, value));
    const offsetTo = circumference * (1 - target / 100);

    const counter = { v: 0 };
    const tl = gsap.timeline({ delay });

    tl.fromTo(
      ringRef.current,
      { strokeDashoffset: circumference },
      {
        strokeDashoffset: offsetTo,
        duration: 1.4,
        ease: 'power3.out',
      },
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
  }, [value, circumference, delay, inactive]);

  const ringColor = inactive ? '#D4D4D4' : status?.color ?? color;

  return (
    <div
      className={
        'flex flex-col items-center select-none transition-opacity ' +
        (inactive ? 'opacity-60' : '')
      }
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E5E5"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={inactive ? '4 5' : undefined}
          />
          <circle
            ref={ringRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - stroke - 2}
            stroke="#0A0A0A"
            strokeWidth="1.5"
            fill="none"
            opacity={inactive ? '0.25' : '0.85'}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
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
                  fontSize: size * 0.2,
                  color: status ? status.color : '#0A0A0A',
                }}
              >
                {status ? status.label : `${Math.round(displayValue)}%`}
              </span>
              {reading != null && (
                <span
                  className="mt-1 font-semibold text-ink leading-none"
                  style={{ fontSize: size * 0.13 }}
                >
                  {reading}
                </span>
              )}
            </>
          )}
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

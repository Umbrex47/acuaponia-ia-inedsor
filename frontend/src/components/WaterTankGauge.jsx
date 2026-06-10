import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const WATER_COLOR = '#2563EB';

// Indicador de nivel de agua con forma de tanque: el agua sube desde el
// fondo hasta el porcentaje medido y una pequeña ola anima la superficie.
export default function WaterTankGauge({
  label,
  value,
  reading,
  size = 130,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const waveRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  // Geometría del tanque dentro del viewBox cuadrado.
  const tankW = size * 0.62;
  const tankH = size * 0.82;
  const tankX = (size - tankW) / 2 - size * 0.06;
  const tankY = (size - tankH) / 2;
  const radius = size * 0.07;
  const clipId = useRef(`tank-clip-${Math.random().toString(36).slice(2)}`).current;

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

    // Ola continua en la superficie del agua.
    if (waveRef.current) {
      gsap.set(waveRef.current, { x: 0 });
      tl.to(
        waveRef.current,
        {
          x: -tankW,
          duration: 3,
          ease: 'none',
          repeat: -1,
        },
        0
      );
    }

    return () => tl.kill();
  }, [value, delay, inactive, tankW]);

  const level = Math.max(0, Math.min(100, displayValue));
  const waterTop = tankY + tankH * (1 - level / 100);
  const waveAmp = size * 0.018;

  // Línea ondulada que cubre dos anchos de tanque para poder desplazarla en bucle.
  const wavePath = (() => {
    const w = tankW;
    const half = w / 2;
    let d = `M ${tankX} ${waterTop}`;
    for (let i = 0; i < 4; i += 1) {
      const x0 = tankX + i * half;
      d += ` Q ${x0 + half / 2} ${waterTop + (i % 2 === 0 ? -waveAmp * 2 : waveAmp * 2)} ${x0 + half} ${waterTop}`;
    }
    d += ` L ${tankX + 2 * w} ${tankY + tankH} L ${tankX} ${tankY + tankH} Z`;
    return d;
  })();

  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const textColor = status ? status.color : '#0A0A0A';

  // Marcas de escala (25%, 50%, 75%) en el lateral derecho del tanque.
  const ticks = [0.25, 0.5, 0.75];

  return (
    <div
      className={
        'flex flex-col items-center select-none transition-opacity ' +
        (inactive ? 'opacity-60' : '')
      }
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <defs>
            <clipPath id={clipId}>
              <rect
                x={tankX}
                y={tankY}
                width={tankW}
                height={tankH}
                rx={radius}
              />
            </clipPath>
          </defs>

          {/* Agua con ola en la superficie */}
          {!inactive && level > 0 && (
            <g clipPath={`url(#${clipId})`}>
              <path
                ref={waveRef}
                d={wavePath}
                fill={WATER_COLOR}
                opacity="0.28"
              />
              <rect
                x={tankX}
                y={waterTop + waveAmp * 2}
                width={tankW}
                height={Math.max(0, tankY + tankH - waterTop)}
                fill={WATER_COLOR}
                opacity="0.18"
              />
            </g>
          )}

          {/* Cuerpo del tanque */}
          <rect
            x={tankX}
            y={tankY}
            width={tankW}
            height={tankH}
            rx={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={inactive ? '4 5' : undefined}
          />
          {/* Tapa del tanque */}
          <rect
            x={tankX + tankW * 0.36}
            y={tankY - size * 0.045}
            width={tankW * 0.28}
            height={size * 0.045}
            rx={size * 0.015}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            opacity={inactive ? 0.4 : 0.85}
          />

          {/* Marcas de nivel */}
          {ticks.map((t) => (
            <line
              key={t}
              x1={tankX + tankW}
              y1={tankY + tankH * (1 - t)}
              x2={tankX + tankW + size * 0.05}
              y2={tankY + tankH * (1 - t)}
              stroke={strokeColor}
              strokeWidth="1.5"
              opacity={inactive ? 0.3 : 0.5}
            />
          ))}
        </svg>

        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{ left: tankX, top: tankY, width: tankW, height: tankH }}
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
                className="font-display font-bold leading-none"
                style={{ fontSize: size * 0.125, color: textColor }}
              >
                {status ? status.label : `${Math.round(level)}%`}
              </span>
              {reading != null && (
                <span
                  className="mt-1 font-semibold text-ink leading-none"
                  style={{ fontSize: size * 0.1 }}
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

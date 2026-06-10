import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const MERCURY_COLOR = '#DC2626';

// Indicador de temperatura con forma de termómetro: el mercurio sube desde
// el bulbo hasta el porcentaje medido dentro de la escala del sensor.
export default function ThermometerGauge({
  label,
  value,
  reading,
  min,
  max,
  size = 130,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const [displayValue, setDisplayValue] = useState(0);

  // Geometría del termómetro dentro del viewBox cuadrado.
  const tubeW = size * 0.13;
  const bulbR = size * 0.11;
  const cx = size * 0.3;
  const bulbCy = size * 0.86 - bulbR;
  const tubeTop = size * 0.06;
  const tubeBottom = bulbCy - bulbR * 0.4;
  const tubeH = tubeBottom - tubeTop;
  const clipId = useRef(`thermo-clip-${Math.random().toString(36).slice(2)}`).current;

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

  const level = Math.max(0, Math.min(100, displayValue));
  // El mercurio recorre el tubo; el bulbo siempre está lleno.
  const mercuryTop = tubeBottom - (tubeH - tubeW / 2) * (level / 100);

  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const mercury = inactive ? '#D4D4D4' : status?.color ?? MERCURY_COLOR;
  const textColor = status ? status.color : '#0A0A0A';

  // Marcas de escala a la derecha del tubo (0%, 25%, 50%, 75%, 100%).
  const ticks = [0, 0.25, 0.5, 0.75, 1];

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
                x={cx - tubeW / 2}
                y={tubeTop}
                width={tubeW}
                height={tubeBottom - tubeTop}
                rx={tubeW / 2}
              />
              <circle cx={cx} cy={bulbCy} r={bulbR} />
            </clipPath>
          </defs>

          {/* Mercurio (bulbo + columna) */}
          <g clipPath={`url(#${clipId})`}>
            <circle cx={cx} cy={bulbCy} r={bulbR} fill={mercury} />
            {!inactive && (
              <rect
                x={cx - tubeW / 2}
                y={mercuryTop}
                width={tubeW}
                height={tubeBottom - mercuryTop + bulbR}
                fill={mercury}
              />
            )}
          </g>

          {/* Contorno del tubo y el bulbo */}
          <rect
            x={cx - tubeW / 2}
            y={tubeTop}
            width={tubeW}
            height={tubeBottom - tubeTop}
            rx={tubeW / 2}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={inactive ? '4 5' : undefined}
          />
          <circle
            cx={cx}
            cy={bulbCy}
            r={bulbR}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={inactive ? '4 5' : undefined}
          />

          {/* Marcas de escala */}
          {ticks.map((t) => {
            const y = tubeBottom - (tubeH - tubeW / 2) * t;
            const long = t === 0 || t === 0.5 || t === 1;
            return (
              <line
                key={t}
                x1={cx + tubeW / 2 + size * 0.02}
                y1={y}
                x2={cx + tubeW / 2 + size * (long ? 0.06 : 0.04)}
                y2={y}
                stroke={strokeColor}
                strokeWidth="1.5"
                opacity={inactive ? 0.3 : 0.5}
              />
            );
          })}

          {/* Valores de la escala (mín y máx) */}
          {!inactive && Number.isFinite(min) && Number.isFinite(max) && (
            <>
              <text
                x={cx + tubeW / 2 + size * 0.08}
                y={tubeBottom + size * 0.03}
                fontSize={size * 0.075}
                fill="#0A0A0A"
                opacity="0.5"
                fontWeight="500"
              >
                {min}°
              </text>
              <text
                x={cx + tubeW / 2 + size * 0.08}
                y={tubeTop + tubeW / 2 + size * 0.03}
                fontSize={size * 0.075}
                fill="#0A0A0A"
                opacity="0.5"
                fontWeight="500"
              >
                {max}°
              </text>
            </>
          )}
        </svg>

        {/* Texto a la derecha del termómetro */}
        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{
            left: size * 0.45,
            top: 0,
            width: size * 0.55,
            height: size,
          }}
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
                  style={{ fontSize: size * 0.115 }}
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

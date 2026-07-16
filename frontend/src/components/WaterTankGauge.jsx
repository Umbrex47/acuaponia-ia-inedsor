import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
} from './gaugeUtils';

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
  const level = useGaugeLevel(value, delay, inactive);
  const c = gaugeCanvas(size, 0.14);
  const tankW = c.w * 0.72;
  const tankH = c.h * 0.88;
  const tankX = c.cx - tankW / 2;
  const tankY = c.y + (c.h - tankH) / 2;
  const radius = size * 0.06;
  const clipId = useRef(`tank-clip-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (inactive || !waveRef.current) return undefined;

    gsap.set(waveRef.current, { x: 0 });
    const tween = gsap.to(waveRef.current, {
      x: -tankW,
      duration: 3,
      ease: 'none',
      repeat: -1,
      delay,
    });

    return () => tween.kill();
  }, [inactive, tankW, delay]);

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

  const ticks = [0.25, 0.5, 0.75];

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
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

      <GaugeValueOverlay
        size={size}
        inactive={inactive}
        level={level}
        reading={reading}
        status={status}
      />
    </GaugeFrame>
  );
}

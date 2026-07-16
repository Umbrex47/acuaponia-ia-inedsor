import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
} from './gaugeUtils';

const WAVE_COLOR = '#16A34A';

export default function ConductivityGauge({
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
  const c = gaugeCanvas(size, 0.12);
  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const waveStroke = inactive ? '#D4D4D4' : status?.color ?? WAVE_COLOR;

  const electrodeW = size * 0.055;
  const gap = size * 0.04;
  const leftX = c.x + gap;
  const rightX = c.x + c.w - gap - electrodeW;
  const elecTop = c.y + c.h * 0.22;
  const elecH = c.h * 0.56;
  const waveY = c.cy;
  const waveLeft = leftX + electrodeW + gap * 0.6;
  const waveRight = rightX - gap * 0.6;

  useEffect(() => {
    if (inactive || !waveRef.current) return undefined;

    gsap.set(waveRef.current, { strokeDashoffset: 0 });
    const tween = gsap.to(waveRef.current, {
      strokeDashoffset: -size * 0.45,
      duration: 1.1,
      ease: 'none',
      repeat: -1,
    });

    return () => tween.kill();
  }, [inactive, size]);

  const amp = size * 0.032 * (0.35 + (level / 100) * 0.65);
  const segW = (waveRight - waveLeft) / 4;
  let wavePath = `M ${waveLeft} ${waveY}`;
  for (let i = 0; i < 4; i += 1) {
    const x0 = waveLeft + i * segW;
    wavePath += ` Q ${x0 + segW / 2} ${waveY + (i % 2 === 0 ? -amp : amp)} ${x0 + segW} ${waveY}`;
  }

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        <rect
          x={leftX}
          y={elecTop}
          width={electrodeW}
          height={elecH}
          rx={size * 0.01}
          fill={strokeColor}
          opacity={inactive ? 0.25 : 0.65}
        />
        <rect
          x={rightX}
          y={elecTop}
          width={electrodeW}
          height={elecH}
          rx={size * 0.01}
          fill={strokeColor}
          opacity={inactive ? 0.25 : 0.65}
        />

        {!inactive && level > 0 && (
          <path
            ref={waveRef}
            d={wavePath}
            fill="none"
            stroke={waveStroke}
            strokeWidth={size * 0.022}
            strokeLinecap="round"
            strokeDasharray={`${size * 0.07} ${size * 0.045}`}
            opacity={0.4 + (level / 100) * 0.5}
          />
        )}
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

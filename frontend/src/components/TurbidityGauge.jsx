import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
  killAnimations,
} from './gaugeUtils';

const MURK_COLOR = '#78716C';

const SEDIMENT = [
  { x: 0.22, y: 0.78, r: 0.016 },
  { x: 0.35, y: 0.7, r: 0.013 },
  { x: 0.48, y: 0.82, r: 0.014 },
  { x: 0.6, y: 0.74, r: 0.011 },
  { x: 0.72, y: 0.8, r: 0.013 },
  { x: 0.28, y: 0.58, r: 0.012 },
  { x: 0.42, y: 0.55, r: 0.01 },
  { x: 0.55, y: 0.6, r: 0.012 },
  { x: 0.65, y: 0.5, r: 0.009 },
  { x: 0.38, y: 0.4, r: 0.011 },
  { x: 0.5, y: 0.35, r: 0.008 },
  { x: 0.62, y: 0.32, r: 0.01 },
];

export default function TurbidityGauge({
  label,
  value,
  reading,
  size = 130,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const groupRefs = useRef([]);
  const level = useGaugeLevel(value, delay, inactive);
  const c = gaugeCanvas(size, 0.14);
  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const murkFill = inactive ? '#D4D4D4' : status?.color ?? MURK_COLOR;
  const visibleCount = Math.round((level / 100) * SEDIMENT.length);

  const flaskW = c.w * 0.55;
  const flaskH = c.h * 0.78;
  const flaskX = c.cx - flaskW / 2;
  const flaskY = c.y + c.h * 0.08;
  const neckW = flaskW * 0.35;
  const neckH = flaskH * 0.12;
  const neckX = c.cx - neckW / 2;
  const bodyTop = flaskY + neckH;
  const bodyH = flaskH - neckH;
  const murkTop = bodyTop + bodyH * (1 - level / 100);
  const clipId = useRef(`turb-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (inactive) {
      killAnimations(groupRefs);
      return undefined;
    }

    groupRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, { x: 0 });
      gsap.to(el, {
        x: size * 0.015,
        duration: 2.8 + i * 0.15,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: i * 0.12,
      });
    });

    return () => killAnimations(groupRefs);
  }, [inactive, size]);

  const flaskPath = [
    `M ${neckX} ${flaskY}`,
    `L ${neckX} ${bodyTop}`,
    `Q ${flaskX} ${bodyTop} ${flaskX} ${bodyTop + bodyH * 0.15}`,
    `L ${flaskX} ${bodyTop + bodyH * 0.85}`,
    `Q ${c.cx} ${flaskY + flaskH + size * 0.02} ${flaskX + flaskW} ${bodyTop + bodyH * 0.85}`,
    `L ${flaskX + flaskW} ${bodyTop + bodyH * 0.15}`,
    `Q ${flaskX + flaskW} ${bodyTop} ${neckX + neckW} ${bodyTop}`,
    `L ${neckX + neckW} ${flaskY}`,
    'Z',
  ].join(' ');

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        <defs>
          <clipPath id={clipId}>
            <path d={flaskPath} />
          </clipPath>
        </defs>

        {!inactive && (
          <path
            d={flaskPath}
            fill="#2563EB"
            fillOpacity={0.05}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeDasharray={inactive ? '4 5' : undefined}
          />
        )}

        {inactive && (
          <path
            d={flaskPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeDasharray="4 5"
          />
        )}

        <g clipPath={`url(#${clipId})`}>
          {!inactive && level > 0 && (
            <rect
              x={flaskX}
              y={murkTop}
              width={flaskW}
              height={bodyTop + bodyH - murkTop}
              fill={murkFill}
              opacity={0.1 + (level / 100) * 0.35}
            />
          )}

          {SEDIMENT.map((s, i) => {
            const cx = flaskX + flaskW * ((s.x - 0.15) / 0.7);
            const cy = bodyTop + bodyH * (s.y - 0.2) / 0.75;
            const r = size * s.r;
            const visible = !inactive && i < visibleCount;
            return (
              <g
                key={i}
                ref={(el) => {
                  groupRefs.current[i] = el;
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={murkFill}
                  opacity={visible ? 0.55 : 0.07}
                />
              </g>
            );
          })}
        </g>
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

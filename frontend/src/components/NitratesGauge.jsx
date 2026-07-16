import { useEffect, useRef } from 'react';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
  floatGroup,
  killAnimations,
} from './gaugeUtils';

const NUTRIENT_COLOR = '#16A34A';

const PARTICLES = [
  { x: 0.2, y: 0.72, s: 0.026, rot: 15 },
  { x: 0.35, y: 0.58, s: 0.02, rot: -20 },
  { x: 0.5, y: 0.78, s: 0.024, rot: 30 },
  { x: 0.62, y: 0.48, s: 0.018, rot: -10 },
  { x: 0.75, y: 0.65, s: 0.022, rot: 45 },
  { x: 0.28, y: 0.38, s: 0.016, rot: -35 },
  { x: 0.45, y: 0.28, s: 0.019, rot: 10 },
  { x: 0.58, y: 0.22, s: 0.017, rot: -25 },
  { x: 0.68, y: 0.35, s: 0.02, rot: 50 },
  { x: 0.4, y: 0.55, s: 0.015, rot: 0 },
];

export default function NitratesGauge({
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
  const c = gaugeCanvas(size, 0.1);
  const fill = inactive ? '#D4D4D4' : status?.color ?? NUTRIENT_COLOR;
  const visibleCount = Math.round((level / 100) * PARTICLES.length);

  useEffect(() => {
    if (inactive) {
      killAnimations(groupRefs);
      return undefined;
    }

    groupRefs.current.forEach((el, i) => {
      if (!el) return;
      floatGroup(el, { y: -size * 0.02, duration: 2 + i * 0.12, delay: i * 0.15 });
    });

    return () => killAnimations(groupRefs);
  }, [inactive, size]);

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        {PARTICLES.map((p, i) => {
          const cx = c.x + c.w * p.x;
          const cy = c.y + c.h * p.y;
          const s = size * p.s;
          const visible = !inactive && i < visibleCount;
          return (
            <g
              key={i}
              ref={(el) => {
                groupRefs.current[i] = el;
              }}
              transform={`rotate(${p.rot} ${cx} ${cy})`}
            >
              <rect
                x={cx - s / 2}
                y={cy - s / 2}
                width={s}
                height={s}
                rx={s * 0.15}
                fill={fill}
                opacity={visible ? 0.75 : 0.08}
              />
            </g>
          );
        })}
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

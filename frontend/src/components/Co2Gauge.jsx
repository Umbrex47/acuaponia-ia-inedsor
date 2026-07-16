import { useEffect, useRef } from 'react';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
  riseBubble,
  killAnimations,
} from './gaugeUtils';

const GAS_COLOR = '#525252';

const BUBBLES = [
  { x: 0.38, delay: 0, r: 0.028 },
  { x: 0.48, delay: 0.4, r: 0.024 },
  { x: 0.42, delay: 0.9, r: 0.022 },
  { x: 0.54, delay: 0.2, r: 0.02 },
  { x: 0.46, delay: 1.2, r: 0.018 },
  { x: 0.5, delay: 0.65, r: 0.016 },
  { x: 0.44, delay: 1.5, r: 0.015 },
  { x: 0.52, delay: 1.0, r: 0.014 },
];

export default function Co2Gauge({
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
  const fill = inactive ? '#D4D4D4' : status?.color ?? GAS_COLOR;
  const sourceY = c.y + c.h * 0.9;
  const visibleCount = Math.round((level / 100) * BUBBLES.length);

  useEffect(() => {
    if (inactive) {
      killAnimations(groupRefs);
      return undefined;
    }

    groupRefs.current.forEach((el, i) => {
      if (!el) return;
      riseBubble(el, {
        distance: c.h * 0.65,
        duration: 2.6 + BUBBLES[i].delay * 0.3,
        delay: BUBBLES[i].delay,
      });
    });

    return () => killAnimations(groupRefs);
  }, [inactive, c.h]);

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        {!inactive && (
          <ellipse
            cx={c.cx}
            cy={sourceY}
            rx={size * 0.07}
            ry={size * 0.012}
            fill={fill}
            opacity={0.3}
          />
        )}

        {BUBBLES.map((b, i) => {
          const cx = c.x + c.w * b.x;
          const cy = sourceY - size * 0.04;
          const r = size * b.r;
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
                fill={fill}
                opacity={visible ? 0.55 : 0.06}
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

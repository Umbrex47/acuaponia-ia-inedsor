import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
  floatGroup,
  killAnimations,
} from './gaugeUtils';

const BUBBLE_COLOR = '#2563EB';

const BUBBLES = [
  { x: 0.18, y: 0.78, r: 0.05, delay: 0 },
  { x: 0.32, y: 0.62, r: 0.038, delay: 0.5 },
  { x: 0.48, y: 0.82, r: 0.044, delay: 1.0 },
  { x: 0.62, y: 0.55, r: 0.034, delay: 0.3 },
  { x: 0.76, y: 0.72, r: 0.04, delay: 1.3 },
  { x: 0.25, y: 0.42, r: 0.03, delay: 0.8 },
  { x: 0.44, y: 0.32, r: 0.036, delay: 1.6 },
  { x: 0.58, y: 0.24, r: 0.028, delay: 0.2 },
  { x: 0.7, y: 0.38, r: 0.032, delay: 1.1 },
  { x: 0.4, y: 0.52, r: 0.026, delay: 0.6 },
];

export default function OxygenBubblesGauge({
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
  const fill = inactive ? '#D4D4D4' : status?.color ?? BUBBLE_COLOR;
  const visibleCount = Math.round((level / 100) * BUBBLES.length);

  useEffect(() => {
    if (inactive) {
      killAnimations(groupRefs);
      return undefined;
    }

    groupRefs.current.forEach((el, i) => {
      if (!el) return;
      floatGroup(el, {
        y: -c.h * 0.22,
        duration: 2.4 + BUBBLES[i].delay * 0.4,
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
            cy={c.cy + c.h * 0.08}
            rx={c.w * 0.42}
            ry={c.h * 0.38}
            fill={fill}
            opacity={0.06}
          />
        )}

        {BUBBLES.map((b, i) => {
          const cx = c.x + c.w * b.x;
          const cy = c.y + c.h * b.y;
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
                opacity={visible ? 0.5 : 0.07}
                stroke={fill}
                strokeWidth="1"
                strokeOpacity={visible ? 0.35 : 0.08}
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

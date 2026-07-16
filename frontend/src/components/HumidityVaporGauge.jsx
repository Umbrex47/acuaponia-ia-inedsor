import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
  killAnimations,
} from './gaugeUtils';

const VAPOR_COLOR = '#2563EB';

const WISPS = [
  { x: 0.3, amp: 0.05, phase: 0 },
  { x: 0.5, amp: 0.06, phase: 0.5 },
  { x: 0.68, amp: 0.048, phase: 1.0 },
];

function wispPath(x, baseY, topY, amp) {
  const mid1 = baseY - (baseY - topY) * 0.35;
  const mid2 = baseY - (baseY - topY) * 0.68;
  return `M ${x} ${baseY} C ${x - amp} ${mid1} ${x + amp * 0.5} ${mid2} ${x - amp * 0.3} ${topY}`;
}

export default function HumidityVaporGauge({
  label,
  value,
  reading,
  size = 130,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const wispRefs = useRef([]);
  const level = useGaugeLevel(value, delay, inactive);
  const c = gaugeCanvas(size, 0.1);
  const stroke = inactive ? '#D4D4D4' : status?.color ?? VAPOR_COLOR;
  const baseY = c.y + c.h * 0.88;
  const topY = c.y + c.h * 0.18;
  const mistH = c.h * (level / 100) * 0.75;

  useEffect(() => {
    if (inactive) {
      killAnimations(wispRefs);
      return undefined;
    }

    wispRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, { y: 0, opacity: 0.25 });
      gsap.to(el, {
        y: -size * 0.035,
        opacity: 0.75,
        duration: 2.2 + WISPS[i].phase,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: WISPS[i].phase,
      });
    });

    return () => killAnimations(wispRefs);
  }, [inactive, size]);

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        {!inactive && level > 0 && (
          <ellipse
            cx={c.cx}
            cy={baseY - mistH * 0.35}
            rx={c.w * 0.38}
            ry={mistH * 0.55}
            fill={stroke}
            opacity={0.05 + (level / 100) * 0.12}
          />
        )}

        {!inactive &&
          level > 4 &&
          WISPS.map((w, i) => {
            const x = c.x + c.w * w.x;
            const amp = size * w.amp * (0.5 + level / 150);
            const opacity = 0.2 + (level / 100) * 0.5;
            return (
              <g
                key={i}
                ref={(el) => {
                  wispRefs.current[i] = el;
                }}
              >
                <path
                  d={wispPath(x, baseY, topY, amp)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={size * 0.02}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              </g>
            );
          })}

        {!inactive && (
          <line
            x1={c.x + c.w * 0.2}
            y1={baseY}
            x2={c.x + c.w * 0.8}
            y2={baseY}
            stroke={inactive ? '#D4D4D4' : '#0A0A0A'}
            strokeWidth="1"
            opacity={0.2}
            strokeLinecap="round"
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

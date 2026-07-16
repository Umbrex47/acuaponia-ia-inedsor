import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
} from './gaugeUtils';

export default function PressureGauge({
  label,
  value,
  reading,
  size = 130,
  delay = 0,
  inactive = false,
  status = null,
}) {
  const needleGroupRef = useRef(null);
  const level = useGaugeLevel(value, delay, inactive);
  const c = gaugeCanvas(size, 0.1);
  const cx = c.cx;
  const cy = c.y + c.h * 0.82;
  const arcR = c.w * 0.42;
  const needleLen = arcR * 0.72;
  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const accent = inactive ? '#D4D4D4' : status?.color ?? '#0A0A0A';

  useEffect(() => {
    if (!needleGroupRef.current) return undefined;

    if (inactive) {
      gsap.set(needleGroupRef.current, { rotation: -90 });
      return undefined;
    }

    const angle = -90 + (Math.max(0, Math.min(100, value)) / 100) * 180;
    gsap.set(needleGroupRef.current, { rotation: -90, transformOrigin: '0px 0px' });
    const tween = gsap.to(needleGroupRef.current, {
      rotation: angle,
      duration: 1.4,
      ease: 'power3.out',
      delay,
      transformOrigin: '0px 0px',
    });

    return () => tween.kill();
  }, [value, delay, inactive]);

  const arcPath = `M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`;

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        <path
          d={arcPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeDasharray={inactive ? '4 5' : undefined}
        />

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const angle = Math.PI + t * Math.PI;
          const inner = arcR - size * 0.035;
          const outer = arcR - (t === 0 || t === 0.5 || t === 1 ? size * 0.09 : size * 0.06);
          return (
            <line
              key={t}
              x1={cx + Math.cos(angle) * inner}
              y1={cy + Math.sin(angle) * inner}
              x2={cx + Math.cos(angle) * outer}
              y2={cy + Math.sin(angle) * outer}
              stroke={strokeColor}
              strokeWidth="1.5"
              opacity={inactive ? 0.3 : 0.5}
            />
          );
        })}

        <g ref={needleGroupRef} transform={`translate(${cx} ${cy})`}>
          <line
            x1={0}
            y1={0}
            x2={-needleLen}
            y2={0}
            stroke={accent}
            strokeWidth={size * 0.018}
            strokeLinecap="round"
          />
        </g>

        <circle cx={cx} cy={cy} r={size * 0.022} fill={strokeColor} />

        <line
          x1={cx - arcR * 0.5}
          y1={cy + size * 0.035}
          x2={cx + arcR * 0.5}
          y2={cy + size * 0.035}
          stroke={strokeColor}
          strokeWidth="1.5"
          opacity={inactive ? 0.3 : 0.5}
        />
      </svg>
      <GaugeValueOverlay
        size={size}
        inactive={inactive}
        level={level}
        reading={reading}
        status={status}
        inset={0.05}
      />
    </GaugeFrame>
  );
}

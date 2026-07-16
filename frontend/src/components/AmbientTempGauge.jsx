import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  gaugeCanvas,
  useGaugeLevel,
  GaugeFrame,
  GaugeValueOverlay,
} from './gaugeUtils';

const MERCURY_COLOR = '#EA580C';

export default function AmbientTempGauge({
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
  const sunRef = useRef(null);
  const level = useGaugeLevel(value, delay, inactive);
  const c = gaugeCanvas(size, 0.1);

  const bulbR = size * 0.09;
  const tubeH = size * 0.09;
  const tubeLeft = c.x + bulbR * 2.2;
  const tubeRight = c.x + c.w - size * 0.04;
  const tubeW = tubeRight - tubeLeft;
  const cy = c.y + c.h * 0.72;
  const bulbCx = c.x + bulbR * 1.3;
  const clipId = useRef(`amb-${Math.random().toString(36).slice(2)}`).current;

  const sunCx = c.x + c.w * 0.82;
  const sunCy = c.y + c.h * 0.22;
  const sunR = size * 0.065;

  useEffect(() => {
    if (inactive || !sunRef.current) return undefined;

    const tween = gsap.to(sunRef.current, {
      rotation: 12,
      duration: 5,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      transformOrigin: `${sunCx}px ${sunCy}px`,
    });

    return () => tween.kill();
  }, [inactive, sunCx, sunCy]);

  const mercuryW = tubeW * (level / 100);
  const strokeColor = inactive ? '#D4D4D4' : '#0A0A0A';
  const mercury = inactive ? '#D4D4D4' : status?.color ?? MERCURY_COLOR;

  return (
    <GaugeFrame label={label} size={size} inactive={inactive}>
      <svg width={size} height={size}>
        <defs>
          <clipPath id={clipId}>
            <rect x={tubeLeft} y={cy - tubeH / 2} width={tubeW} height={tubeH} rx={tubeH / 2} />
            <circle cx={bulbCx} cy={cy} r={bulbR} />
          </clipPath>
        </defs>

        <g ref={sunRef} opacity={inactive ? 0.3 : 0.9}>
          <circle cx={sunCx} cy={sunCy} r={sunR} fill={mercury} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={sunCx + Math.cos(rad) * (sunR + size * 0.012)}
                y1={sunCy + Math.sin(rad) * (sunR + size * 0.012)}
                x2={sunCx + Math.cos(rad) * (sunR + size * 0.034)}
                y2={sunCy + Math.sin(rad) * (sunR + size * 0.034)}
                stroke={mercury}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        <g clipPath={`url(#${clipId})`}>
          <circle cx={bulbCx} cy={cy} r={bulbR} fill={mercury} />
          {!inactive && mercuryW > 0 && (
            <rect x={tubeLeft} y={cy - tubeH / 2} width={mercuryW} height={tubeH} fill={mercury} />
          )}
        </g>

        <rect
          x={tubeLeft}
          y={cy - tubeH / 2}
          width={tubeW}
          height={tubeH}
          rx={tubeH / 2}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeDasharray={inactive ? '4 5' : undefined}
        />
        <circle
          cx={bulbCx}
          cy={cy}
          r={bulbR}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeDasharray={inactive ? '4 5' : undefined}
        />

        {!inactive && Number.isFinite(min) && Number.isFinite(max) && (
          <>
            <text
              x={tubeLeft}
              y={cy + tubeH + size * 0.07}
              fontSize={size * 0.065}
              fill="#0A0A0A"
              opacity="0.45"
              fontWeight="500"
            >
              {min}°
            </text>
            <text
              x={tubeRight - size * 0.05}
              y={cy + tubeH + size * 0.07}
              fontSize={size * 0.065}
              fill="#0A0A0A"
              opacity="0.45"
              fontWeight="500"
            >
              {max}°
            </text>
          </>
        )}
      </svg>
      <GaugeValueOverlay
        size={size}
        inactive={inactive}
        level={level}
        reading={reading}
        status={status}
        inset={0.08}
      />
    </GaugeFrame>
  );
}

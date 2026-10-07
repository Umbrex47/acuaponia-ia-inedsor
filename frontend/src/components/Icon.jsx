export const Icon = {
  Arrow: ({ dir = 'left', className = '' }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: dir === 'right' ? 'scaleX(-1)' : 'none' }}
      width="20"
      height="20"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Refresh: ({ className = '' }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width="20"
      height="20"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Close: ({ className = '' }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width="22"
      height="22"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Chip: ({ className = '' }) => (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <rect
        x="14"
        y="14"
        width="36"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect
        x="24"
        y="24"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="3"
      />
      {[...Array(6)].map((_, i) => (
        <line
          key={'t' + i}
          x1={20 + i * 4.5}
          y1="6"
          x2={20 + i * 4.5}
          y2="14"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <line
          key={'b' + i}
          x1={20 + i * 4.5}
          y1="50"
          x2={20 + i * 4.5}
          y2="58"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <line
          key={'l' + i}
          x1="6"
          y1={20 + i * 4.5}
          x2="14"
          y2={20 + i * 4.5}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <line
          key={'r' + i}
          x1="50"
          y1={20 + i * 4.5}
          x2="58"
          y2={20 + i * 4.5}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  ),
  Thermo: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Drop: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2.5s7 7.6 7 12.2a7 7 0 1 1-14 0C5 10.1 12 2.5 12 2.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  pH: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2.5s7 7.6 7 12.2a7 7 0 1 1-14 0C5 10.1 12 2.5 12 2.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill="currentColor"
      >
        pH
      </text>
    </svg>
  ),
  O2: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="white"
      >
        O₂
      </text>
    </svg>
  ),
  Camera: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Fish: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="11" r="1" fill="currentColor" />
    </svg>
  ),
  Leaf: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M11 20A7 7 0 0 1 4 13c0-7 9-9 16-9 0 7-2 16-9 16z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M2 22c4-6 9-9 16-12" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Sensors: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 12a10 10 0 0 1 20 0M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  Turbidity: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2.5s7 7.6 7 12.2a7 7 0 1 1-14 0C5 10.1 12 2.5 12 2.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="14" r="1" fill="currentColor" />
      <circle cx="13.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="13" cy="16" r="1" fill="currentColor" />
      <circle cx="10" cy="17.5" r="0.8" fill="currentColor" />
    </svg>
  ),
  Cloud: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Check: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <polyline
        points="20 6 9 17 4 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Alert: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <line
        x1="12"
        y1="6"
        x2="12"
        y2="14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
    </svg>
  ),
  Dash: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <line
        x1="6"
        y1="12"
        x2="18"
        y2="12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Chevron: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <polyline
        points="6 9 12 15 18 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  CheckCircle: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  AlertTriangle: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  AlertOctagon: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Zap: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Sparkles: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  ),
  Sliders: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  Flame: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
    </svg>
  ),
  Filter: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Beaker: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M4.5 3h15" />
      <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
      <path d="M6 14h12" />
    </svg>
  ),
  Shield: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Activity: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  FileText: ({ className = '' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  StatusDot: ({ status = 'optimal', className = 'w-2.5 h-2.5' }) => {
    const color =
      status === 'optimal' || status === 'normal' || status === 'ok' || status === 'healthy' || status === 'active'
        ? 'bg-emerald-500 ring-emerald-500/30'
        : status === 'warning' || status === 'atencion' || status === 'caution' || status === 'nutrient_deficient' || status === 'calm'
        ? 'bg-amber-500 ring-amber-500/30'
        : 'bg-rose-500 ring-rose-500/30';
    return (
      <span className={`inline-block rounded-full ring-2 shrink-0 ${color} ${className}`} />
    );
  },
};

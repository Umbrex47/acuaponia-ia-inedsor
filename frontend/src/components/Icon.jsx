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
};

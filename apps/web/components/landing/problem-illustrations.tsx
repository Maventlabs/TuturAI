const svgProps = {
  viewBox: '0 0 200 140',
  fill: 'none',
  'aria-hidden': true,
  className: 'h-full w-full',
} as const

const frame = {
  x: 16,
  y: 14,
  width: 168,
  height: 112,
  rx: 10,
  fill: 'var(--color-card)',
  stroke: 'var(--color-border)',
  strokeWidth: 1.5,
} as const

export function MuteIllustration() {
  return (
    <svg {...svgProps}>
      <rect {...frame} />
      <line x1="16" y1="38" x2="184" y2="38" stroke="var(--color-border)" strokeWidth="1.5" />
      <circle cx="30" cy="26" r="4.5" fill="var(--color-primary)" />
      <rect x="40" y="23" width="34" height="6" rx="3" fill="var(--color-border)" />

      <rect
        x="28"
        y="50"
        width="86"
        height="30"
        rx="9"
        fill="var(--color-secondary)"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={50 + i * 14}
          cy="65"
          r="3.5"
          fill="var(--color-muted-foreground)"
          className="illo-anim"
          style={{ animation: 'illo-dot 1.4s ease-in-out infinite', animationDelay: `${i * 0.18}s` }}
        />
      ))}

      <circle
        cx="152"
        cy="98"
        r="16"
        fill="var(--color-secondary)"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <rect x="149" y="88" width="6" height="12" rx="3" fill="var(--color-muted-foreground)" />
      <path
        d="M145 97a7 7 0 0 0 14 0"
        stroke="var(--color-muted-foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="141"
        y1="110"
        x2="163"
        y2="86"
        stroke="var(--color-card)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="141"
        y1="110"
        x2="163"
        y2="86"
        stroke="var(--color-muted-foreground)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AnxietyIllustration() {
  return (
    <svg {...svgProps}>
      <rect {...frame} />
      <rect x="30" y="28" width="40" height="6" rx="3" fill="var(--color-border)" />
      <rect x="30" y="40" width="22" height="6" rx="3" fill="var(--color-border)" />

      <path
        d="M30 82h18l6-16 8 30 7-22 5 8h20l6-12 7 20 6-8h30"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="260"
        className="illo-anim"
        style={{ animation: 'illo-draw 2.8s ease-in-out infinite' }}
      />

      <rect x="30" y="106" width="140" height="6" rx="3" fill="var(--color-secondary)" />
      <rect x="30" y="106" width="104" height="6" rx="3" fill="var(--color-primary)" />
    </svg>
  )
}

export function CrowdedIllustration() {
  const seats = Array.from({ length: 25 }, (_, i) => ({
    cx: 40 + (i % 5) * 30,
    cy: 40 + Math.floor(i / 5) * 18,
    teacher: i === 0,
  }))

  return (
    <svg {...svgProps}>
      <rect {...frame} />
      {seats.map((seat, i) => (
        <circle
          key={i}
          cx={seat.cx}
          cy={seat.cy}
          r={seat.teacher ? 6 : 4}
          fill={seat.teacher ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
          opacity={seat.teacher ? 1 : 0.3}
        />
      ))}
      <circle
        cx="40"
        cy="40"
        r="6"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        className="illo-anim"
        style={{
          animation: 'pulse-ring 2.4s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
          transformBox: 'fill-box',
          transformOrigin: 'center',
        }}
      />
    </svg>
  )
}

export function OfflineIllustration() {
  return (
    <svg {...svgProps}>
      <rect {...frame} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={44 + i * 16}
          y={92 - (i + 1) * 14}
          width="10"
          height={(i + 1) * 14}
          rx="3"
          fill="var(--color-primary)"
          className="illo-anim"
          style={{
            animation: 'illo-signal 2.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <line
        x1="40"
        y1="100"
        x2="120"
        y2="34"
        stroke="var(--color-card)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="100"
        x2="120"
        y2="34"
        stroke="var(--color-muted-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="132"
        y="60"
        width="36"
        height="10"
        rx="5"
        fill="var(--color-secondary)"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

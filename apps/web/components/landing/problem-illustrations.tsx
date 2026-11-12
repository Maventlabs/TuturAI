const svgProps = {
  viewBox: '0 0 200 140',
  fill: 'none',
  'aria-hidden': true,
  className: 'h-full w-full',
} as const

export function MuteIllustration() {
  return (
    <svg {...svgProps}>
      <path
        d="M40 30H160A10 10 0 0 1 170 40V88A10 10 0 0 1 160 98H92L74 114V98H40A10 10 0 0 1 30 88V40A10 10 0 0 1 40 30Z"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={72 + i * 11}
          y={52}
          width="5"
          height="26"
          rx="2.5"
          fill="var(--color-primary)"
          className="illo-anim"
          style={{
            animation: 'illo-bar 1.8s ease-in-out infinite',
            animationDelay: `${i * 0.14}s`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      ))}
      <line
        x1="48"
        y1="102"
        x2="152"
        y2="26"
        stroke="var(--color-card)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="48"
        y1="102"
        x2="152"
        y2="26"
        stroke="var(--color-muted-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AnxietyIllustration() {
  return (
    <svg {...svgProps}>
      <rect
        x="24"
        y="34"
        width="152"
        height="72"
        rx="10"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <line
        x1="40"
        y1="66"
        x2="160"
        y2="66"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
      />
      <path
        d="M40 66h24l8-18 10 36 8-18h30l8-14 8 28 8-14h16"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="260"
        className="illo-anim"
        style={{ animation: 'illo-draw 2.6s ease-in-out infinite' }}
      />
    </svg>
  )
}

export function CrowdedIllustration() {
  const dots = Array.from({ length: 36 }, (_, i) => ({
    cx: 40 + (i % 6) * 22,
    cy: 40 + Math.floor(i / 6) * 13,
    teacher: i === 0,
  }))

  return (
    <svg {...svgProps}>
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.teacher ? 5.5 : 3.5}
          fill={dot.teacher ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
          opacity={dot.teacher ? 1 : 0.35}
        />
      ))}
      <circle
        cx={40}
        cy={40}
        r="5.5"
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
      <path
        d="M56 34a60 60 0 0 1 88 0"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={62 + i * 20}
          y={92 - (i + 1) * 14}
          width="12"
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
    </svg>
  )
}

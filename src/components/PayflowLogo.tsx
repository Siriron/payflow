/** Payflow mark + wordmark */

interface IconProps { size?: number; className?: string }

/**
 * The Payflow mark.
 * A tight square with a stylised P whose descender ends in a small arc dot —
 * suggesting both payment and chain flow without being literal about either.
 */
export function PayflowMark({ size = 32, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#0f1c2e" />
      {/* P bowl */}
      <path
        d="M10 8h6.5a4.5 4.5 0 0 1 0 9H12"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* P stem continuing down */}
      <path
        d="M10 8v16"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Flow arc at stem bottom */}
      <path
        d="M10 24 q3 0 3 -3"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  )
}

export function PayflowWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`display font-bold tracking-[-0.04em] ${className}`}
      style={{ color: 'var(--ink)' }}
    >
      Payflow
    </span>
  )
}

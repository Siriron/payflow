import { motion } from 'framer-motion'

interface Props { children: React.ReactNode }

export default function PageShell({ children }: Props) {
  return (
    <div
      className="relative flex min-h-dvh items-start justify-center"
      style={{ background: 'var(--canvas)' }}
    >
      {/* Desktop: subtle dot-grid pattern behind the phone card */}
      <div
        className="pointer-events-none fixed inset-0 hidden md:block"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border-strong) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.45,
        }}
      />

      {/* Desktop: soft radial glow to lift the card */}
      <div
        className="pointer-events-none fixed inset-0 hidden md:block"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(20,97,166,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Phone card — full-width on mobile, constrained on desktop */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 w-full md:my-10 md:max-w-[420px]"
        style={{ background: 'var(--canvas)' }}
      >
        <div
          className="min-h-dvh w-full md:min-h-[600px] md:rounded-[40px] md:overflow-hidden"
          style={{
            background: 'var(--canvas)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
          }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}

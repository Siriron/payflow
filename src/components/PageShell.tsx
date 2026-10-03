/**
 * PageShell — single layout wrapper for every page.
 * Mobile: full-screen canvas.
 * Desktop: phone-card centered on the canvas (max-w 420px).
 * Blobs live here — rendered once per route, never duplicated.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

const variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as const } },
}

export default function PageShell({ children, className = '' }: Props) {
  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--canvas)' }}>
      <div className="bg-blobs" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col items-center md:justify-center md:py-10">
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`relative w-full flex-1 md:max-w-[420px] md:flex-none md:rounded-[28px] md:overflow-hidden md:shadow-[0_20px_60px_rgba(15,28,46,0.13),0_2px_8px_rgba(15,28,46,0.06)] ${className}`}
          style={{ background: 'var(--canvas)' }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}

export const fadeUp = variants

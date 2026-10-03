import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * One-shot splash screen.
 * Shows for one animation frame after mount, then fades out.
 * Driven by requestAnimationFrame — not a fixed timer.
 */
export default function Splash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Two rAFs: first paints the splash, second dismisses it after ~32ms
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        // Give the user a moment to register the brand
        const t = setTimeout(() => setVisible(false), 900)
        return () => clearTimeout(t)
      })
      return () => cancelAnimationFrame(id2)
    })
    return () => cancelAnimationFrame(id1)
  }, [])

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Ambient blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div style={{ position: 'absolute', top: '12%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.28) 0%, transparent 70%)', filter: 'blur(70px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', right: '8%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.26) 0%, transparent 70%)', filter: 'blur(65px)' }} />
          </div>

          <motion.div
            className="relative z-10 flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.52, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Logo mark */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="18" fill="#122d45" />
              <path d="M20 16h14a10 10 0 0 1 0 20H26v14" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="44" cy="48" r="4" fill="white" opacity="0.45" />
            </svg>

            <div className="text-center">
              <p
                className="display text-3xl font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
              >
                Payflow
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--subtle)' }}>
                Send USDC. We handle the chain.
              </p>
            </div>

            {/* Spectral strip as a loading indicator */}
            <motion.div
              className="mt-2 h-[3px] w-24 overflow-hidden rounded-full"
              style={{ background: 'rgba(18,45,69,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>

          <motion.p
            className="absolute bottom-8 text-xs"
            style={{ color: 'var(--subtle)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            Built on Arc Network
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

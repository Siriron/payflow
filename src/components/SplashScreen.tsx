import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PayflowMark, PayflowWordmark } from './PayflowLogo'

interface Props { onDone: () => void }

export default function SplashScreen({ onDone }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // One frame to paint, then start exit
    const id = requestAnimationFrame(() => {
      const t = setTimeout(() => {
        setVisible(false)
        setTimeout(onDone, 380)
      }, 820)
      return () => clearTimeout(t)
    })
    return () => cancelAnimationFrame(id)
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.4, 0, 0.6, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'var(--canvas)' }}
          aria-hidden="true"
        >
          <div className="bg-blobs" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 flex flex-col items-center gap-4"
          >
            <PayflowMark size={52} />
            <PayflowWordmark className="text-2xl" />
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="absolute bottom-12 left-1/2 h-[2px] w-16 -translate-x-1/2 overflow-hidden rounded-full"
            style={{ background: 'var(--border)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)' }}
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.72, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { PaymentIntent } from '@/lib/intent'

interface Props {
  intent: PaymentIntent
  onResume: () => void
}

export default function IntentStatusBanner({ intent, onResume }: Props) {
  const [dismissed, setDismissed] = useState(false)

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <div
            className="flex items-center gap-3 rounded-[16px] px-4 py-3.5"
            style={{
              background: 'var(--warning-bg)',
              border: '1px solid rgba(180,83,9,0.16)',
            }}
            role="alert"
          >
            {/* Warning dot */}
            <motion.span
              className="size-2 rounded-full shrink-0"
              style={{ background: 'var(--warning)' }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>
                Payment needs attention
              </p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {intent.amount} USDC · {intent.recipient.slice(0, 10)}…{intent.recipient.slice(-4)}
              </p>
            </div>

            <button
              type="button"
              onClick={onResume}
              className="shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold text-white transition-all active:scale-95"
              style={{ background: 'var(--warning)' }}
              aria-label="Resume payment"
            >
              Resume
            </button>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex size-7 shrink-0 items-center justify-center rounded-[9px] transition-all active:scale-95"
              style={{ background: 'rgba(180,83,9,0.10)', color: 'var(--warning)' }}
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

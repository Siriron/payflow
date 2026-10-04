import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import type { EIP1193Provider } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, AlertCircle } from 'lucide-react'
import { loadIntent, type PaymentIntent, type IntentState } from '@/lib/intent'
import { executeTransfer, retryTransfer } from '@/lib/kit'
import { ACTIVE_ARC_CHAIN } from '@/config'

const STEPS = [
  { key: 'preparing',  label: 'Preparing' },
  { key: 'wallet',     label: 'Waiting for wallet' },
  { key: 'sending',    label: 'Sending USDC' },
  { key: 'settling',   label: 'Settling on Arc' },
  { key: 'complete',   label: 'Complete' },
] as const

function getStepIndex(state: IntentState): number {
  if (['draft', 'quoting', 'ready'].includes(state)) return 0
  if (state === 'awaiting_signature') return 1
  if (state === 'submitted') return 2
  if (state === 'settling') return 3
  if (state === 'completed') return 4
  return 0
}

export default function Progress() {
  const navigate = useNavigate()
  const location = useLocation()
  const { connector } = useAccount()

  const intentId = (location.state as { intentId?: string; resuming?: boolean })?.intentId
  const resuming  = (location.state as { resuming?: boolean })?.resuming ?? false

  const [intent, setIntent] = useState<PaymentIntent | null>(() =>
    intentId ? loadIntent(intentId) : null,
  )
  const [error, setError] = useState<string | null>(null)
  const startedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!intent) { void navigate('/') }
  }, [intent, navigate])

  useEffect(() => {
    if (!intent || !connector) return
    const key = `${intent.id}::${connector.uid}`
    if (startedKey.current === key) return
    startedKey.current = key

    const run = async () => {
      let provider: EIP1193Provider
      try {
        provider = (await connector.getProvider()) as EIP1193Provider
      } catch {
        setError('Could not connect to wallet.')
        return
      }
      const fn = resuming && intent.state === 'recoverable' ? retryTransfer : executeTransfer
      const result = await fn({
        intent,
        provider,
        useMainnet: ACTIVE_ARC_CHAIN.id === 5042,
      })

      const updated = loadIntent(intent.id)
      if (updated) setIntent(updated)

      if (result.success) {
        void navigate('/receipt', { state: { intentId: intent.id } })
      } else {
        const final = loadIntent(intent.id)
        if (final?.state === 'cancelled') {
          void navigate('/')
        } else {
          setError(result.error)
        }
      }
    }
    void run()
  }, [intent, connector, resuming, navigate])

  if (!intent) return null

  const activeStep = getStepIndex(intent.state)
  const isFailed = intent.state === 'failed' || intent.state === 'recoverable'

  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--canvas)' }}>
      <div className="bg-blobs" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh items-end justify-center md:items-center md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full md:max-w-[420px]"
        >
          <div className="glass-sheet overflow-hidden rounded-t-[28px] md:rounded-[28px] shadow-[0_-4px_40px_rgba(15,28,46,0.08)]">
            {/* State-driven top strip */}
            <div
              className="h-[3px]"
              style={{ background: isFailed ? 'var(--danger)' : 'var(--spectral)' }}
            />

            <div className="px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 md:pb-8">

              <h1
                className="display mb-1 text-xl font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
              >
                {isFailed ? 'Payment needs attention' : 'Processing payment'}
              </h1>
              <p className="mb-6 text-sm" style={{ color: 'var(--subtle)' }}>
                {isFailed
                  ? 'Your funds are safe and the payment can be resumed.'
                  : 'Keep this window open until complete.'}
              </p>

              {/* ARIA live region */}
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {isFailed
                  ? 'Payment needs attention and can be resumed.'
                  : `Current step: ${STEPS[activeStep]?.label ?? 'Processing'}`}
              </p>

              {/* Steps */}
              <ol className="space-y-1" aria-label="Payment progress">
                {STEPS.map((step, i) => {
                  const done   = i < activeStep
                  const active = i === activeStep && !isFailed
                  const failed = isFailed && i === activeStep

                  return (
                    <motion.li
                      key={step.key}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.22 }}
                      className="flex items-center gap-3.5 rounded-[13px] px-3.5 py-3"
                      style={{
                        background: active
                          ? 'rgba(20,97,166,0.05)'
                          : done
                          ? 'transparent'
                          : 'transparent',
                      }}
                    >
                      {/* Icon */}
                      <span className="shrink-0 size-5 flex items-center justify-center">
                        {done ? (
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                          >
                            <Check className="size-[14px]" strokeWidth={3} style={{ color: 'var(--success)' }} />
                          </motion.span>
                        ) : active ? (
                          /* Pulsing dot — signals live activity without spinning text */
                          <motion.span
                            className="size-2 rounded-full"
                            style={{ background: 'var(--accent)' }}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        ) : failed ? (
                          <AlertCircle className="size-[14px]" style={{ color: 'var(--danger)' }} />
                        ) : (
                          <Circle className="size-[14px]" style={{ color: 'rgba(15,28,46,0.18)' }} />
                        )}
                      </span>

                      {/* Label */}
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: done
                            ? 'var(--success)'
                            : active
                            ? 'var(--ink)'
                            : failed
                            ? 'var(--danger)'
                            : 'var(--subtle)',
                        }}
                      >
                        {step.label}
                      </span>
                    </motion.li>
                  )
                })}
              </ol>

              {/* Error / recovery */}
              <AnimatePresence>
                {isFailed && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 space-y-2.5"
                  >
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                      {error ?? 'Payment needs attention. It can be resumed.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => { void navigate('/') }}
                      className="btn-secondary"
                    >
                      Check status
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

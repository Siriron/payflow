import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccount, useSwitchChain, useConfig } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { loadIntent, type PaymentIntent } from '@/lib/intent'
import { requireChain } from '@/onchain-facts'
import { ACTIVE_ARC_CHAIN } from '@/config'

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation()
  const { address, chainId: walletChainId, connector } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const wagmiConfig = useConfig()

  const intentId = (location.state as { intentId?: string })?.intentId
  const [intent] = useState<PaymentIntent | null>(() =>
    intentId ? loadIntent(intentId) : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRoute, setShowRoute] = useState(false)

  useEffect(() => {
    if (!intent) { void navigate('/') }
  }, [intent, navigate])

  if (!intent) return null

  const sourceChainName = (() => {
    try { return requireChain(intent.sourceChainId).name } catch { return intent.sourceChain }
  })()

  const handleConfirm = async () => {
    if (!connector || !address || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (walletChainId !== intent.sourceChainId) {
        const target = wagmiConfig.chains.find((c) => c.id === intent.sourceChainId)
        if (target) await switchChainAsync({ chainId: target.id })
      }
      void navigate('/progress', { state: { intentId: intent.id } })
    } catch {
      setError('Could not switch network. Please switch manually in your wallet.')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--canvas)' }}>
      <div className="flex min-h-dvh items-end justify-center md:items-center md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full md:max-w-[420px]"
        >
          <div
            className="overflow-hidden rounded-t-[32px] md:rounded-[32px]"
            style={{ background: 'var(--surface-high)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
          >
            {/* Spectral strip — signals this is the commit surface */}
            <div className="spectral-strip" />

            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
              <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(15,28,46,0.12)' }} />
            </div>

            <div className="px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 md:pb-8">

              {/* Header */}
              <div className="mb-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { void navigate('/send') }}
                  className="glass flex items-center gap-1.5 rounded-[14px] px-3 py-2.5 transition-all active:scale-95"
                  aria-label="Back"
                >
                  <ChevronLeft className="size-4" style={{ color: 'var(--ink)' }} />
                  <span className="hidden text-[13px] font-semibold md:block" style={{ color: 'var(--ink)' }}>Back</span>
                </button>
                <h1
                  className="display text-xl font-bold"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
                >
                  Review payment
                </h1>
              </div>

              {/* Amount — with source chain label */}
              <div
                className="mb-4 rounded-[18px] px-5 py-4"
                style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)' }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.10em]"
                    style={{ color: 'var(--muted)' }}
                  >
                    You send
                  </p>
                  <span
                    className="rounded-[7px] px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(15,28,46,0.06)', color: 'var(--subtle)' }}
                  >
                    from {sourceChainName}
                  </span>
                </div>
                <p
                  className="display text-4xl font-bold tabular-nums"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
                >
                  {intent.amount}
                  <span className="ml-2 text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </p>
              </div>

              {/* Detail rows */}
              <div
                className="divide-y rounded-[18px] overflow-hidden"
                style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}
              >
                <Row
                  label="Recipient receives"
                  value={intent.recipientAmount ? `${intent.recipientAmount} USDC` : `≈${intent.amount} USDC`}
                />
                <Row
                  label="Network fee"
                  value={intent.estimatedFee ? `${intent.estimatedFee} USDC` : 'Included in route'}
                />
                <Row label="Destination" value={ACTIVE_ARC_CHAIN.name} />
                <div className="px-4 py-3">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--muted)' }}>To</p>
                  <p className="mono break-all text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {intent.recipient}
                  </p>
                </div>
              </div>

              {/* Route details toggle */}
              <button
                type="button"
                onClick={() => setShowRoute((v) => !v)}
                className="mt-2 flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-[12px] font-medium transition-all active:scale-[0.99]"
                style={{ color: 'var(--subtle)' }}
              >
                Route details
                {showRoute ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              <AnimatePresence initial={false}>
                {showRoute && (
                  <motion.div
                    key="route"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="space-y-1.5 rounded-[14px] px-4 py-3 text-[12px]"
                      style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)' }}
                    >
                      <RouteRow label="Source" value={sourceChainName} />
                      <RouteRow label="Method" value="Circle CCTP" />
                      <RouteRow label="Settlement" value={ACTIVE_ARC_CHAIN.name} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--danger)' }} role="alert">
                  {error}
                </p>
              )}

              {/* CTA — with irreversibility signal */}
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => { void handleConfirm() }}
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <><Loader2 className="size-4 animate-spin" /> Preparing…</>
                  ) : (
                    'Confirm payment'
                  )}
                </button>
                <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
                  Payflow charges no fees · A small relay fee may apply to the transfer
                </p>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function RouteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>{value}</span>
    </div>
  )
}

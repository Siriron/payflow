import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react'
import { loadIntent, type PaymentIntent } from '@/lib/intent'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ACTIVE_ARC_CHAIN } from '@/config'
import { markRequestPaid } from '@/lib/requests'

export default function Receipt() {
  const navigate = useNavigate()
  const location = useLocation()
  const intentId = (location.state as { intentId?: string })?.intentId
  const [copied, setCopied] = useState(false)

  const [intent] = useState<PaymentIntent | null>(() => {
    if (!intentId) return null
    const loaded = loadIntent(intentId)
    if (!loaded || loaded.state !== 'completed') return null
    return loaded
  })

  // Mark request paid — in effect, not in render
  useEffect(() => {
    if (intent?.requestId && intent.destinationTxHash) {
      markRequestPaid(intent.requestId, intent.destinationTxHash, intent.payer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // stable on mount

  const receiptText = [
    'Payflow Receipt',
    intent ? `Amount: ${intent.amount} USDC` : '',
    intent ? `To: ${intent.recipient}` : '',
    `Network: ${ACTIVE_ARC_CHAIN.name}`,
    intent?.destinationTxHash ? `Tx: ${intent.destinationTxHash}` : '',
    intent ? `Date: ${new Date(intent.updatedAt).toLocaleString()}` : '',
  ].filter(Boolean).join('\n')

  const copyReceipt = useCallback(() => {
    void navigator.clipboard.writeText(receiptText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    })
  }, [receiptText])

  useEffect(() => {
    if (!intent) { void navigate('/') }
  }, [intent, navigate])

  if (!intent) return null

  const explorerUrl = intent.destinationTxHash
    ? buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, intent.destinationTxHash)
    : null

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

            {/* Success top strip */}
            <div className="h-[3px]" style={{ background: 'var(--success)' }} />

            <div className="px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-7 md:pb-8">

              {/* Check + title */}
              <div className="mb-5 flex items-start gap-4">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 26, delay: 0.06 }}
                  className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: 'var(--success-bg)' }}
                >
                  <CheckCircle2 className="size-6" style={{ color: 'var(--success)' }} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.24 }}
                >
                  <h1
                    className="display text-xl font-bold"
                    style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
                  >
                    Payment complete.
                  </h1>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Recipient received the payment on Arc.
                  </p>
                </motion.div>
              </div>

              {/* Amount */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.24 }}
                className="mb-4 rounded-[18px] px-5 py-4"
                style={{ background: 'var(--success-bg)', border: '1px solid rgba(26,128,71,0.14)' }}
              >
                <p
                  className="display text-4xl font-bold tabular-nums"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
                >
                  {intent.amount}
                  <span className="ml-2 text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </p>
              </motion.div>

              {/* Receipt rows */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.24 }}
                className="mb-5 divide-y rounded-[18px] overflow-hidden"
                style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)' }}
              >
                <ReceiptRow
                  label="To"
                  value={`${intent.recipient.slice(0, 10)}…${intent.recipient.slice(-6)}`}
                  mono
                />
                <ReceiptRow label="Network" value={ACTIVE_ARC_CHAIN.name} />
                {intent.destinationTxHash && (
                  <ReceiptRow
                    label="Transaction"
                    value={`${intent.destinationTxHash.slice(0, 10)}…${intent.destinationTxHash.slice(-6)}`}
                    mono
                  />
                )}
                <ReceiptRow
                  label="Date"
                  value={new Date(intent.updatedAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                />
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.24 }}
                className="space-y-2.5"
              >
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                  >
                    View on explorer
                    <ExternalLink className="size-[15px]" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyReceipt}
                  className="btn-secondary"
                  style={copied ? { color: 'var(--success)', borderColor: 'rgba(26,128,71,0.25)' } : {}}
                >
                  {copied
                    ? <><Check className="size-[15px]" /> Copied</>
                    : <><Copy className="size-[15px]" /> Copy receipt</>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => { void navigate('/') }}
                  className="btn-ghost w-full"
                >
                  Back to home
                </button>
              </motion.div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className={`text-[12px] font-semibold ${mono ? 'mono' : 'tabular-nums'}`}
        style={{ color: 'var(--ink-2)' }}
      >
        {value}
      </span>
    </div>
  )
}

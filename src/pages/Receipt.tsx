import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { ExternalLink, Copy, Check, Link as LinkIcon } from 'lucide-react'
import { loadIntent, type PaymentIntent } from '@/lib/intent'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ACTIVE_ARC_CHAIN } from '@/config'
import { markRequestPaid } from '@/lib/requests'
import { isDirectArcIntent } from '@/lib/kit'
import { verifyArcPayment } from '@/lib/verify'
import { parseUsdc, formatUsdc } from '@/onchain-money'
import PageShell from '@/components/PageShell'

/** Animated amount count-up for receipt */
function ReceiptAmount({ value }: { value: string }) {
  const numeric = parseFloat(value.replace(/,/g, '')) || 0
  const motionVal = useMotionValue(0)
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 2) : 2
  const display = useTransform(motionVal, (v) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  )
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    motionVal.set(0)
    const ctrl = animate(motionVal, numeric, {
      duration: 1.1,
      delay: 0.55,
      ease: [0.16, 1, 0.3, 1],
    })
    return ctrl.stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.span
      className="display font-bold tabular-nums"
      style={{ letterSpacing: '-0.04em', fontSize: 'clamp(32px, 9vw, 44px)', color: 'var(--ink)' }}
    >
      {display}
    </motion.span>
  )
}

/** Premium animated checkmark — circle draws in, tick draws in, then pulses */
function SuccessMark() {
  return (
    <div className="relative flex flex-col items-center">
      {/* Outer glow ring */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-center rounded-full"
        style={{
          width: 96,
          height: 96,
          background: 'radial-gradient(circle, rgba(22,163,74,0.18) 0%, rgba(22,163,74,0.06) 60%, transparent 100%)',
        }}
      >
        {/* Inner circle */}
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 68,
            height: 68,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            boxShadow: '0 8px 32px rgba(22,163,74,0.4)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <motion.path
              d="M8 16.5L13.5 22L24 11"
              stroke="white"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.42, ease: 'easeOut', delay: 0.32 }}
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* Ripple effect */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        className="absolute inset-0 rounded-full"
        style={{ background: 'rgba(22,163,74,0.2)' }}
        aria-hidden="true"
      />
    </div>
  )
}

export default function Receipt() {
  const navigate = useNavigate()
  const location = useLocation()
  const intentId = (location.state as { intentId?: string })?.intentId
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [settled, setSettled] = useState<{ received: string; fee: string | null } | null>(null)

  const [intent] = useState<PaymentIntent | null>(() => {
    if (!intentId) return null
    const loaded = loadIntent(intentId)
    if (!loaded || loaded.state !== 'completed') return null
    return loaded
  })

  useEffect(() => {
    if (intent?.requestId && intent.destinationTxHash) {
      markRequestPaid(intent.requestId, intent.destinationTxHash, intent.payer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const copyVerifiedLink = useCallback(() => {
    if (!intent?.destinationTxHash) return
    const url = `${window.location.origin}/p/${intent.destinationTxHash}?to=${intent.recipient}`
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2400)
    })
  }, [intent])

  // Bridged payments: read what the recipient actually received from Arc.
  // (The relay fee is deducted on arrival, so this can be less than the amount sent.)
  useEffect(() => {
    if (!intent?.destinationTxHash || isDirectArcIntent(intent)) return
    let cancelled = false
    void verifyArcPayment(intent.destinationTxHash).then((r) => {
      if (cancelled || r.status !== 'confirmed') return
      const mine = r.transfers.filter((t) => t.to.toLowerCase() === intent.recipient.toLowerCase())
      if (mine.length === 0) return
      const receivedRaw = mine.reduce((sum, t) => sum + t.raw, 0n)
      let sentRaw: bigint
      try { sentRaw = parseUsdc(intent.amount) } catch { return }
      const feeRaw = sentRaw - receivedRaw
      setSettled({ received: formatUsdc(receivedRaw), fee: feeRaw > 0n ? formatUsdc(feeRaw) : null })
    })
    return () => { cancelled = true }
  }, [intent])

  useEffect(() => {
    if (!intent) { void navigate('/') }
  }, [intent, navigate])

  if (!intent) return null

  const explorerUrl = intent.destinationTxHash
    ? buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, intent.destinationTxHash)
    : null

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col items-center justify-end pb-[calc(2rem+env(safe-area-inset-bottom))] md:justify-center md:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full md:max-w-[420px] overflow-hidden rounded-t-[32px] md:rounded-[32px]"
          style={{
            background: 'var(--surface-high)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Success green top strip */}
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #16a34a, #22c55e, #16a34a)' }} />

          <div className="px-6 pb-6 pt-7">

            {/* Success mark centred */}
            <motion.div
              className="mb-5 flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <SuccessMark />
              <motion.h1
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48, duration: 0.26 }}
                className="display mt-4 text-center text-[22px] font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
              >
                Payment complete.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.58, duration: 0.24 }}
                className="mt-1 text-center text-[13px]"
                style={{ color: 'var(--muted)' }}
              >
                Recipient received the payment on Arc.
              </motion.p>
            </motion.div>

            {/* Amount in green tinted card with count-up */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.32, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="mb-4 flex items-center justify-between rounded-[18px] px-5 py-4"
              style={{
                background: 'linear-gradient(135deg, rgba(22,163,74,0.1) 0%, rgba(22,163,74,0.05) 100%)',
                border: '1px solid rgba(22,163,74,0.2)',
              }}
            >
              <div className="flex items-end gap-2">
                <ReceiptAmount value={intent.amount} />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.0 }}
                  className="mb-1 text-xl font-semibold"
                  style={{ color: 'var(--subtle)' }}
                >
                  USDC
                </motion.span>
              </div>
              <div
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'rgba(22,163,74,0.15)', color: '#16a34a' }}
              >
                Settled
              </div>
            </motion.div>

            {/* Receipt rows */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.26 }}
              className="mb-5 overflow-hidden rounded-[18px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <ReceiptRow
                label="To"
                value={`${intent.recipient.slice(0, 10)}…${intent.recipient.slice(-6)}`}
                mono
              />
              {settled && (
                <ReceiptRow label="Recipient received" value={`${settled.received} USDC`} />
              )}
              {settled?.fee && (
                <ReceiptRow label="Relay fee" value={`${settled.fee} USDC`} />
              )}
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.44, duration: 0.26 }}
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
                style={copied ? { color: 'var(--success)', borderColor: 'rgba(22,163,74,0.3)' } : {}}
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Check className="size-[15px]" /> Copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Copy className="size-[15px]" /> Copy receipt
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              {intent.destinationTxHash && (
                <button
                  type="button"
                  onClick={copyVerifiedLink}
                  className="btn-secondary"
                  style={linkCopied ? { color: 'var(--success)', borderColor: 'rgba(22,163,74,0.3)' } : {}}
                >
                  {linkCopied ? (
                    <span className="flex items-center gap-2"><Check className="size-[15px]" /> Link copied</span>
                  ) : (
                    <span className="flex items-center gap-2"><LinkIcon className="size-[15px]" /> Copy verified link</span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => { void navigate('/') }}
                className="btn-ghost w-full"
              >
                Back to home
              </button>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </PageShell>
  )
}

function ReceiptRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
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

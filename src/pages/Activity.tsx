import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'
import { loadAllIntents, type PaymentIntent, type IntentState } from '@/lib/intent'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ACTIVE_ARC_CHAIN } from '@/config'
import PageShell from '@/components/PageShell'
import { fetchArcUsdcTransfers, type ChainTransfer } from '@/lib/chainHistory'

const STATE_DOT: Partial<Record<IntentState, string>> = {
  completed:  'var(--success)',
  failed:     'var(--danger)',
  cancelled:  'rgba(15,28,46,0.25)',
  recoverable:'var(--warning)',
}
const STATE_LABEL: Record<IntentState, string> = {
  draft:              'Draft',
  quoting:            'Preparing',
  ready:              'Ready',
  awaiting_signature: 'Signing',
  submitted:          'Processing',
  settling:           'Settling',
  completed:          'Sent',
  recoverable:        'Needs attention',
  failed:             'Failed',
  cancelled:          'Cancelled',
}

export default function Activity() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [tick, setTick] = useState(0)
  const [chain, setChain] = useState<{ key: string; error: boolean; items: ChainTransfer[] } | null>(null)

  // Refresh on window focus — keeps list current if user sent in another tab
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const intents = useMemo(() => {
    return loadAllIntents().sort((a, b) => b.updatedAt - a.updatedAt)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // On-chain history for the connected wallet, read from the Arc Explorer.
  const chainKey = address ? `${address}:${tick}` : null
  useEffect(() => {
    if (!address || !chainKey) return
    const controller = new AbortController()
    fetchArcUsdcTransfers(address, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setChain({ key: chainKey, error: false, items }) })
      .catch(() => { if (!controller.signal.aborted) setChain({ key: chainKey, error: true, items: [] }) })
    return () => controller.abort()
  }, [address, chainKey])

  const chainLoading = !!chainKey && chain?.key !== chainKey
  // Payments already listed above (same Arc transaction) are not repeated in the on-chain list.
  const knownTxHashes = new Set(
    intents.flatMap((i) => [i.destinationTxHash, i.sourceTxHash]).filter((h): h is string => !!h).map((h) => h.toLowerCase()),
  )
  const chainItems = (chain && chain.key === chainKey ? chain.items : []).filter(
    (t) => !knownTxHashes.has(t.txHash.toLowerCase()),
  )

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 md:min-h-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { void navigate('/') }}
              className="glass flex size-10 items-center justify-center rounded-[14px] transition-all active:scale-95"
              aria-label="Back"
            >
              <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h1
                className="display text-xl font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
              >
                Activity
              </h1>
              <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                {intents.length === 0 ? 'No payments from this browser' : `${intents.length} payment${intents.length !== 1 ? 's' : ''} from this browser`}
              </p>
            </div>
          </div>

          {/* Manual refresh */}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="glass flex size-9 items-center justify-center rounded-[12px] transition-all active:scale-95"
            aria-label="Refresh"
          >
            <RefreshCw className="size-3.5" style={{ color: 'var(--muted)' }} />
          </button>
        </motion.div>

        {/* Empty state */}
        {intents.length === 0 && !address && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div
              className="flex size-14 items-center justify-center rounded-[18px]"
              style={{ background: 'rgba(15,28,46,0.05)' }}
            >
              <RefreshCw className="size-6" style={{ color: 'var(--muted)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No payments yet</p>
            <p className="max-w-[240px] text-xs" style={{ color: 'var(--subtle)' }}>
              Payments sent from this browser appear here. Connect your wallet to also see your USDC activity on Arc.
            </p>
            <button
              type="button"
              onClick={() => { void navigate('/send') }}
              className="mt-2 rounded-[13px] px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: 'var(--accent)' }}
            >
              Send USDC
            </button>
          </div>
        )}

        {/* Intent list */}
        {intents.length > 0 && (
          <motion.ol
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-2"
          >
            {intents.map((intent) => (
              <IntentRow key={intent.id} intent={intent} />
            ))}
          </motion.ol>
        )}

        {/* On-chain history */}
        {address && (
          <section className={intents.length > 0 ? 'mt-6' : ''}>
            <div className="mb-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
                On Arc · your USDC
              </p>
              <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                Read from Arc Explorer. Still here if you clear this browser, and includes payments you received.
              </p>
            </div>

            {chainLoading && (
              <div className="space-y-2" aria-busy="true">
                {[0, 1].map((n) => (
                  <div key={n} className="h-[68px] animate-pulse rounded-[16px]" style={{ background: 'var(--border)' }} />
                ))}
              </div>
            )}

            {!chainLoading && chain?.error && (
              <p className="rounded-[14px] px-4 py-3 text-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                Couldn&apos;t load on-chain activity right now. Tap refresh to try again.
              </p>
            )}

            {!chainLoading && chain && !chain.error && chainItems.length === 0 && (
              <p className="rounded-[14px] px-4 py-3 text-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                {intents.length > 0 ? 'No other USDC transfers found for this wallet on Arc.' : 'No USDC transfers found for this wallet on Arc yet.'}
              </p>
            )}

            {!chainLoading && chainItems.length > 0 && (
              <ol className="space-y-2">
                {chainItems.map((t) => (
                  <ChainRow key={`${t.txHash}-${t.direction}-${t.amount}`} transfer={t} me={address} />
                ))}
              </ol>
            )}
          </section>
        )}

      </div>
    </PageShell>
  )
}

function ChainRow({ transfer, me }: { transfer: ChainTransfer; me: string }) {
  const navigate = useNavigate()
  const received = transfer.direction === 'received'
  const explorerUrl = buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, transfer.txHash)
  const payee = received ? me : transfer.counterparty
  const verifiedPath = `/p/${transfer.txHash}${payee ? `?to=${payee}` : ''}`

  return (
    <li
      className="overflow-hidden rounded-[16px]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: received ? 'var(--success)' : 'rgba(15,28,46,0.35)' }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="display text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {received ? '+' : '−'}{transfer.amount}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--subtle)' }}> USDC</span>
            </p>
            <span className="shrink-0 text-[11px] font-semibold" style={{ color: received ? 'var(--success)' : 'var(--muted)' }}>
              {received ? 'Received' : 'Sent'}
            </span>
          </div>
          <p className="mono mt-0.5 truncate text-[11px]" style={{ color: 'var(--muted)' }}>
            {transfer.isMint
              ? 'Cross-chain payment'
              : `${received ? 'from' : 'to'} ${transfer.counterparty?.slice(0, 10)}…${transfer.counterparty?.slice(-4)}`}
          </p>
          {transfer.timestamp !== null && (
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--subtle)' }}>
              {new Date(transfer.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 border-t px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => { void navigate(verifiedPath) }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-semibold transition-all active:scale-95"
          style={{ background: 'rgba(15,28,46,0.04)', color: 'var(--ink-2)' }}
        >
          <ShieldCheck className="size-3" />
          Verify
        </button>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-semibold transition-all active:scale-95"
          style={{ background: 'rgba(15,28,46,0.04)', color: 'var(--ink-2)' }}
        >
          <ExternalLink className="size-3" />
          Explorer
        </a>
      </div>
    </li>
  )
}

function IntentRow({ intent }: { intent: PaymentIntent }) {
  const navigate = useNavigate()
  const dotColor = STATE_DOT[intent.state] ?? 'rgba(15,28,46,0.20)'
  const label = STATE_LABEL[intent.state]
  const isActive = ['quoting', 'awaiting_signature', 'submitted', 'settling'].includes(intent.state)
  const explorerUrl = intent.destinationTxHash
    ? buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, intent.destinationTxHash)
    : null
  const canResume = intent.state === 'recoverable'

  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.20 } } }}
      className="rounded-[16px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Status dot */}
        <motion.span
          className="size-1.5 rounded-full shrink-0"
          style={{ background: dotColor }}
          animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={isActive ? { duration: 1.4, repeat: Infinity } : {}}
        />

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className="display text-[15px] font-bold tabular-nums"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {intent.amount}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--subtle)' }}> USDC</span>
            </p>
            <span className="text-[11px] font-semibold shrink-0" style={{ color: dotColor }}>
              {label}
            </span>
          </div>
          <p className="mono mt-0.5 truncate text-[11px]" style={{ color: 'var(--muted)' }}>
            {intent.recipient.slice(0, 12)}…{intent.recipient.slice(-4)}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: 'var(--subtle)' }}>
            {new Date(intent.updatedAt).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Action row */}
      {(explorerUrl || canResume) && (
        <div className="flex gap-1.5 border-t px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(15,28,46,0.04)', color: 'var(--ink-2)' }}
            >
              <ExternalLink className="size-3" />
              Explorer
            </a>
          )}
          {canResume && (
            <button
              type="button"
              onClick={() => {
                void navigate('/progress', { state: { intentId: intent.id, resuming: true } })
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-semibold text-white transition-all active:scale-95"
              style={{ background: 'var(--warning)' }}
            >
              Resume payment
            </button>
          )}
        </div>
      )}
    </motion.li>
  )
}

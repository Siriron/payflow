/**
 * Two views:
 * 1. /request/new  — create a payment request link
 * 2. /r/:id        — resolve and pay a request
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { ChevronLeft, Copy, Check, Link as LinkIcon, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { isAddress } from 'viem'
import { createRequest, saveRequest, resolveRequest, generateRequestLink, normalizeRequestAmount } from '@/lib/requests'
import { createIntent, saveIntent } from '@/lib/intent'
import { getKitChainName } from '@/lib/kit'
import { ACTIVE_ARC_CHAIN } from '@/config'
import PageShell from '@/components/PageShell'
import WalletButton from '@/components/WalletButton'
import { PayflowMark } from '@/components/PayflowLogo'

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] as const } },
}

// ─── Create new request ──────────────────────────────────────────────────────

export function NewRequest() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isConnected) { void navigate('/') }
  }, [isConnected, navigate])

  if (!isConnected) return null

  const handleCreate = () => {
    const normalized = normalizeRequestAmount(amount)
    if (!address || !normalized) return
    const req = createRequest({ creator: address, amount: normalized, description: description.trim() })
    saveRequest(req)
    setLink(generateRequestLink(req))
  }

  const copyLink = () => {
    if (!link) return
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col px-5 pb-10 pt-6 md:min-h-0">
        {/* Header */}
        <motion.div {...fadeUp} className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { void navigate('/') }}
            className="glass flex size-10 items-center justify-center rounded-[14px] transition-all active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
          </button>
          <div>
            <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              Request payment
            </h1>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Share a link to get paid
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.28 }}
          className="space-y-4"
        >
          {!link ? (
            <>
              {/* Amount input */}
              <div className="glass rounded-[24px] p-5">
                <div className="spectral-strip mb-4 w-8" />
                <div className="flex items-baseline gap-2">
                  <input
                    inputMode="decimal"
                    type="text"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) setAmount(v)
                    }}
                    placeholder="0.00"
                    className="display min-w-0 flex-1 bg-transparent text-5xl font-bold tabular-nums outline-none placeholder:opacity-20"
                    style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
                    aria-label="Amount to request in USDC"
                  />
                  <span className="shrink-0 text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </div>
                {/* Quick chips */}
                <div className="mt-3 flex gap-2">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(String(amt))}
                      className="flex-1 rounded-[10px] py-1.5 text-xs font-semibold transition-all active:scale-95"
                      style={{
                        background: amount === String(amt) ? 'rgba(18,45,69,0.12)' : 'rgba(18,45,69,0.05)',
                        color: amount === String(amt) ? 'var(--ink)' : 'var(--muted)',
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
                  Description <span style={{ color: 'var(--subtle)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 80))}
                  placeholder="What's this for?"
                  className="glass-inner w-full rounded-[16px] px-4 py-3.5 text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                />
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!amount || parseFloat(amount) <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-[18px] py-[18px] text-[15px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                <LinkIcon className="size-4" />
                Create payment link
              </button>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Amount card */}
              <div className="glass rounded-[24px] p-6 text-center">
                <div className="spectral-strip mx-auto mb-4 w-8" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--muted)' }}>
                  Requesting
                </p>
                <p className="display mt-1 text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                  {amount}
                  <span className="ml-2 text-2xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </p>
                {description && (
                  <p className="mt-2 text-sm" style={{ color: 'var(--subtle)' }}>{description}</p>
                )}
                <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  Payable on {ACTIVE_ARC_CHAIN.name}
                </p>
              </div>

              {/* Link copy */}
              <div
                className="glass-inner flex items-center gap-3 rounded-[18px] px-4 py-3.5"
              >
                <LinkIcon className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
                <p className="mono min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--ink-2)' }}>
                  {link}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-[10px] p-2 transition-all active:scale-95"
                  style={{ background: copied ? 'rgba(26,128,71,0.10)' : 'rgba(18,45,69,0.07)' }}
                  aria-label="Copy link"
                >
                  {copied
                    ? <Check className="size-4" style={{ color: 'var(--success)' }} />
                    : <Copy className="size-4" style={{ color: 'var(--ink-2)' }} />
                  }
                </button>
              </div>

              <button
                type="button"
                onClick={() => { void navigate('/') }}
                className="w-full py-3 text-sm font-medium"
                style={{ color: 'var(--muted)' }}
              >
                Back to home
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </PageShell>
  )
}

// ─── Resolve request by ID ────────────────────────────────────────────────────

export function ResolveRequest() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const req = id ? resolveRequest(id) : null
  const [now] = useState<number>(() => Date.now())

  if (!req) {
    return (
      <div className="relative min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
        <div className="bg-blobs" aria-hidden="true" />
        <div className="relative z-10 flex min-h-dvh items-center justify-center px-5">
          <div className="text-center">
            <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Link not found</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--subtle)' }}>
              This payment link doesn't exist or has expired.
            </p>
            <button
              type="button"
              onClick={() => { void navigate('/') }}
              className="mt-6 text-sm font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              Go to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isPaid = req.status === 'paid'
  const isExpired = req.expiresAt !== null && req.expiresAt < now
  const isSelf = isConnected && address?.toLowerCase() === req.creator.toLowerCase()
  const canPay = req.status === 'pending' && !isExpired && isConnected && !isSelf

  const handlePay = () => {
    if (!address || !walletChainId) return
    // Guard: payer cannot be the same as the request creator
    if (address.toLowerCase() === req.creator.toLowerCase()) return
    const kitChain = getKitChainName(walletChainId)
    if (!kitChain || !isAddress(req.creator)) return
    const intent = createIntent({
      payer: address,
      recipient: req.creator,
      amount: req.amount,
      sourceChain: kitChain,
      sourceChainId: walletChainId,
      destinationChain: import.meta.env.VITE_USE_MAINNET === 'true' ? 'Arc' : 'Arc_Testnet',
      requestId: req.id,
    })
    saveIntent(intent)
    void navigate('/review', { state: { intentId: intent.id } })
  }

  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <div className="bg-blobs" aria-hidden="true" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <PayflowMark size={24} />
            <span className="display text-sm font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              Payflow
            </span>
          </div>
          <WalletButton />
        </div>

        {/* Content */}
        <div className="flex flex-1 items-end justify-center px-5 pb-10 md:items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full md:max-w-[420px]"
          >
            <div
              className="overflow-hidden rounded-t-[28px] md:rounded-[28px]"
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(40px) saturate(200%)',
                WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              }}
            >
              {/* Status strip */}
              <div
                className="h-[3px]"
                style={{
                  background: isPaid
                    ? 'var(--success)'
                    : isExpired
                    ? 'rgba(18,45,69,0.15)'
                    : 'var(--spectral)',
                }}
              />

              <div className="px-6 pb-8 pt-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--muted)' }}>
                  Payment request
                </p>
                <p
                  className="display mt-2 text-5xl font-bold tabular-nums"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
                >
                  {req.amount}
                  <span className="ml-2 text-2xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </p>
                {req.description && (
                  <p className="mt-2 text-sm" style={{ color: 'var(--subtle)' }}>{req.description}</p>
                )}

                {/* Details */}
                <div
                  className="mx-0 mt-5 space-y-0 divide-y rounded-[18px] text-left"
                  style={{ background: 'rgba(18,45,69,0.04)', borderColor: 'var(--border)' }}
                >
                  <DetailRow label="To" value={`${req.creator.slice(0, 8)}…${req.creator.slice(-4)}`} mono />
                  <DetailRow label="Network" value={ACTIVE_ARC_CHAIN.name} />
                  {req.expiresAt && (
                    <DetailRow label="Expires" value={new Date(req.expiresAt).toLocaleDateString()} />
                  )}
                </div>

                {/* Status messages */}
                {isPaid && (
                  <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--success)' }}>
                    This request has been paid.
                  </p>
                )}
                {isExpired && !isPaid && (
                  <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                    This request has expired.
                  </p>
                )}

                {/* Pay CTA */}
                {canPay && (
                  <button
                    type="button"
                    onClick={handlePay}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] py-[18px] text-[15px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: 'var(--accent)' }}
                  >
                    <ArrowUpRight className="size-5" strokeWidth={2.5} />
                    Pay {req.amount} USDC
                  </button>
                )}

                {isSelf && (
                  <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                    This is your own request.
                  </p>
                )}
                {!isConnected && !isPaid && !isExpired && (
                  <div className="mt-5">
                    <WalletButton />
                    <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
                      Connect your wallet to pay
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={`text-xs font-semibold ${mono ? 'mono' : 'tabular-nums'}`} style={{ color: 'var(--ink-2)' }}>
        {value}
      </span>
    </div>
  )
}

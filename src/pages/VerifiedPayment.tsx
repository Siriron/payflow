/**
 * /p/:hash — public, read-only payment verification.
 * Anyone with the link sees what Arc itself recorded for that transaction.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { ACTIVE_ARC_CHAIN } from '@/config'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { verifyArcPayment, isTxHash, type PaymentVerification } from '@/lib/verify'

const short = (v: string, a = 10, b = 6) => `${v.slice(0, a)}…${v.slice(-b)}`

export default function VerifiedPayment() {
  const { hash } = useParams<{ hash: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<PaymentVerification | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const value = hash ?? ''
      if (!isTxHash(value)) { setResult({ status: 'invalid' }); return }
      // Poll briefly: a just-sent payment may not be visible on the public RPC yet.
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await verifyArcPayment(value)
        if (cancelled) return
        if (r.status !== 'not_found' || attempt === 4) { setResult(r); return }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
    void run()
    return () => { cancelled = true }
  }, [hash])

  const explorerUrl = hash && isTxHash(hash) ? buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, hash) : null
  const primary = result?.status === 'confirmed' ? result.transfers[0] : undefined
  const others = result?.status === 'confirmed' ? result.transfers.slice(1) : []

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col items-center justify-end pb-[calc(2rem+env(safe-area-inset-bottom))] md:justify-center md:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full overflow-hidden rounded-t-[32px] md:max-w-[420px] md:rounded-[32px]"
          style={{ background: 'var(--surface-high)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 pb-6 pt-7">
            {result === null && (
              <div className="flex flex-col items-center py-10" role="status">
                <Loader2 className="mb-3 size-6 animate-spin" style={{ color: 'var(--subtle)' }} />
                <p className="text-sm" style={{ color: 'var(--subtle)' }}>Checking Arc…</p>
              </div>
            )}

            {result?.status === 'confirmed' && (
              <>
                <div className="mb-5 flex flex-col items-center text-center">
                  <ShieldCheck className="mb-2 size-9" style={{ color: 'var(--success)' }} />
                  <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                    Verified on {ACTIVE_ARC_CHAIN.name}
                  </h1>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--subtle)' }}>
                    Read directly from the network, not from this link.
                  </p>
                </div>

                {primary ? (
                  <div className="mb-4 rounded-[18px] px-5 py-4" style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)' }}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.10em]" style={{ color: 'var(--muted)' }}>Received</p>
                    <p className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                      {primary.amount}
                      <span className="ml-2 text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                    </p>
                    <p className="mono mt-2 break-all text-[11px]" style={{ color: 'var(--ink-2)' }}>to {primary.to}</p>
                  </div>
                ) : (
                  <p className="mb-4 rounded-[14px] px-4 py-3 text-[13px]" style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                    This transaction succeeded on Arc. Transfer details could not be read from it, so check the explorer for the amounts.
                  </p>
                )}

                <div className="mb-4 divide-y overflow-hidden rounded-[18px]" style={{ background: 'rgba(15,28,46,0.03)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
                  <Row label="Status" value="Succeeded" />
                  <Row label="Network" value={ACTIVE_ARC_CHAIN.name} />
                  <Row label="Transaction" value={short(result.txHash)} mono />
                  <Row label="Block" value={result.blockNumber.toString()} />
                  {result.timestamp !== null && (
                    <Row label="Time" value={new Date(result.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                  )}
                </div>

                {others.length > 0 && (
                  <p className="mb-4 text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
                    Also in this transaction: {others.map((t) => `${t.amount} USDC to ${short(t.to, 8, 4)}`).join(', ')} (network or relay fees).
                  </p>
                )}
              </>
            )}

            {result?.status === 'reverted' && (
              <Notice title="Transaction failed" body="This transaction was recorded on Arc but did not succeed. No funds were received." />
            )}
            {result?.status === 'not_found' && (
              <Notice title="Not found on Arc" body={`No transaction with this hash was found on ${ACTIVE_ARC_CHAIN.name}. It may still be settling, or the link may be for a different network.`} />
            )}
            {result?.status === 'invalid' && (
              <Notice title="Invalid link" body="This doesn't look like a valid transaction hash." />
            )}

            <div className="space-y-2.5">
              {explorerUrl && result !== null && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  View on explorer
                  <ExternalLink className="size-[15px]" />
                </a>
              )}
              <button type="button" onClick={() => { void navigate('/') }} className="btn-ghost w-full">
                Open Payflow
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </PageShell>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5 flex flex-col items-center text-center" role="alert">
      <AlertCircle className="mb-2 size-9" style={{ color: 'var(--danger)' }} />
      <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>{title}</h1>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--subtle)' }}>{body}</p>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={`text-[12px] font-semibold ${mono ? 'mono' : 'tabular-nums'}`} style={{ color: 'var(--ink-2)' }}>{value}</span>
    </div>
  )
}

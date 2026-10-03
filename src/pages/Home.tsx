import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ArrowUpRight, Link as LinkIcon, ChevronRight } from 'lucide-react'
import PageShell from '@/components/PageShell'
import BalanceCard from '@/components/BalanceCard'
import IntentStatusBanner from '@/components/IntentStatusBanner'
import WalletButton from '@/components/WalletButton'
import { PayflowMark } from '@/components/PayflowLogo'
import { findRecoverableIntent, loadRecentIntents } from '@/lib/intent'
import type { PaymentIntent } from '@/lib/intent'
import { useNavigateToResume } from '@/hooks/useNavigateToResume'
import { ACTIVE_ARC_CHAIN } from '@/config'

const item = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1] as const } },
}
const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } },
}

export default function Home() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const navigateToResume = useNavigateToResume()
  const recoverable = address ? findRecoverableIntent(address) : null
  const recent = address ? loadRecentIntents(address, 5) : []

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 md:min-h-0">

        {/* ── Header ───────────────────────────────────────────── */}
        <motion.header
          variants={item} initial="initial" animate="animate"
          className="mb-7 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <PayflowMark size={30} />
            <h1
              className="display text-[19px] font-bold"
              style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
            >
              Payflow
            </h1>
          </div>
          <WalletButton />
        </motion.header>

        <motion.div variants={stagger} initial="initial" animate="animate" className="flex-1 space-y-5">

          {/* ── Recoverable banner ───────────────────────────── */}
          {recoverable && (
            <motion.div variants={item}>
              <IntentStatusBanner intent={recoverable} onResume={() => navigateToResume(recoverable)} />
            </motion.div>
          )}

          {/* ── Balance hero ─────────────────────────────────── */}
          <motion.div variants={item} className="pt-2">
            <BalanceCard />
          </motion.div>

          {/* ── Action row ───────────────────────────────────── */}
          <motion.div variants={item} className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { void navigate('/send') }}
              disabled={!isConnected}
              className="btn-primary !rounded-[18px] disabled:opacity-35"
            >
              <ArrowUpRight className="size-[18px]" strokeWidth={2.5} />
              Send
            </button>
            <button
              type="button"
              onClick={() => { void navigate('/request/new') }}
              disabled={!isConnected}
              className="btn-secondary !rounded-[18px] disabled:opacity-35"
            >
              <LinkIcon className="size-[17px]" strokeWidth={2.2} />
              Request
            </button>
          </motion.div>

          {/* ── Pre-connect pitch — only when disconnected ───── */}
          {!isConnected && (
            <motion.div variants={item} className="space-y-2.5 pt-1">
              {/* Network live pill */}
              <div
                className="flex items-center justify-between rounded-[13px] px-4 py-2.5"
                style={{
                  background: 'rgba(26,128,71,0.05)',
                  border: '1px solid rgba(26,128,71,0.12)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--success)' }}>
                    {ACTIVE_ARC_CHAIN.name} · Live
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>USDC as gas</span>
              </div>

              {/* How it works — list, not cards */}
              <div
                className="rounded-[18px] px-5 py-4 space-y-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.10em]" style={{ color: 'var(--muted)' }}>
                  How it works
                </p>
                {[
                  ['1', 'Connect your wallet'],
                  ['2', 'Enter amount and recipient'],
                  ['3', 'We find the best route'],
                  ['4', 'Sign once — done'],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-center gap-3">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(15,28,46,0.07)', color: 'var(--muted)' }}
                    >
                      {num}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--ink-2)' }}>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Recent payments ──────────────────────────────── */}
          {isConnected && recent.length > 0 && (
            <motion.section variants={item}>
              <div className="mb-3 flex items-center justify-between">
                <h2
                  className="text-[10px] font-semibold uppercase tracking-[0.10em]"
                  style={{ color: 'var(--muted)' }}
                >
                  Recent
                </h2>
                <button
                  type="button"
                  onClick={() => { void navigate('/activity') }}
                  className="flex items-center gap-0.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  All <ChevronRight className="size-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {recent.map((intent) => (
                  <RecentItem key={intent.id} intent={intent} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Connected empty state ────────────────────────── */}
          {isConnected && recent.length === 0 && (
            <motion.div
              variants={item}
              className="flex flex-col items-center gap-2 py-10 text-center"
            >
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>No payments yet</p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                Send USDC to any address on Arc
              </p>
            </motion.div>
          )}

        </motion.div>
      </div>
    </PageShell>
  )
}

/* ── Recent payment row ─────────────────────────────────────────── */
const STATE_DOT: Record<string, string> = {
  completed: 'var(--success)',
  failed: 'var(--danger)',
  cancelled: 'var(--muted)',
  recoverable: 'var(--warning)',
}
const STATE_LABEL: Record<string, string> = {
  completed: 'Sent', failed: 'Failed', cancelled: 'Cancelled',
  recoverable: 'Attention', submitted: 'Processing',
  settling: 'Settling', quoting: 'Preparing',
  ready: 'Ready', awaiting_signature: 'Signing', draft: 'Draft',
}

function RecentItem({ intent }: { intent: PaymentIntent }) {
  const dotColor = STATE_DOT[intent.state] ?? 'var(--subtle)'
  const label = STATE_LABEL[intent.state] ?? intent.state

  return (
    <div
      className="flex items-center justify-between rounded-[14px] px-4 py-3 transition-colors"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="size-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <p className="mono truncate text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {intent.recipient.slice(0, 10)}…{intent.recipient.slice(-4)}
        </p>
      </div>
      <div className="ml-4 shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {intent.amount}
          <span className="ml-0.5 text-xs font-medium" style={{ color: 'var(--subtle)' }}> USDC</span>
        </p>
        <p className="text-[11px]" style={{ color: dotColor }}>{label}</p>
      </div>
    </div>
  )
}

import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ChevronRight } from 'lucide-react'
import ChainBalanceSheet from '@/components/ChainBalanceSheet'
import { useMultiChainBalances } from '@/hooks/useMultiChainBalances'
import PageShell from '@/components/PageShell'
import BalanceCard from '@/components/BalanceCard'
import IntentStatusBanner from '@/components/IntentStatusBanner'
import WalletButton from '@/components/WalletButton'
import { PayflowMark } from '@/components/PayflowLogo'
import { findRecoverableIntent, loadRecentIntents } from '@/lib/intent'
import type { PaymentIntent } from '@/lib/intent'
import { useNavigateToResume } from '@/hooks/useNavigateToResume'
import { ACTIVE_ARC_CHAIN } from '@/config'
import { ConnectKitButton } from 'connectkit'

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
  const [sheetOpen, setSheetOpen] = useState(false)
  const multiChain = useMultiChainBalances()

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <motion.header
          variants={item} initial="initial" animate="animate"
          className="mb-6 flex items-center justify-between"
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

        <motion.div variants={stagger} initial="initial" animate="animate" className="flex-1 space-y-4">

          {/* ── Recoverable banner ─────────────────────────── */}
          {recoverable && (
            <motion.div variants={item}>
              <IntentStatusBanner intent={recoverable} onResume={() => navigateToResume(recoverable)} />
            </motion.div>
          )}

          {/* ── Balance hero + action buttons ──────────────── */}
          <motion.div variants={item}>
            <BalanceCard
              multiChain={multiChain}
              isConnected={isConnected}
              onSend={() => isConnected ? setSheetOpen(true) : undefined}
              onRequest={() => { void navigate('/request/new') }}
            />
          </motion.div>

          {/* ── Pre-connect section ─────────────────────────── */}
          {!isConnected && (
            <motion.div variants={item} className="space-y-3">
              {/* Network pill */}
              <div
                className="flex items-center justify-between rounded-[16px] px-4 py-3"
                style={{
                  background: 'var(--success-bg)',
                  border: '1px solid rgba(22,163,74,0.15)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: 'var(--success)' }} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--success)' }}>
                    {ACTIVE_ARC_CHAIN.name} · Live
                  </span>
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>USDC as gas</span>
              </div>

              {/* How it works */}
              <div className="card-sm p-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: 'var(--subtle)' }}>
                  How Payflow works
                </p>
                {[
                  ['1', 'Connect your wallet'],
                  ['2', 'See USDC across all chains'],
                  ['3', 'Pick a chain, enter amount + address'],
                  ['4', 'Sign once — payment arrives on Arc'],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-center gap-3">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                    >
                      {num}
                    </span>
                    <span className="text-[14px]" style={{ color: 'var(--ink-2)' }}>{text}</span>
                  </div>
                ))}
                <div className="pt-1">
                  <ConnectKitButton />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Recent payments ─────────────────────────────── */}
          {isConnected && recent.length > 0 && (
            <motion.section variants={item}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2
                  className="text-[11px] font-bold uppercase tracking-[0.10em]"
                  style={{ color: 'var(--muted)' }}
                >
                  Recent
                </h2>
                <button
                  type="button"
                  onClick={() => { void navigate('/activity') }}
                  className="flex items-center gap-0.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--accent)' }}
                >
                  See all <ChevronRight className="size-3" />
                </button>
              </div>
              <div className="space-y-2">
                {recent.map((intent) => (
                  <RecentItem key={intent.id} intent={intent} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Connected empty state ───────────────────────── */}
          {isConnected && recent.length === 0 && (
            <motion.div
              variants={item}
              className="flex flex-col items-center gap-2 py-10 text-center"
            >
              <div
                className="mb-1 flex size-12 items-center justify-center rounded-full"
                style={{ background: 'var(--surface-2)' }}
              >
                <span className="text-[22px]">💸</span>
              </div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-2)' }}>No payments yet</p>
              <p className="text-[12px]" style={{ color: 'var(--subtle)' }}>
                Tap Send to pick a chain and send USDC to any Arc address
              </p>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* ── Chain balance sheet ─────────────────────────────── */}
      <ChainBalanceSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        balances={multiChain.balances}
      />
    </PageShell>
  )
}

/* ── Recent payment row ────────────────────────────────────────────── */
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
      className="flex items-center justify-between rounded-[16px] px-4 py-3 transition-colors"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: dotColor === 'var(--success)' ? 'var(--success-bg)' : 'var(--surface-2)' }}
        >
          <span className="size-2 rounded-full" style={{ background: dotColor }} />
        </div>
        <div className="min-w-0">
          <p className="mono truncate text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
            {intent.recipient.slice(0, 10)}…{intent.recipient.slice(-4)}
          </p>
          <p className="text-[11px]" style={{ color: dotColor }}>{label}</p>
        </div>
      </div>
      <div className="ml-4 shrink-0 text-right">
        <p className="display text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {intent.amount}
          <span className="ml-0.5 text-[11px] font-medium" style={{ color: 'var(--subtle)' }}> USDC</span>
        </p>
      </div>
    </div>
  )
}

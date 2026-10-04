import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAccount, useSwitchChain } from 'wagmi'
import { X, ArrowUpRight } from 'lucide-react'
import { networkIcons } from '@web3icons/react'
import type { ChainBalance } from '@/hooks/useMultiChainBalances'

interface Props {
  open: boolean
  onClose: () => void
  balances: ChainBalance[]
}

// Chain name → web3icons network slug
const CHAIN_ICON_SLUG: Record<string, string> = {
  'Ethereum':          'ethereum',
  'Sepolia':           'ethereum',
  'Base':              'base',
  'Base Sepolia':      'base',
  'Arbitrum One':      'arbitrum',
  'Arbitrum Sepolia':  'arbitrum',
  'Avalanche':         'avalanche',
  'Avalanche Fuji':    'avalanche',
  'OP Mainnet':        'optimism',
  'OP Sepolia':        'optimism',
  'Optimism Sepolia':  'optimism',
  'Unichain':          'uniswap',
  'Unichain Sepolia':  'uniswap',
}

// Per-chain brand color for the icon background
const CHAIN_COLOR: Record<string, string> = {
  'Ethereum':          'rgba(98,126,234,0.15)',
  'Sepolia':           'rgba(98,126,234,0.15)',
  'Base':              'rgba(0,82,255,0.12)',
  'Base Sepolia':      'rgba(0,82,255,0.12)',
  'Arbitrum One':      'rgba(40,160,240,0.12)',
  'Arbitrum Sepolia':  'rgba(40,160,240,0.12)',
  'Avalanche':         'rgba(232,65,66,0.12)',
  'Avalanche Fuji':    'rgba(232,65,66,0.12)',
  'OP Mainnet':        'rgba(255,4,32,0.1)',
  'OP Sepolia':        'rgba(255,4,32,0.1)',
  'Optimism Sepolia':  'rgba(255,4,32,0.1)',
  'Unichain':          'rgba(255,0,122,0.1)',
  'Unichain Sepolia':  'rgba(255,0,122,0.1)',
}

const CHAIN_SHORT: Record<string, string> = {
  'Arc': 'Arc Network', 'Arc Testnet': 'Arc Network',
  'Ethereum': 'Ethereum', 'Sepolia': 'Sepolia',
  'Base': 'Base', 'Base Sepolia': 'Base Sepolia',
  'Arbitrum One': 'Arbitrum', 'Arbitrum Sepolia': 'Arb Sepolia',
  'Avalanche': 'Avalanche', 'Avalanche Fuji': 'Fuji',
  'OP Mainnet': 'Optimism', 'OP Sepolia': 'OP Sepolia',
  'Optimism Sepolia': 'OP Sepolia',
  'Unichain': 'Unichain', 'Unichain Sepolia': 'Unichain Sepolia',
}

function chainShort(name: string) { return CHAIN_SHORT[name] ?? name }

function ChainIcon({ name, size = 32 }: { name: string; size?: number }) {
  const slug = CHAIN_ICON_SLUG[name]
  const bg = CHAIN_COLOR[name] ?? 'rgba(15,28,46,0.08)'

  const inner = (() => {
    if (slug) {
      const entry = (networkIcons as Record<string, { branded?: React.ComponentType<React.SVGProps<SVGSVGElement>> }>)[slug]
      const Icon = entry?.branded
      if (Icon) return <Icon width={size * 0.58} height={size * 0.58} />
    }
    // Arc / fallback — custom P mark
    return (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 20 20" fill="none">
        <rect width="20" height="20" rx="5" fill="#0f2d52" />
        <text x="10" y="14.5" textAnchor="middle" fill="white"
          fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="11">P</text>
      </svg>
    )
  })()

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: bg }}
    >
      {inner}
    </div>
  )
}

/** Animated count-up for a single chain balance */
function ChainAmount({ value, delay = 0 }: { value: string; delay?: number }) {
  const numeric = parseFloat(value.replace(/,/g, '')) || 0
  const mv = useMotionValue(0)
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 2) : 2
  const display = useTransform(mv, (v) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  )
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    mv.set(0)
    const ctrl = animate(mv, numeric, {
      duration: 0.8,
      delay,
      ease: [0.16, 1, 0.3, 1],
    })
    return ctrl.stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <motion.span className="display text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
      {display}
    </motion.span>
  )
}

export default function ChainBalanceSheet({ open, onClose, balances }: Props) {
  const navigate = useNavigate()
  const { chainId: walletChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const handleSendFromChain = async (chainId: number) => {
    onClose()
    if (walletChainId !== chainId) {
      try { await switchChainAsync({ chainId }) }
      catch { /* user rejected — proceed anyway */ }
    }
    void navigate('/send', { state: { sourceChainId: chainId } })
  }

  const sourceBalances = balances.filter((b) => !b.isArc)
  const arcBalance = balances.find((b) => b.isArc)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(10,18,32,0.5)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 440, damping: 40 }}
          >
            <div
              className="rounded-t-[32px] px-5 pb-6 pt-4"
              style={{
                background: 'var(--surface-high)',
                boxShadow: '0 -12px 60px rgba(10,18,32,0.22)',
                border: '1px solid var(--border)',
                borderBottom: 'none',
              }}
            >
              {/* Handle */}
              <div
                className="mx-auto mb-5 h-1 w-10 rounded-full"
                style={{ background: 'var(--border)' }}
              />

              {/* Title + close */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2
                    className="display text-lg font-bold"
                    style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
                  >
                    Your USDC
                  </h2>
                  <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                    Tap a chain to send from it
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-9 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Arc destination row */}
              {arcBalance && (
                <div className="mb-5">
                  <p
                    className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--muted)' }}
                  >
                    Destination · payments land here
                  </p>
                  <div
                    className="flex items-center justify-between rounded-[20px] px-4 py-3.5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(37,99,235,0.04) 100%)',
                      border: '1px solid rgba(37,99,235,0.2)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <ChainIcon name={arcBalance.chainName} size={40} />
                      <div>
                        <p className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                          {chainShort(arcBalance.chainName)}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                          USDC as gas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {arcBalance.isLoading ? (
                        <div className="h-5 w-16 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
                      ) : (
                        <div className="flex items-end gap-1">
                          <ChainAmount value={arcBalance.amount} delay={0.1} />
                          <span className="mb-0.5 text-[11px] font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Source chain rows */}
              <p
                className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--muted)' }}
              >
                Send from
              </p>
              <div className="flex flex-col gap-2">
                {sourceBalances.map((b, i) => (
                  <motion.button
                    key={b.chainId}
                    type="button"
                    onClick={() => { void handleSendFromChain(b.chainId) }}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ x: 2 }}
                    className="flex w-full items-center justify-between rounded-[20px] px-4 py-3.5 text-left transition-colors"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-raised)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <div className="flex items-center gap-3">
                      <ChainIcon name={b.chainName} size={40} />
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                          {chainShort(b.chainName)}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                          Tap to send from here
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {b.isLoading ? (
                        <div className="h-4 w-14 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
                      ) : (
                        <div className="flex items-end gap-1">
                          <ChainAmount value={b.amount} delay={i * 0.06 + 0.2} />
                          <span className="mb-0.5 text-[11px] font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                        </div>
                      )}
                      <div
                        className="flex size-7 items-center justify-center rounded-full"
                        style={{ background: 'var(--surface-raised)' }}
                      >
                        <ArrowUpRight className="size-3.5" style={{ color: 'var(--subtle)' }} />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
                Your wallet will prompt to switch networks
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

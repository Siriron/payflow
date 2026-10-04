import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Link as LinkIcon, RefreshCw, TrendingUp } from 'lucide-react'
import type { UseMultiChainBalancesReturn } from '@/hooks/useMultiChainBalances'

interface Props {
  multiChain: UseMultiChainBalancesReturn
  onSend: () => void
  onRequest: () => void
  onBreakdown?: () => void
  isConnected: boolean
}

/** Animated number — counts from prev to next value with spring ease */
function AnimatedAmount({ value }: { value: string }) {
  const numeric = parseFloat(value.replace(/,/g, '')) || 0
  const motionVal = useMotionValue(0)
  const prevRef = useRef(0)
  const [hasLoaded, setHasLoaded] = useState(false)

  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 2) : 2
  const display = useTransform(motionVal, (v) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  )

  useEffect(() => {
    const from = hasLoaded ? prevRef.current : 0
    prevRef.current = numeric
    setHasLoaded(true)
    motionVal.set(from)
    const ctrl = animate(motionVal, numeric, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    })
    return ctrl.stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric])

  return (
    <motion.span
      className="display font-bold leading-none tabular-nums"
      style={{
        color: '#fff',
        letterSpacing: '-0.03em',
        fontSize: 'clamp(32px, 10vw, 48px)',
      }}
    >
      {display}
    </motion.span>
  )
}

export default function BalanceCard({ multiChain, onSend, onRequest, onBreakdown, isConnected }: Props) {
  const { totalFormatted, isLoading, refetch } = multiChain
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await refetch?.()
    setTimeout(() => setRefreshing(false), 600)
  }

  return (
    <div className="space-y-3">

      {/* ── Hero balance card ─────────────────────────────── */}
      <motion.div
        className="hero-card relative overflow-hidden px-6 pb-7 pt-6"
        onClick={isConnected && onBreakdown ? onBreakdown : undefined}
        whileTap={isConnected && onBreakdown ? { scale: 0.982 } : undefined}
        style={{ cursor: isConnected && onBreakdown ? 'pointer' : 'default' }}
      >
        {/* Decorative circle glare — top right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 -right-4 size-52 rounded-full"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />

        {/* Top label row */}
        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex size-6 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <TrendingUp className="size-3.5 text-white" strokeWidth={2.5} />
            </div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              Total Balance
            </p>
          </div>

          {isConnected && (
            <motion.button
              type="button"
              onClick={() => { void handleRefresh() }}
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.6, ease: 'linear' } : { duration: 0 }}
              className="flex size-7 items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.14)' }}
              aria-label="Refresh balances"
            >
              <RefreshCw className="size-3.5" />
            </motion.button>
          )}
        </div>

        {/* Amount */}
        <div className="relative mb-1 flex items-end gap-2.5">
          {isConnected ? (
            <>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-12 w-40 animate-pulse rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.18)' }}
                  />
                ) : (
                  <motion.div
                    key="amount"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-end gap-2.5"
                  >
                    <AnimatedAmount value={totalFormatted ?? '0.00'} />
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.18 }}
                      className="mb-1 text-[18px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      USDC
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <span
              className="display text-[42px] font-bold leading-none"
              style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '-0.03em' }}
            >
              ——
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="relative mt-3 flex items-center justify-between">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {isConnected ? 'across all chains' : 'Connect wallet to view'}
          </p>
          {isConnected && !isLoading && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.2 }}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
            >
              View breakdown →
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* ── Action buttons ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Send — rich blue gradient */}
        <motion.button
          type="button"
          onClick={onSend}
          disabled={!isConnected}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="relative flex flex-col items-start overflow-hidden rounded-[22px] px-5 py-5 disabled:opacity-40"
          style={{
            background: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
            boxShadow: '0 8px 32px rgba(37,99,235,0.45), 0 2px 8px rgba(37,99,235,0.3)',
          }}
        >
          {/* Glare */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          <div
            className="mb-3 flex size-11 items-center justify-center rounded-[14px]"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <ArrowUpRight className="size-6 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-[17px] font-bold leading-tight text-white">Send</p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>Any chain → Arc</p>
        </motion.button>

        {/* Request — deep violet gradient */}
        <motion.button
          type="button"
          onClick={onRequest}
          disabled={!isConnected}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="relative flex flex-col items-start overflow-hidden rounded-[22px] px-5 py-5 disabled:opacity-40"
          style={{
            background: 'linear-gradient(145deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
            boxShadow: '0 8px 32px rgba(124,58,237,0.45), 0 2px 8px rgba(124,58,237,0.3)',
          }}
        >
          {/* Glare */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          <div
            className="mb-3 flex size-11 items-center justify-center rounded-[14px]"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <LinkIcon className="size-6 text-white" strokeWidth={2.2} />
          </div>
          <p className="text-[17px] font-bold leading-tight text-white">Request</p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>Create a link</p>
        </motion.button>

      </div>
    </div>
  )
}

import { motion } from 'framer-motion'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ACTIVE_ARC_CHAIN } from '@/config'

interface Props { className?: string }

export default function BalanceCard({ className = '' }: Props) {
  const { address, isConnected } = useAccount()
  const usdcFact = getUsdc(ACTIVE_ARC_CHAIN.id)

  const { data: rawBalance, isLoading } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ACTIVE_ARC_CHAIN.id,
    query: { enabled: isConnected && !!address && !!usdcFact },
  })

  const formatted =
    rawBalance !== undefined && usdcFact
      ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ACTIVE_ARC_CHAIN.id)).toFixed(2)
      : null

  return (
    <section className={`${className}`}>
      <p
        className="mb-1 text-[11px] font-semibold uppercase tracking-[0.10em]"
        style={{ color: 'var(--muted)' }}
      >
        USDC balance
      </p>

      {!isConnected ? (
        /* Disconnected — show placeholder amount so layout doesn't shift */
        <div className="flex items-baseline gap-2 opacity-25" aria-hidden="true">
          <span className="display text-5xl font-bold" style={{ letterSpacing: '-0.04em', color: 'var(--ink)' }}>
            —
          </span>
          <span className="text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
      ) : isLoading ? (
        /* Skeleton matches the actual layout */
        <div className="flex items-baseline gap-2">
          <div className="h-12 w-36 animate-pulse rounded-xl" style={{ background: 'var(--border)' }} />
          <div className="h-5 w-14 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
        </div>
      ) : (
        <motion.div
          key={formatted ?? 'zero'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.20 }}
          className="flex items-baseline gap-2"
        >
          <span
            className="display text-5xl font-bold tabular-nums"
            style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
          >
            {formatted ?? '0.00'}
          </span>
          <span className="text-xl font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
        </motion.div>
      )}

      <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
        {isConnected ? `on ${ACTIVE_ARC_CHAIN.name}` : 'Connect wallet to view'}
      </p>
    </section>
  )
}

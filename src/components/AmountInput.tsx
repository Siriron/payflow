import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ACTIVE_ARC_CHAIN } from '@/config'

interface Props {
  value: string
  onChange: (v: string) => void
  balanceChainId?: number
  error?: string | null
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

export default function AmountInput({ value, onChange, balanceChainId, error }: Props) {
  const { address, isConnected } = useAccount()
  const chainId = balanceChainId ?? ACTIVE_ARC_CHAIN.id
  const usdcFact = getUsdc(chainId)

  const { data: rawBalance } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isConnected && !!address && !!usdcFact },
  })

  const displayBalance =
    rawBalance !== undefined && usdcFact
      ? (Math.floor(Number(Amount.fromRaw(rawBalance, usdcDecimalsFor(chainId)).toFixed(6)) * 100) / 100).toFixed(2)
      : null

  const maxValue =
    rawBalance !== undefined && usdcFact
      ? Amount.fromRaw(rawBalance, usdcDecimalsFor(chainId)).toFixed(6).replace(/\.?0+$/, '')
      : null

  return (
    <div>
      <div
        className="glass-inner rounded-[20px] px-5 pt-5 pb-4"
        style={error ? { border: '1.5px solid var(--danger)' } : { border: '1px solid var(--border)' }}
      >
        {/* Amount row */}
        <div className="flex items-baseline gap-2">
          <input
            inputMode="decimal"
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              // Allow only one decimal point, up to 6 decimal places
              if (v === '' || /^\d{0,9}\.?\d{0,6}$/.test(v)) onChange(v)
            }}
            placeholder="0"
            className="display min-w-0 flex-1 bg-transparent text-[52px] font-bold tabular-nums outline-none placeholder:opacity-15"
            style={{ color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1.05 }}
            aria-label="Amount in USDC"
            aria-invalid={!!error}
            aria-describedby={error ? 'amount-error' : undefined}
          />
          <span className="text-xl font-semibold shrink-0 pb-1" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>

        {/* Balance + Max */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            {isConnected && displayBalance ? `Balance ${displayBalance} USDC` : 'Connect wallet'}
          </span>
          {maxValue && (
            <button
              type="button"
              onClick={() => onChange(maxValue)}
              className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)' }}
            >
              Max
            </button>
          )}
        </div>

        {/* Quick-amount chips */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {QUICK_AMOUNTS.map((amt) => {
            const active = value === String(amt)
            return (
              <button
                key={amt}
                type="button"
                onClick={() => onChange(String(amt))}
                className="rounded-[10px] py-2 text-[12px] font-semibold transition-all active:scale-95"
                style={{
                  background: active ? 'rgba(15,28,46,0.10)' : 'rgba(15,28,46,0.04)',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
                }}
              >
                {amt}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p id="amount-error" className="mt-1.5 px-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ACTIVE_ARC_CHAIN } from '@/config'

// Map App Kit / wagmi chain keys to display names
const CHAIN_DISPLAY: Record<string, string> = {
  Arc: 'Arc Network',
  Arc_Testnet: 'Arc Network',
  Ethereum: 'Ethereum',
  ETH: 'Ethereum',
  Base: 'Base',
  BASE: 'Base',
  Arbitrum: 'Arbitrum',
  ARB: 'Arbitrum',
  Avalanche: 'Avalanche',
  AVAX: 'Avalanche',
  Polygon: 'Polygon',
  MATIC: 'Polygon',
  Optimism: 'Optimism',
  OP: 'Optimism',
  Solana: 'Solana',
  SOL: 'Solana',
}

function friendlyChainName(raw: string): string {
  return CHAIN_DISPLAY[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  sourceChainName: string
  estimatedFee: string | null
  recipientAmount: string | null
  amount: string
}

export default function RouteDetails({ sourceChainName, estimatedFee, recipientAmount, amount }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-xs font-semibold"
        style={{ color: 'var(--accent-hover)' }}
        aria-expanded={open}
      >
        View route details
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          className="mt-2 space-y-2 rounded-2xl p-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <Row label="From" value={friendlyChainName(sourceChainName)} />
          <Row label="To" value={ACTIVE_ARC_CHAIN.name} />
          <Row label="You send" value={`${amount} USDC`} />
          {estimatedFee !== null && (
            <Row label="Network fee" value={`≈ ${estimatedFee} USDC`} />
          )}
          {recipientAmount !== null && (
            <Row label="Recipient gets" value={`${recipientAmount} USDC`} />
          )}
          <p className="pt-1 text-xs" style={{ color: 'var(--subtle)' }}>
            Powered by Circle's cross-chain infrastructure. Fees are estimates and may vary slightly.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>{value}</span>
    </div>
  )
}

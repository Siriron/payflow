import { useModal } from 'connectkit'
import { useAccount } from 'wagmi'
import { ACTIVE_ARC_CHAIN } from '@/config'

export default function WalletButton() {
  const { setOpen } = useModal()
  const { address, isConnected, chainId } = useAccount()

  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null

  const onCorrectChain = chainId === ACTIVE_ARC_CHAIN.id

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Wallet settings"
        className="glass flex items-center gap-2 rounded-[13px] px-3 py-2 transition-all hover:bg-white/90 active:scale-95"
        style={{ color: 'var(--ink)' }}
      >
        {/* Status dot */}
        <span
          className="size-1.5 rounded-full shrink-0"
          style={{ background: onCorrectChain ? 'var(--success)' : 'var(--danger)' }}
        />
        <span className="mono text-[12px] font-medium">{short}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Connect wallet"
      className="btn-primary !w-auto !py-2.5 !px-5 !text-sm !rounded-[13px]"
    >
      Connect
    </button>
  )
}

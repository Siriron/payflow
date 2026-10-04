import { ConnectKitButton } from 'connectkit'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/providers/ThemeProvider'
import { useAccount, useChains } from 'wagmi'
import { ACTIVE_ARC_CHAIN, CCTP_SOURCE_CHAINS } from '@/config'

export default function WalletButton() {
  const { theme, toggle } = useTheme()
  const { chainId } = useAccount()
  const chains = useChains()

  const isArc = chainId === ACTIVE_ARC_CHAIN.id
  const isSupported = chainId !== undefined &&
    (isArc || CCTP_SOURCE_CHAINS.map(c => c.id as number).includes(chainId))

  const chainName = chainId
    ? (chains.find(c => c.id === chainId)?.name ?? `Chain ${chainId}`)
    : null

  const dotColor = !chainId ? 'var(--subtle)'
    : isSupported ? 'var(--success)'
    : 'var(--danger)'

  return (
    <div className="flex items-center gap-2">
      {/* Dark/light toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex size-9 items-center justify-center rounded-full transition-colors"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-strong)',
          color: 'var(--muted)',
        }}
      >
        {theme === 'dark'
          ? <Sun className="size-4" strokeWidth={2} />
          : <Moon className="size-4" strokeWidth={2} />
        }
      </button>

      {/* Wallet connect */}
      <ConnectKitButton.Custom>
        {({ isConnected, show, address }) => (
          <button
            type="button"
            onClick={show}
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border-strong)',
              color: 'var(--ink)',
              boxShadow: 'var(--shadow-xs)',
              minHeight: 36,
            }}
          >
            <span
              className="size-2 rounded-full shrink-0 transition-colors"
              style={{ background: dotColor }}
            />
            {isConnected && address
              ? <>
                  <span className="hidden sm:block" style={{ color: 'var(--muted)', fontSize: 11 }}>
                    {chainName}
                  </span>
                  <span style={{ color: 'var(--ink)' }}>
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                </>
              : <span>Connect</span>
            }
          </button>
        )}
      </ConnectKitButton.Custom>
    </div>
  )
}

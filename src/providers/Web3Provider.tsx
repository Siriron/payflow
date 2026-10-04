/**
 * Web3Provider — wraps wagmi + ConnectKit for Payflow.
 * Chains: Arc Mainnet (destination) + all CCTP source chains.
 */
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { config } from '@/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 2 },
  },
})

const connectKitTheme = {
  // Typography
  '--ck-font-family': "'DM Sans', sans-serif",
  // Modal chrome
  '--ck-body-background': 'rgba(255,255,255,0.96)',
  '--ck-body-background-secondary': '#f5f5f8',
  '--ck-body-background-tertiary': '#efefef',
  '--ck-body-color': '#122d45',
  '--ck-body-color-muted': '#6b6580',
  '--ck-body-color-muted-hover': '#334155',
  // Primary button — Arc navy
  '--ck-primary-button-background': '#122d45',
  '--ck-primary-button-hover-background': '#1061a6',
  '--ck-primary-button-color': '#ffffff',
  '--ck-primary-button-border-radius': '14px',
  // Secondary button
  '--ck-secondary-button-background': 'rgba(18,45,69,0.06)',
  '--ck-secondary-button-hover-background': 'rgba(18,45,69,0.10)',
  '--ck-secondary-button-border-radius': '14px',
  // Borders + radius
  '--ck-border-radius': '20px',
  '--ck-connectbutton-border-radius': '14px',
  '--ck-focus-color': '#85b1ed',
  // Overlay
  '--ck-overlay-background': 'rgba(18,45,69,0.28)',
  '--ck-overlay-backdrop-filter': 'blur(8px)',
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={connectKitTheme}
          options={{ initialChainId: 0 }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

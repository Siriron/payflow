/**
 * wagmi configuration — Payflow
 * Built with Arc Studio — https://studio.arc.io
 *
 * ACTIVE_CHAIN controls whether Payflow targets Arc Testnet or Arc Mainnet.
 * Flip VITE_USE_MAINNET=true in .env to target mainnet for submission.
 * All chain facts are read from @/onchain-facts — never hardcode addresses.
 */

import { http, createConfig } from 'wagmi'
import {
  mainnet,
  arcTestnet,
  arc,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  optimismSepolia,
  base,
  arbitrum,
  avalanche,
  optimism,
} from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

const USE_MAINNET = import.meta.env.VITE_USE_MAINNET === 'true'

// The Arc chain Payflow pays to
export const ACTIVE_ARC_CHAIN = USE_MAINNET ? arc : arcTestnet

// Source chains — all have CCTP support
export const CCTP_SOURCE_CHAINS = USE_MAINNET
  ? ([mainnet, base, arbitrum, avalanche, optimism] as const)
  : ([sepolia, baseSepolia, arbitrumSepolia, avalancheFuji, optimismSepolia] as const)

// All chains needed by wagmi — always include both Arc chains so transports
// cover every chain ID regardless of USE_MAINNET.
const sourceAndMainnet = USE_MAINNET
  ? ([mainnet, base, arbitrum, avalanche, optimism] as const)
  : ([mainnet, sepolia, baseSepolia, arbitrumSepolia, avalancheFuji, optimismSepolia] as const)

export const ALL_CHAINS = [arc, arcTestnet, ...sourceAndMainnet] as const

// Pre-register chain RPC URLs for tracing
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

const connectors = [injected()]

// Transports must cover every chain ID wagmi may encounter — include both
// arc and arcTestnet so the config is valid regardless of USE_MAINNET.
export const config = createConfig({
  chains: ALL_CHAINS,
  connectors,
  transports: {
    [arc.id]: http(),
    [arcTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [avalancheFuji.id]: http(),
    [optimismSepolia.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
    [optimism.id]: http(),
  },
})

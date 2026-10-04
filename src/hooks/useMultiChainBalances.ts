/**
 * Reads USDC balanceOf for the connected address on every supported CCTP
 * source chain + the Arc destination chain, in parallel.
 * Returns per-chain results plus a derived total across all chains.
 */
import { useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import { useAccount } from 'wagmi'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ACTIVE_ARC_CHAIN, CCTP_SOURCE_CHAINS } from '@/config'

export interface ChainBalance {
  chainId: number
  chainName: string
  amount: string      // formatted to 2dp
  rawAmount: bigint
  isLoading: boolean
  isArc: boolean
}

const ALL_BALANCE_CHAINS = [
  ACTIVE_ARC_CHAIN,
  ...CCTP_SOURCE_CHAINS,
] as const

export function useMultiChainBalances() {
  const { address, isConnected } = useAccount()

  // Build one contract read per chain
  const contracts = ALL_BALANCE_CHAINS.map((chain) => {
    const usdc = getUsdc(chain.id)
    return {
      address: usdc?.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address as `0x${string}`] as const,
      chainId: chain.id,
    }
  })

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 15_000,
    },
  })

  const balances: ChainBalance[] = ALL_BALANCE_CHAINS.map((chain, i) => {
    const result = data?.[i]
    const raw = result?.status === 'success' ? (result.result) : 0n
    const decimals = usdcDecimalsFor(chain.id)
    const formatted = result?.status === 'success'
      ? Amount.fromRaw(raw, decimals).toFixed(2)
      : null

    return {
      chainId: chain.id,
      chainName: chain.name,
      amount: formatted ?? '—',
      rawAmount: raw,
      isLoading: isLoading || result === undefined,
      isArc: chain.id === ACTIVE_ARC_CHAIN.id,
    }
  })

  // Total across all chains using raw bigints to avoid float errors
  const loadedBalances = balances.filter((b) => b.amount !== '—')
  const totalRaw = loadedBalances.reduce((sum, b) => sum + b.rawAmount, 0n)
  const allLoaded = balances.every((b) => !b.isLoading)

  // Use the Arc chain's decimals as the display decimals (all USDC is 6dp)
  const displayDecimals = usdcDecimalsFor(ACTIVE_ARC_CHAIN.id)
  const totalFormatted = loadedBalances.length === 0
    ? null
    : (allLoaded ? '' : '~') + Amount.fromRaw(totalRaw, displayDecimals).toFixed(2)

  const arcBalance = balances.find((b) => b.isArc)
  const sourceBalances = balances.filter((b) => !b.isArc)

  return {
    balances,
    sourceBalances,
    arcBalance,
    totalFormatted,
    isLoading,
    refetch,
  }
}

export type UseMultiChainBalancesReturn = ReturnType<typeof useMultiChainBalances>

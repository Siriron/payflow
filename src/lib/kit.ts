/**
 * App Kit facade.
 * Single boundary between Payflow and @circle-fin/app-kit.
 * All CCTP details stay behind this file.
 *
 * Source chains use App Kit string identifiers (e.g. "Base_Sepolia", "Arc_Testnet").
 * Destination is always Arc or Arc_Testnet depending on ACTIVE_CHAIN.
 */

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import type { EIP1193Provider } from 'viem'
import { type PaymentIntent, transition, updateIntent } from './intent'
import { parsePayflowError } from './errors'

/** Minimal shape of the object returned by appKit.bridge() / appKit.retry() */
interface BridgeKitResult {
  state: string
  steps?: Array<{ name: string; txHash?: string }>
}

/** Cast the untyped AppKit instance once at the boundary */
interface AppKitWithBridge {
  on: AppKit['on']
  bridge(params: unknown): Promise<BridgeKitResult>
  retryBridge(result: unknown, params: unknown): Promise<BridgeKitResult>
}

// Singleton — App Kit does not need to be re-instantiated per transfer
export const appKit = new AppKit()
const kit = appKit as unknown as AppKitWithBridge

/** Maps numeric chain IDs to App Kit string identifiers. */
export const CHAIN_ID_TO_KIT_NAME: Record<number, string> = {
  // Testnets
  5042002: 'Arc_Testnet',
  11155111: 'Ethereum_Sepolia',
  84532: 'Base_Sepolia',
  421614: 'Arbitrum_Sepolia',
  43113: 'Avalanche_Fuji',
  11155420: 'Optimism_Sepolia',
  1301: 'Unichain_Sepolia',
  80002: 'Polygon_Amoy_Testnet',
  // Mainnets
  5042: 'Arc',
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  10: 'Optimism',
  137: 'Polygon',
}

export function getKitChainName(chainId: number): string | null {
  return CHAIN_ID_TO_KIT_NAME[chainId] ?? null
}

export interface TransferExecutionParams {
  intent: PaymentIntent
  provider: EIP1193Provider
  /** Whether to use Arc mainnet (true) or testnet (false) as the destination */
  useMainnet: boolean
}

export interface TransferResult {
  success: boolean
  destinationTxHash: string | null
  sourceTxHash: string | null
  transferId: string | null
  /** Raw result for retry */
  rawResult: unknown
  error: string | null
}

/**
 * Execute a CCTP bridge transfer.
 * Source chain = intent.sourceChain (App Kit string).
 * Destination = Arc / Arc_Testnet.
 * Uses Forwarding Service (useForwarder: true) — no destination wallet needed.
 * Recipient receives funds on Arc.
 */
export async function executeTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider, useMainnet } = params
  const destinationChain = useMainnet ? 'Arc' : 'Arc_Testnet'

  let updatedIntent = transition(intent, 'awaiting_signature')

  try {
    const adapter = await createViemAdapterFromProvider({ provider })

    // One-shot handlers stored so they can be removed after bridge() returns —
    // prevents listener accumulation on retries.
    const onApprove = () => {
      updatedIntent = transition(updatedIntent, 'submitted')
    }
    type BurnPayload = { protocol?: string; values?: Record<string, unknown> }
    const onBurn = (payload: BurnPayload) => {
      const txHash =
        payload.protocol === 'cctp' && payload.values && 'txHash' in payload.values
          ? (payload.values['txHash'] as string | undefined) ?? null
          : null
      updatedIntent = transition(updatedIntent, 'settling', { sourceTxHash: txHash })
    }

    ;(appKit as unknown as { on: (e: string, h: unknown) => void }).on('bridge.approve', onApprove)
    ;(appKit as unknown as { on: (e: string, h: unknown) => void }).on('bridge.burn', onBurn)

    type OffFn = (e: string, h: unknown) => void
    const off = (appKit as unknown as { off?: OffFn; removeListener?: OffFn })

    let result: BridgeKitResult
    try {
      result = await kit.bridge({
        from: { adapter, chain: intent.sourceChain },
        to: {
          recipientAddress: intent.recipient,
          chain: destinationChain,
          useForwarder: true,
        },
        amount: intent.amount,
      })
    } finally {
      // Always remove listeners — prevents accumulation across retries
      try { (off.off ?? off.removeListener)?.('bridge.approve', onApprove) } catch { /* no-op */ }
      try { (off.off ?? off.removeListener)?.('bridge.burn', onBurn) } catch { /* no-op */ }
    }

    const steps = result.steps ?? []
    const burnStep = steps.find((s) => s.name === 'burn')
    const mintStep = steps.find((s) => s.name === 'mint')
    const sourceTxHash: string | null = burnStep?.txHash ?? null
    const destinationTxHash: string | null = mintStep?.txHash ?? null

    if (result.state === 'success') {
      transition(updatedIntent, 'completed', {
        sourceTxHash,
        destinationTxHash,
        bridgeResult: JSON.stringify(result),
      })
      return { success: true, destinationTxHash, sourceTxHash, transferId: null, rawResult: result, error: null }
    } else {
      // Soft error — may be recoverable
      transition(updatedIntent, 'recoverable', {
        sourceTxHash,
        bridgeResult: JSON.stringify(result),
        errorMessage: parsePayflowError(new Error(result.state)).message,
      })
      return {
        success: false,
        destinationTxHash: null,
        sourceTxHash,
        transferId: null,
        rawResult: result,
        error: parsePayflowError(new Error(result.state)).message,
      }
    }
  } catch (err) {
    const { code, message } = parsePayflowError(err)
    const nextState = code === 'CANCELLED' ? 'cancelled' : 'failed'
    transition(updatedIntent, nextState, { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: null, transferId: null, rawResult: null, error: message }
  }
}

/**
 * Retry a recoverable transfer.
 * Resumes from the failed step — never re-runs the full bridge from scratch.
 */
export async function retryTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider } = params

  if (!intent.bridgeResult) {
    updateIntent(intent.id, { state: 'failed', errorMessage: 'No recoverable state found.' })
    return { success: false, destinationTxHash: null, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: 'No recoverable state found.' }
  }

  let updatedIntent = transition(intent, 'settling')

  try {
    const adapter = await createViemAdapterFromProvider({ provider })
    const savedResult: unknown = JSON.parse(intent.bridgeResult)

    const retryResult = await kit.retryBridge(savedResult, { from: adapter, to: adapter })

    const steps = retryResult.steps ?? []
    const mintStep = steps.find((s) => s.name === 'mint')
    const destinationTxHash: string | null = mintStep?.txHash ?? null

    if (retryResult.state === 'success') {
      transition(updatedIntent, 'completed', { destinationTxHash, bridgeResult: JSON.stringify(retryResult) })
      return { success: true, destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: retryResult, error: null }
    } else {
      transition(updatedIntent, 'failed', { errorMessage: parsePayflowError(new Error(retryResult.state)).message })
      return {
        success: false,
        destinationTxHash: null,
        sourceTxHash: intent.sourceTxHash,
        transferId: null,
        rawResult: retryResult,
        error: parsePayflowError(new Error(retryResult.state)).message,
      }
    }
  } catch (err) {
    const { message } = parsePayflowError(err)
    transition(updatedIntent, 'failed', { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: message }
  }
}

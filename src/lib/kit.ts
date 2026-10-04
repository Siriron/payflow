/**
 * App Kit facade.
 * Single boundary between Payflow and @circle-fin/app-kit.
 * All CCTP details stay behind this file.
 *
 * Source chains use App Kit string identifiers (e.g. "Base", "Arc").
 * Destination is always Arc or Arc_Testnet depending on ACTIVE_ARC_CHAIN.
 */

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import type { EIP1193Provider } from 'viem'
import { type PaymentIntent, transition, updateIntent } from './intent'
import { parsePayflowError } from './errors'
import { ACTIVE_ARC_CHAIN } from '../config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal shape we need from a bridge result.
 * Step names from the SDK are lowercase ('burn', 'mint', 'approve').
 */
interface BridgeStep {
  name: string
  txHash?: string
  state?: string
  errorMessage?: string
  error?: unknown
}

interface BridgeKitResult {
  state: string
  steps?: BridgeStep[]
}

/** Cast the AppKit instance to just what Payflow needs. */
interface AppKitBridge {
  on: AppKit['on']
  bridge(params: unknown): Promise<BridgeKitResult>
  retryBridge(result: BridgeKitResult, context: { from: unknown; to?: unknown }): Promise<BridgeKitResult>
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const appKit = new AppKit()
const kit = appKit as unknown as AppKitBridge

// ---------------------------------------------------------------------------
// In-memory result cache
// Keeps the live BridgeKitResult object (not JSON) so retryBridge can resume
// internal SDK state that doesn't survive serialization.
// ---------------------------------------------------------------------------
const liveResultCache = new Map<string, BridgeKitResult>()

/** @internal — exposed for testing only */
export function _clearResultCache(intentId: string) {
  liveResultCache.delete(intentId)
}

// ---------------------------------------------------------------------------
// Chain name map
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a step by name, case-insensitively. */
function findStep(steps: BridgeStep[], name: string): BridgeStep | undefined {
  const lower = name.toLowerCase()
  return steps.find((s) => s.name.toLowerCase() === lower)
}

/** Destination chain kit string derived from ACTIVE_ARC_CHAIN. */
function destinationChain(): string {
  return CHAIN_ID_TO_KIT_NAME[ACTIVE_ARC_CHAIN.id] ?? 'Arc'
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TransferExecutionParams {
  intent: PaymentIntent
  provider: EIP1193Provider
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

// ---------------------------------------------------------------------------
// executeTransfer
// ---------------------------------------------------------------------------

/**
 * Execute a CCTP bridge transfer.
 * Source chain = intent.sourceChain (App Kit string, e.g. "Base").
 * Destination = Arc / Arc_Testnet via Forwarding Service (no destination wallet).
 */
export async function executeTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider } = params

  let updatedIntent = transition(intent, 'awaiting_signature')

  try {
    const adapter = await createViemAdapterFromProvider({ provider })

    // One-shot event handlers — removed in the finally block.
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

    const kitEmitter = appKit as unknown as { on: (e: string, h: unknown) => void; off?: (e: string, h: unknown) => void; removeListener?: (e: string, h: unknown) => void }
    kitEmitter.on('bridge.approve', onApprove)
    kitEmitter.on('bridge.burn', onBurn)

    let result: BridgeKitResult
    try {
      result = await kit.bridge({
        from: { adapter, chain: intent.sourceChain },
        to: {
          // ForwarderDestination — no adapter needed on Arc; Circle's relay mints
          chain: destinationChain(),
          recipientAddress: intent.recipient,
          useForwarder: true,
        },
        amount: intent.amount, // decimal string e.g. "0.01"
      })
    } finally {
      try { (kitEmitter.off ?? kitEmitter.removeListener)?.('bridge.approve', onApprove) } catch { /* no-op */ }
      try { (kitEmitter.off ?? kitEmitter.removeListener)?.('bridge.burn', onBurn) } catch { /* no-op */ }
    }

    const steps = result.steps ?? []
    const burnStep = findStep(steps, 'burn')
    const mintStep = findStep(steps, 'mint')
    const sourceTxHash: string | null = burnStep?.txHash ?? null
    const destinationTxHash: string | null = mintStep?.txHash ?? null

    if (result.state === 'success') {
      liveResultCache.delete(intent.id)
      transition(updatedIntent, 'completed', {
        sourceTxHash,
        destinationTxHash,
        bridgeResult: JSON.stringify({ state: result.state, stepsCount: steps.length }),
      })
      return { success: true, destinationTxHash, sourceTxHash, transferId: null, rawResult: result, error: null }
    } else {
      // Keep the live result in memory for retry — do NOT rely on JSON roundtrip.
      liveResultCache.set(intent.id, result)
      transition(updatedIntent, 'recoverable', {
        sourceTxHash,
        bridgeResult: JSON.stringify({ state: result.state, sourceTxHash }),
        errorMessage: buildErrorMessage(result),
      })
      return {
        success: false,
        destinationTxHash: null,
        sourceTxHash,
        transferId: null,
        rawResult: result,
        error: buildErrorMessage(result),
      }
    }
  } catch (err) {
    const { code, message } = parsePayflowError(err)
    const nextState = code === 'CANCELLED' ? 'cancelled' : 'failed'
    transition(updatedIntent, nextState, { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: null, transferId: null, rawResult: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// retryTransfer
// ---------------------------------------------------------------------------

/**
 * Retry a recoverable transfer.
 * Uses the live in-memory BridgeKitResult when available (same session).
 * Falls back to a full re-bridge if the session was reloaded.
 */
export async function retryTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider } = params

  const liveResult = liveResultCache.get(intent.id)

  // No live result and no stored source tx hash — nothing to retry.
  if (!liveResult && !intent.sourceTxHash) {
    updateIntent(intent.id, { state: 'failed', errorMessage: 'No recoverable state found.' })
    return { success: false, destinationTxHash: null, sourceTxHash: null, transferId: null, rawResult: null, error: 'No recoverable state found.' }
  }

  let updatedIntent = transition(intent, 'settling')

  try {
    const adapter = await createViemAdapterFromProvider({ provider })

    let retryResult: BridgeKitResult

    if (liveResult) {
      // Fast path: SDK resumes from the failed step internally.
      // ForwarderDestination retry — no destination adapter needed.
      retryResult = await kit.retryBridge(liveResult, {
        from: adapter,
        to: undefined,
      })
    } else {
      // Slow path: session was reloaded, live result lost.
      // Re-execute the full bridge from scratch.
      retryResult = await kit.bridge({
        from: { adapter, chain: intent.sourceChain },
        to: {
          chain: destinationChain(),
          recipientAddress: intent.recipient,
          useForwarder: true,
        },
        amount: intent.amount,
      })
    }

    const steps = retryResult.steps ?? []
    const mintStep = findStep(steps, 'mint')
    const destinationTxHash: string | null = mintStep?.txHash ?? null

    if (retryResult.state === 'success') {
      liveResultCache.delete(intent.id)
      transition(updatedIntent, 'completed', {
        destinationTxHash,
        bridgeResult: JSON.stringify({ state: retryResult.state }),
      })
      return { success: true, destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: retryResult, error: null }
    } else {
      // Keep updated live result for another retry attempt.
      liveResultCache.set(intent.id, retryResult)
      transition(updatedIntent, 'failed', { errorMessage: buildErrorMessage(retryResult) })
      return {
        success: false,
        destinationTxHash: null,
        sourceTxHash: intent.sourceTxHash,
        transferId: null,
        rawResult: retryResult,
        error: buildErrorMessage(retryResult),
      }
    }
  } catch (err) {
    const { message } = parsePayflowError(err)
    transition(updatedIntent, 'failed', { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildErrorMessage(result: BridgeKitResult): string {
  const steps = result.steps ?? []
  // Find the first failed step with an error message.
  const failedStep = steps.find((s) => s.state === 'error' && s.errorMessage)
  if (failedStep?.errorMessage) return failedStep.errorMessage
  return parsePayflowError(new Error(result.state)).message
}

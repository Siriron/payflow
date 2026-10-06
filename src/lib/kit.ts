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
import { createPublicClient, createWalletClient, custom, erc20Abi, http, type EIP1193Provider } from 'viem'
import { type PaymentIntent, transition, updateIntent } from './intent'
import { parsePayflowError } from './errors'
import { ACTIVE_ARC_CHAIN } from '../config'
import { getUsdc } from '../onchain-facts'
import { Amount } from '../onchain-money'

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
  estimateBridge(params: unknown): Promise<EstimateKitResult>
  retryBridge(result: BridgeKitResult, context: { from: unknown; to?: unknown }): Promise<BridgeKitResult>
}

interface EstimateFeeItem {
  type: string
  token: string
  amount: string | null
  error?: unknown
}

interface EstimateKitResult {
  amount: string
  fees: EstimateFeeItem[]
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
// Public estimate
// ---------------------------------------------------------------------------

export interface EstimateResult {
  /** Forwarder relay fee in USDC decimal string (e.g. "0.05"). Null if estimate failed. */
  fee: string | null
  /** Amount recipient will receive = amount - fee. Null if estimate failed. */
  recipientReceives: string | null
  /** True when fee >= amount (send would fail). */
  feeExceedsAmount: boolean
  /** Raw error if the estimate call threw. */
  error: string | null
}

/**
 * Estimate the CCTP bridge fee without a wallet signature.
 * The quote (relay fee) comes from Circle's API for the exact source → Arc route,
 * so it is known for every supported source chain. Source-chain gas is separate:
 * the wallet shows it when it asks for the signature.
 */
export async function estimateTransfer(params: {
  sourceChain: string
  amount: string
  recipient: string
  provider: EIP1193Provider
}): Promise<EstimateResult> {
  // The fee quote comes from Circle's API and can fail transiently. Try once more
  // before giving up so the Review screen can show a real fee.
  const first = await estimateTransferOnce(params)
  if (first.fee !== null || first.feeExceedsAmount) return first
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const second = await estimateTransferOnce(params)
  return second.fee !== null || second.feeExceedsAmount ? second : first
}

async function estimateTransferOnce(params: {
  sourceChain: string
  amount: string
  recipient: string
  provider: EIP1193Provider
}): Promise<EstimateResult> {
  const { sourceChain, amount, recipient, provider } = params
  const dest = destinationChain()

  try {
    // App Kit requires a source adapter even for a quote. This one is read-only here:
    // estimating never asks the wallet to sign anything.
    const adapter = await createViemAdapterFromProvider({ provider })
    const estimate = await kit.estimateBridge({
      from: { adapter, chain: sourceChain },
      to: { chain: dest, recipientAddress: recipient, useForwarder: true },
      amount,
    })

    // Log raw estimate in dev so we can see the exact fee shape from the SDK.
    if (import.meta.env.DEV) console.debug('[kit] estimateBridge raw:', JSON.stringify(estimate))

    // Sum all fees with a non-null amount. The SDK may return the token symbol
    // as 'USDC', 'USDC.e', a contract address, or an empty string — accept all.
    let totalFeeUsdc = 0
    for (const f of estimate.fees) {
      if (f.amount) {
        const parsed = parseFloat(f.amount)
        if (!Number.isNaN(parsed) && parsed > 0) totalFeeUsdc += parsed
      }
    }

    const sendAmount = parseFloat(amount)
    const feeExceedsAmount = totalFeeUsdc >= sendAmount

    const feeStr = totalFeeUsdc > 0 ? totalFeeUsdc.toFixed(6).replace(/\.?0+$/, '') : null
    const recipientReceives =
      totalFeeUsdc > 0 && !feeExceedsAmount
        ? Math.max(0, sendAmount - totalFeeUsdc).toFixed(6).replace(/\.?0+$/, '')
        : null

    return { fee: feeStr, recipientReceives, feeExceedsAmount, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not estimate fee.'
    return { fee: null, recipientReceives: null, feeExceedsAmount: false, error: msg }
  }
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
// Arc settlement verification
// ---------------------------------------------------------------------------

type ArcVerification = 'confirmed' | 'reverted' | 'unconfirmed'

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

/**
 * Reads the destination (mint) transaction receipt directly from Arc.
 * A payment is only marked completed when this returns 'confirmed'.
 * Polls briefly because the public RPC can lag behind the Forwarding Service.
 */
async function verifyArcMint(txHash: string | null): Promise<ArcVerification> {
  if (!txHash || !TX_HASH_RE.test(txHash)) return 'unconfirmed'
  const client = createPublicClient({ chain: ACTIVE_ARC_CHAIN, transport: http() })
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
      return receipt.status === 'success' ? 'confirmed' : 'reverted'
    } catch {
      // Not found yet (or RPC hiccup) — wait and try again.
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  return 'unconfirmed'
}

const MSG_UNCONFIRMED =
  'Your payment was sent, but Payflow could not confirm it on Arc yet. Check again in a moment.'
const MSG_REVERTED = 'The settlement transaction on Arc did not succeed. Your funds were not received.'

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

function msgAlreadySent(sourceTxHash: string): string {
  return (
    `Your USDC was already sent from the source chain (${shortHash(sourceTxHash)}). ` +
    'Circle completes the Arc side automatically and it can take a few minutes. ' +
    'Do not send again — check the source-chain explorer for this transaction.'
  )
}

// ---------------------------------------------------------------------------
// Direct transfer on Arc (wallet already on Arc — no bridge)
// ---------------------------------------------------------------------------

/** True when the payer is already on Arc, so USDC moves with a plain ERC-20 transfer. */
export function isDirectArcIntent(intent: Pick<PaymentIntent, 'sourceChainId'>): boolean {
  return intent.sourceChainId === ACTIVE_ARC_CHAIN.id
}

/**
 * Sends USDC on Arc with a standard ERC-20 transfer signed in the user's wallet.
 * Gas is paid in USDC (Arc's native token). No App Kit, no bridge, no relay fee.
 * Completion uses the same rule as bridged payments: the transaction receipt is
 * read from Arc and must have succeeded.
 */
async function executeDirectTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider } = params
  let updatedIntent = transition(intent, 'awaiting_signature')

  try {
    const usdc = getUsdc(ACTIVE_ARC_CHAIN.id)
    if (!usdc) throw new Error('USDC is not configured for this network.')
    const value = Amount.parse(intent.amount, usdc.decimals).raw

    const walletClient = createWalletClient({
      account: intent.payer as `0x${string}`,
      chain: ACTIVE_ARC_CHAIN,
      transport: custom(provider),
    })

    // Make sure the wallet is on Arc before it is asked to sign.
    if ((await walletClient.getChainId()) !== ACTIVE_ARC_CHAIN.id) {
      await walletClient.switchChain({ id: ACTIVE_ARC_CHAIN.id })
    }

    const hash = await walletClient.writeContract({
      address: usdc.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [intent.recipient as `0x${string}`, value],
    })

    // Signed and broadcast. The same hash is both the sent and the settled transaction.
    updatedIntent = transition(updatedIntent, 'settling', { destinationTxHash: hash })

    const verification = await verifyArcMint(hash)
    if (verification === 'confirmed') {
      transition(updatedIntent, 'completed', {
        destinationTxHash: hash,
        bridgeResult: JSON.stringify({ method: 'direct', verification }),
        errorMessage: null,
      })
      return { success: true, destinationTxHash: hash, sourceTxHash: null, transferId: null, rawResult: null, error: null }
    }
    const message = verification === 'reverted' ? MSG_REVERTED : MSG_UNCONFIRMED
    transition(updatedIntent, verification === 'reverted' ? 'failed' : 'recoverable', {
      destinationTxHash: hash,
      bridgeResult: JSON.stringify({ method: 'direct', verification }),
      errorMessage: message,
    })
    return { success: false, destinationTxHash: hash, sourceTxHash: null, transferId: null, rawResult: null, error: message }
  } catch (err) {
    const { code, message } = parsePayflowError(err)
    const nextState = code === 'CANCELLED' ? 'cancelled' : 'failed'
    transition(updatedIntent, nextState, { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: null, transferId: null, rawResult: null, error: message }
  }
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

  // Never start a second payment for an intent that already has a transaction on chain.
  if (intent.sourceTxHash) {
    const message = msgAlreadySent(intent.sourceTxHash)
    return { success: false, destinationTxHash: null, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: message }
  }
  if (intent.destinationTxHash) {
    return { success: false, destinationTxHash: intent.destinationTxHash, sourceTxHash: null, transferId: null, rawResult: null, error: MSG_UNCONFIRMED }
  }

  // Wallet already on Arc: plain USDC transfer, no bridge.
  if (isDirectArcIntent(intent)) return executeDirectTransfer(params)

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
      const verification = await verifyArcMint(destinationTxHash)
      if (verification === 'confirmed') {
        transition(updatedIntent, 'completed', {
          sourceTxHash,
          destinationTxHash,
          bridgeResult: JSON.stringify({ state: result.state, stepsCount: steps.length }),
        })
        return { success: true, destinationTxHash, sourceTxHash, transferId: null, rawResult: result, error: null }
      }
      const message = verification === 'reverted' ? MSG_REVERTED : MSG_UNCONFIRMED
      transition(updatedIntent, verification === 'reverted' ? 'failed' : 'recoverable', {
        sourceTxHash,
        destinationTxHash,
        bridgeResult: JSON.stringify({ state: result.state, verification }),
        errorMessage: message,
      })
      return { success: false, destinationTxHash, sourceTxHash, transferId: null, rawResult: result, error: message }
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
 * - Destination hash already known: re-verify it on Arc (no signature).
 * - Live in-memory BridgeKitResult available (same session): resume from the failed step.
 * - Session reloaded after the burn: never re-bridge (that would burn twice); tell the user.
 */
export async function retryTransfer(params: TransferExecutionParams): Promise<TransferResult> {
  const { intent, provider } = params

  // Settlement already reported: re-check it on Arc. No wallet signature involved.
  if (intent.destinationTxHash) {
    const verification = await verifyArcMint(intent.destinationTxHash)
    if (verification === 'confirmed') {
      transition(intent, 'completed', { errorMessage: null })
      return { success: true, destinationTxHash: intent.destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: null }
    }
    const message = verification === 'reverted' ? MSG_REVERTED : MSG_UNCONFIRMED
    transition(intent, verification === 'reverted' ? 'failed' : 'recoverable', { errorMessage: message })
    return { success: false, destinationTxHash: intent.destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: message }
  }

  const liveResult = liveResultCache.get(intent.id)

  // No live result and no stored source tx hash — nothing to retry.
  if (!liveResult && !intent.sourceTxHash) {
    updateIntent(intent.id, { state: 'failed', errorMessage: 'No recoverable state found.' })
    return { success: false, destinationTxHash: null, sourceTxHash: null, transferId: null, rawResult: null, error: 'No recoverable state found.' }
  }

  // Session was reloaded (live result lost) but the burn already happened.
  // Re-running the bridge would ask for a new signature and burn again, so don't.
  if (!liveResult && intent.sourceTxHash) {
    const message = msgAlreadySent(intent.sourceTxHash)
    updateIntent(intent.id, { errorMessage: message })
    return { success: false, destinationTxHash: null, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: null, error: message }
  }

  let updatedIntent = transition(intent, 'settling')

  try {
    const adapter = await createViemAdapterFromProvider({ provider })

    // Same-session resume: the SDK continues from the failed step internally.
    // ForwarderDestination retry — no destination adapter needed.
    // (liveResult is always defined here; the reload case returned above.)
    const retryResult: BridgeKitResult = await kit.retryBridge(liveResult as BridgeKitResult, {
      from: adapter,
      to: undefined,
    })

    const steps = retryResult.steps ?? []
    const mintStep = findStep(steps, 'mint')
    const destinationTxHash: string | null = mintStep?.txHash ?? null

    if (retryResult.state === 'success') {
      liveResultCache.delete(intent.id)
      const verification = await verifyArcMint(destinationTxHash)
      if (verification === 'confirmed') {
        transition(updatedIntent, 'completed', {
          destinationTxHash,
          bridgeResult: JSON.stringify({ state: retryResult.state }),
        })
        return { success: true, destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: retryResult, error: null }
      }
      const message = verification === 'reverted' ? MSG_REVERTED : MSG_UNCONFIRMED
      transition(updatedIntent, verification === 'reverted' ? 'failed' : 'recoverable', {
        destinationTxHash,
        bridgeResult: JSON.stringify({ state: retryResult.state, verification }),
        errorMessage: message,
      })
      return { success: false, destinationTxHash, sourceTxHash: intent.sourceTxHash, transferId: null, rawResult: retryResult, error: message }
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

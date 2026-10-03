/**
 * PaymentIntent — 8-state machine with localStorage persistence.
 * States: draft | quoting | ready | awaiting_signature | submitted | settling | completed | failed
 * Plus: recoverable | cancelled
 *
 * Invariants:
 * - never "completed" without a verified Arc txHash
 * - never double-submit: UI locked once awaiting_signature
 * - amounts stored as strings; never floats
 */

export type IntentState =
  | 'draft'
  | 'quoting'
  | 'ready'
  | 'awaiting_signature'
  | 'submitted'
  | 'settling'
  | 'completed'
  | 'recoverable'
  | 'failed'
  | 'cancelled'

export interface PaymentIntent {
  id: string
  /** Payer wallet address */
  payer: string
  /** Recipient Arc address */
  recipient: string
  /** Amount as decimal string e.g. "1.50" */
  amount: string
  /** Source chain App Kit string e.g. "Base_Sepolia" */
  sourceChain: string
  /** Source chain numeric ID */
  sourceChainId: number
  /** Destination always Arc */
  destinationChain: string
  state: IntentState
  /** Quote snapshot — fees as decimal string */
  estimatedFee: string | null
  /** Amount recipient will receive after fees */
  recipientAmount: string | null
  /** Source tx hash (burn/transfer) */
  sourceTxHash: string | null
  /** Destination Arc tx hash (mint/settle) */
  destinationTxHash: string | null
  /** Circle forwarding transferId if Forwarding Service used */
  transferId: string | null
  /** Serialised kit bridge result for retry */
  bridgeResult: string | null
  /** Associated payment request ID if this intent was triggered by /r/:id */
  requestId: string | null
  createdAt: number
  updatedAt: number
  errorMessage: string | null
}

const STORAGE_KEY = 'payflow:intents'

function generateId(): string {
  return `pi_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function createIntent(params: {
  payer: string
  recipient: string
  amount: string
  sourceChain: string
  sourceChainId: number
  destinationChain: string
  requestId?: string
}): PaymentIntent {
  const now = Date.now()
  return {
    id: generateId(),
    payer: params.payer,
    recipient: params.recipient,
    amount: params.amount,
    sourceChain: params.sourceChain,
    sourceChainId: params.sourceChainId,
    destinationChain: params.destinationChain,
    state: 'draft',
    estimatedFee: null,
    recipientAmount: null,
    sourceTxHash: null,
    destinationTxHash: null,
    transferId: null,
    bridgeResult: null,
    requestId: params.requestId ?? null,
    createdAt: now,
    updatedAt: now,
    errorMessage: null,
  }
}

/** Minimal required fields for a valid stored intent */
function isValidIntent(x: unknown): x is PaymentIntent {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o['id'] === 'string' &&
    typeof o['payer'] === 'string' &&
    typeof o['recipient'] === 'string' &&
    typeof o['amount'] === 'string' &&
    typeof o['state'] === 'string'
  )
}

export function loadAllIntents(): PaymentIntent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidIntent)
  } catch {
    return []
  }
}

export function loadIntent(id: string): PaymentIntent | null {
  return loadAllIntents().find((i) => i.id === id) ?? null
}

export function saveIntent(intent: PaymentIntent): void {
  const all = loadAllIntents().filter((i) => i.id !== intent.id)
  all.unshift({ ...intent, updatedAt: Date.now() })
  // Keep last 50
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)))
}

export function updateIntent(id: string, patch: Partial<PaymentIntent>): PaymentIntent | null {
  const intent = loadIntent(id)
  if (!intent) return null
  const updated: PaymentIntent = { ...intent, ...patch, id, updatedAt: Date.now() }
  saveIntent(updated)
  return updated
}

export function transition(
  intent: PaymentIntent,
  nextState: IntentState,
  patch?: Partial<PaymentIntent>,
): PaymentIntent {
  const updated: PaymentIntent = {
    ...intent,
    ...patch,
    state: nextState,
    updatedAt: Date.now(),
  }
  saveIntent(updated)
  return updated
}

/** Returns the most recent recoverable intent for this payer, if any. */
export function findRecoverableIntent(payer: string): PaymentIntent | null {
  return (
    loadAllIntents().find(
      (i) => i.payer.toLowerCase() === payer.toLowerCase() && i.state === 'recoverable',
    ) ?? null
  )
}

export function loadRecentIntents(payer: string, limit = 10): PaymentIntent[] {
  return loadAllIntents()
    .filter((i) => i.payer.toLowerCase() === payer.toLowerCase())
    .slice(0, limit)
}

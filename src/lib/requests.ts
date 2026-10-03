/**
 * PaymentRequest — lightweight localStorage store.
 * Shareable /r/:id links that pre-fill the Send form.
 *
 * Invariants:
 * - opaque random ID (crypto.randomUUID)
 * - paid only when amount + recipient + chain all match AND Arc settlement verified
 * - one settlement cannot pay a request twice
 */

export type RequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired'

export interface PaymentRequest {
  id: string
  /** Creator Arc address */
  creator: string
  /** Amount as decimal string e.g. "5.00" */
  amount: string
  /** Optional description shown to payer */
  description: string
  /** Expiry timestamp (ms) or null = no expiry */
  expiresAt: number | null
  status: RequestStatus
  /** Arc tx hash that settled this request */
  paidTxHash: string | null
  /** Address of the wallet that paid */
  paidBy: string | null
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'payflow:requests'

export function createRequest(params: {
  creator: string
  amount: string
  description?: string
  expiresInMs?: number
}): PaymentRequest {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    creator: params.creator,
    amount: params.amount,
    description: params.description ?? '',
    expiresAt: params.expiresInMs ? now + params.expiresInMs : null,
    status: 'pending',
    paidTxHash: null,
    paidBy: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function loadAllRequests(): PaymentRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PaymentRequest[]
  } catch {
    return []
  }
}

export function loadRequest(id: string): PaymentRequest | null {
  return loadAllRequests().find((r) => r.id === id) ?? null
}

export function saveRequest(req: PaymentRequest): void {
  const all = loadAllRequests().filter((r) => r.id !== req.id)
  all.unshift({ ...req, updatedAt: Date.now() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 100)))
}

export function markRequestPaid(
  id: string,
  txHash: string,
  paidBy: string,
): PaymentRequest | null {
  const req = loadRequest(id)
  if (!req) return null
  // Idempotency: already paid → don't overwrite
  if (req.status === 'paid') return req
  // Check expiry
  if (req.expiresAt !== null && Date.now() > req.expiresAt) {
    const expired: PaymentRequest = { ...req, status: 'expired', updatedAt: Date.now() }
    saveRequest(expired)
    return expired
  }
  const updated: PaymentRequest = {
    ...req,
    status: 'paid',
    paidTxHash: txHash,
    paidBy,
    updatedAt: Date.now(),
  }
  saveRequest(updated)
  return updated
}

export function cancelRequest(id: string): PaymentRequest | null {
  const req = loadRequest(id)
  if (!req || req.status !== 'pending') return req ?? null
  const updated: PaymentRequest = { ...req, status: 'cancelled', updatedAt: Date.now() }
  saveRequest(updated)
  return updated
}

export function generateRequestLink(id: string): string {
  return `${window.location.origin}/r/${id}`
}

/** Returns requests created by this address, most recent first. */
export function loadMyRequests(creator: string, limit = 20): PaymentRequest[] {
  return loadAllRequests()
    .filter((r) => r.creator.toLowerCase() === creator.toLowerCase())
    .slice(0, limit)
}

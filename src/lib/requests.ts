/**
 * PaymentRequest — self-contained shareable links.
 *
 * A request link is /r/<token>, where the token is the request itself
 * (creator address, amount, note, expiry, id) encoded in the URL. It resolves in
 * any browser with no server or database. The creator's browser also keeps a
 * local copy in localStorage, used for status tracking.
 *
 * Invariants:
 * - the token is validated on decode (address, amount, lengths); invalid links resolve to nothing
 * - "paid" status is local to the browser that completed the payment — links carry no shared state
 * - markRequestPaid is idempotent per browser
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

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const AMOUNT_RE = /^\d+(\.\d{1,6})?$/
const MAX_DESCRIPTION = 80

/** Normalises user-typed amounts ("5.", ".5") and returns null if unusable. */
export function normalizeRequestAmount(raw: string): string | null {
  let v = raw.trim()
  if (v.startsWith('.')) v = `0${v}`
  if (v.endsWith('.')) v = v.slice(0, -1)
  return AMOUNT_RE.test(v) && Number(v) > 0 ? v : null
}

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

// ---------------------------------------------------------------------------
// Self-contained link token
// ---------------------------------------------------------------------------

interface LinkPayload {
  v: 1
  i: string
  c: string
  a: string
  d: string
  e: number | null
  t: number
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeRequestToken(req: PaymentRequest): string {
  const payload: LinkPayload = {
    v: 1,
    i: req.id,
    c: req.creator,
    a: req.amount,
    d: req.description,
    e: req.expiresAt,
    t: req.createdAt,
  }
  return toBase64Url(JSON.stringify(payload))
}

/** Decodes and validates a link token. Returns null for anything malformed. */
export function decodeRequestToken(token: string): PaymentRequest | null {
  try {
    if (!/^[A-Za-z0-9_-]{20,1000}$/.test(token)) return null
    const p = JSON.parse(fromBase64Url(token)) as Partial<LinkPayload>
    if (p.v !== 1) return null
    if (typeof p.i !== 'string' || p.i.length < 8 || p.i.length > 64) return null
    if (typeof p.c !== 'string' || !ADDRESS_RE.test(p.c)) return null
    if (typeof p.a !== 'string' || !AMOUNT_RE.test(p.a) || !(Number(p.a) > 0)) return null
    if (typeof p.d !== 'string' || p.d.length > MAX_DESCRIPTION) return null
    if (p.e !== null && (typeof p.e !== 'number' || !Number.isFinite(p.e))) return null
    const createdAt = typeof p.t === 'number' && Number.isFinite(p.t) ? p.t : Date.now()
    return {
      id: p.i,
      creator: p.c,
      amount: p.a,
      description: p.d,
      expiresAt: p.e,
      status: 'pending',
      paidTxHash: null,
      paidBy: null,
      createdAt,
      updatedAt: createdAt,
    }
  } catch {
    return null
  }
}

/**
 * Resolves the /r/:param value.
 * 1. A request stored in this browser (covers older /r/<uuid> links and paid status).
 * 2. Otherwise the request carried inside the link itself, overlaid with any local status.
 */
export function resolveRequest(param: string): PaymentRequest | null {
  const local = loadRequest(param)
  if (local) return local
  const decoded = decodeRequestToken(param)
  if (!decoded) return null
  return loadRequest(decoded.id) ?? decoded
}

export function generateRequestLink(req: PaymentRequest): string {
  return `${window.location.origin}/r/${encodeRequestToken(req)}`
}

/** Returns requests created by this address, most recent first. */
export function loadMyRequests(creator: string, limit = 20): PaymentRequest[] {
  return loadAllRequests()
    .filter((r) => r.creator.toLowerCase() === creator.toLowerCase())
    .slice(0, limit)
}

/**
 * On-chain USDC history for a wallet, read from the Arc Explorer's public API.
 * Used by Activity so history survives a cleared browser and includes payments
 * the wallet received. Everything is validated; anything unexpected is dropped,
 * and any failure surfaces as a thrown error the caller can show or ignore.
 */

import { ACTIVE_ARC_CHAIN } from '../config'
import { buildTxExplorerUrl, getUsdc } from '../onchain-facts'
import { formatUnitsExact } from '../onchain-money'

export interface ChainTransfer {
  txHash: string
  direction: 'sent' | 'received'
  /** The other side of the transfer, or null for a mint (from the zero address). */
  counterparty: string | null
  /** Decimal USDC string */
  amount: string
  /** ms since epoch, or null if the explorer gave no usable time */
  timestamp: number | null
  isMint: boolean
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_ITEMS = 25
const TIMEOUT_MS = 10_000

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function apiBase(): string | null {
  try {
    const sample = buildTxExplorerUrl(ACTIVE_ARC_CHAIN.id, `0x${'0'.repeat(64)}`)
    return `${new URL(sample).origin}/api/v2`
  } catch {
    return null
  }
}

/** Parses one explorer item. Returns null if any required field is missing or malformed. */
export function parseTransferItem(
  raw: unknown,
  me: string,
  usdcAddress: string,
  usdcDecimals: number,
): ChainTransfer | null {
  const item = asRecord(raw)
  if (!item) return null

  const txHash = str(item['transaction_hash']) ?? str(item['tx_hash'])
  const from = str(asRecord(item['from'])?.['hash'])
  const to = str(asRecord(item['to'])?.['hash'])
  if (!txHash || !TX_HASH_RE.test(txHash)) return null
  if (!from || !to || !ADDRESS_RE.test(from) || !ADDRESS_RE.test(to)) return null

  // Only USDC. The explorer is asked for it, but never trust the filter.
  const token = asRecord(item['token'])
  const tokenAddress = str(token?.['address_hash']) ?? str(token?.['address'])
  if (!tokenAddress || tokenAddress.toLowerCase() !== usdcAddress.toLowerCase()) return null

  const total = asRecord(item['total'])
  const value = str(total?.['value'])
  if (!value || !/^\d+$/.test(value)) return null
  const decimalsRaw = Number(str(total?.['decimals']) ?? str(token?.['decimals']) ?? usdcDecimals)
  const decimals = Number.isInteger(decimalsRaw) && decimalsRaw >= 0 && decimalsRaw <= 36 ? decimalsRaw : usdcDecimals

  const meLower = me.toLowerCase()
  const fromLower = from.toLowerCase()
  const toLower = to.toLowerCase()
  if (fromLower !== meLower && toLower !== meLower) return null

  const direction: ChainTransfer['direction'] = fromLower === meLower ? 'sent' : 'received'
  const other = direction === 'sent' ? to : from
  const isMint = direction === 'received' && other.toLowerCase() === ZERO_ADDRESS

  const ts = str(item['timestamp'])
  const parsedTs = ts ? Date.parse(ts) : NaN

  return {
    txHash,
    direction,
    counterparty: isMint ? null : other,
    amount: formatUnitsExact(BigInt(value), decimals),
    timestamp: Number.isFinite(parsedTs) ? parsedTs : null,
    isMint,
  }
}

export async function fetchArcUsdcTransfers(address: string, outerSignal?: AbortSignal): Promise<ChainTransfer[]> {
  const usdc = getUsdc(ACTIVE_ARC_CHAIN.id)
  const base = apiBase()
  if (!usdc || !base || !ADDRESS_RE.test(address)) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  outerSignal?.addEventListener('abort', onOuterAbort)

  try {
    const url = `${base}/addresses/${address}/token-transfers?type=ERC-20&token=${usdc.address}`
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Explorer responded ${res.status}`)
    const body = asRecord(await res.json())
    const items = Array.isArray(body?.['items']) ? (body['items'] as unknown[]) : null
    if (!items) throw new Error('Unexpected explorer response')

    const out: ChainTransfer[] = []
    for (const raw of items) {
      const t = parseTransferItem(raw, address, usdc.address, usdc.decimals)
      if (t) out.push(t)
      if (out.length >= MAX_ITEMS) break
    }
    return out
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}

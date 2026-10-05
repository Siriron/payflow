/**
 * Public payment verification.
 * Reads a transaction receipt straight from the Arc RPC and decodes the USDC
 * transfers inside it. Nothing here trusts data from the link, only the hash.
 */

import { createPublicClient, http, parseEventLogs, erc20Abi, type Log } from 'viem'
import { ACTIVE_ARC_CHAIN } from '../config'
import { getUsdc } from '../onchain-facts'
import { formatUnitsExact } from '../onchain-money'

export interface UsdcTransfer {
  from: string
  to: string
  /** Decimal USDC string, e.g. "9.95" */
  amount: string
  raw: bigint
}

export type PaymentVerification =
  | { status: 'invalid' }
  | { status: 'not_found' }
  | { status: 'reverted'; txHash: string }
  | {
      status: 'confirmed'
      txHash: string
      blockNumber: bigint
      timestamp: number | null
      /** USDC transfers in this transaction, largest first. Empty if none were decoded. */
      transfers: UsdcTransfer[]
    }

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

export function isTxHash(value: string): boolean {
  return TX_HASH_RE.test(value)
}

/** Decodes USDC Transfer events from receipt logs, largest first. Pure, no network. */
export function decodeUsdcTransfers(logs: readonly Log[], usdcAddress: string, decimals: number): UsdcTransfer[] {
  const ours = logs.filter((l) => l.address.toLowerCase() === usdcAddress.toLowerCase())
  const parsed = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: ours, strict: false })
  const out: UsdcTransfer[] = []
  for (const ev of parsed) {
    const { from, to, value } = ev.args
    if (typeof from !== 'string' || typeof to !== 'string' || typeof value !== 'bigint') continue
    out.push({ from, to, raw: value, amount: formatUnitsExact(value, decimals) })
  }
  return out.sort((a, b) => (a.raw === b.raw ? 0 : a.raw > b.raw ? -1 : 1))
}

export async function verifyArcPayment(txHash: string): Promise<PaymentVerification> {
  if (!isTxHash(txHash)) return { status: 'invalid' }
  const hash = txHash as `0x${string}`
  const client = createPublicClient({ chain: ACTIVE_ARC_CHAIN, transport: http() })

  let receipt
  try {
    receipt = await client.getTransactionReceipt({ hash })
  } catch {
    return { status: 'not_found' }
  }
  if (receipt.status !== 'success') return { status: 'reverted', txHash }

  let timestamp: number | null = null
  try {
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    timestamp = Number(block.timestamp) * 1000
  } catch { /* timestamp is optional */ }

  const usdc = getUsdc(ACTIVE_ARC_CHAIN.id)
  const transfers = usdc ? decodeUsdcTransfers(receipt.logs, usdc.address, usdc.decimals) : []
  return { status: 'confirmed', txHash, blockNumber: receipt.blockNumber, timestamp, transfers }
}

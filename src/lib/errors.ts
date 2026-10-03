/**
 * Payflow error mapper.
 * Maps raw SDK / wagmi / network errors to the 7 user-facing copy strings from the spec.
 * Never exposes internal error messages to the user.
 */

export type PayflowErrorCode =
  | 'CANCELLED'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_ADDRESS'
  | 'ROUTE_UNAVAILABLE'
  | 'STILL_SETTLING'
  | 'NEEDS_ATTENTION'
  | 'PAYMENT_FAILED'

export const PAYFLOW_ERROR_COPY: Record<PayflowErrorCode, string> = {
  CANCELLED: 'Payment cancelled. No payment was sent.',
  INSUFFICIENT_BALANCE: 'Not enough USDC.',
  INVALID_ADDRESS: 'Check the wallet address.',
  ROUTE_UNAVAILABLE: 'Route unavailable.',
  STILL_SETTLING: 'Payment still settling.',
  NEEDS_ATTENTION: 'Payment needs attention. It can be resumed.',
  PAYMENT_FAILED: "Payment couldn't be completed.",
}

export function parsePayflowError(err: unknown): { code: PayflowErrorCode; message: string } {
  const raw = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  if (
    raw.includes('user rejected') ||
    raw.includes('user denied') ||
    raw.includes('4001') ||
    raw.includes('action_rejected')
  ) {
    return { code: 'CANCELLED', message: PAYFLOW_ERROR_COPY.CANCELLED }
  }

  if (
    raw.includes('insufficient') ||
    raw.includes('exceeds balance') ||
    raw.includes('not enough') ||
    raw.includes('transfer amount exceeds')
  ) {
    return { code: 'INSUFFICIENT_BALANCE', message: PAYFLOW_ERROR_COPY.INSUFFICIENT_BALANCE }
  }

  if (
    raw.includes('invalid address') ||
    raw.includes('checksum') ||
    raw.includes('not a valid') ||
    raw.includes('bad address')
  ) {
    return { code: 'INVALID_ADDRESS', message: PAYFLOW_ERROR_COPY.INVALID_ADDRESS }
  }

  if (
    raw.includes('no route') ||
    raw.includes('unsupported chain') ||
    raw.includes('not supported') ||
    raw.includes('route unavailable')
  ) {
    return { code: 'ROUTE_UNAVAILABLE', message: PAYFLOW_ERROR_COPY.ROUTE_UNAVAILABLE }
  }

  if (raw.includes('timeout') || raw.includes('attestation') || raw.includes('still settling')) {
    return { code: 'STILL_SETTLING', message: PAYFLOW_ERROR_COPY.STILL_SETTLING }
  }

  if (raw.includes('soft error') || raw.includes('recoverable') || raw.includes('partial')) {
    return { code: 'NEEDS_ATTENTION', message: PAYFLOW_ERROR_COPY.NEEDS_ATTENTION }
  }

  return { code: 'PAYMENT_FAILED', message: PAYFLOW_ERROR_COPY.PAYMENT_FAILED }
}

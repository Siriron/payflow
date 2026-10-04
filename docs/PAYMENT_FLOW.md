# Payment flow

## Steps

1. **Send** – the user enters an amount (minimum 0.01 USDC) and a recipient. The address is validated with viem's `isAddress`. The source chain is the wallet's current chain and must be a supported CCTP source; otherwise the wallet is asked to switch.
2. **Estimate** – `estimateTransfer` asks App Kit for a quote with the Forwarding Service. If the fee would meet or exceed the amount, the user sees an "amount too small" message and no intent is created. If the estimate call fails, Payflow continues without a quote and any error surfaces during the transfer.
3. **Review** – the saved intent is shown with amount, fee and what the recipient receives. Confirming switches the wallet to the source chain if needed and opens Progress.
4. **Progress** – `executeTransfer` runs the App Kit bridge. The wallet prompts for approval and the burn; the UI shows Preparing → Waiting for wallet → Sending USDC → Settling on Arc → Complete.
5. **Receipt** – shown for completed intents, with explorer links for the source and destination transactions. If the payment came from a request link, the request is marked paid.

## Intent states

```
draft → awaiting_signature → submitted → settling → completed
                │                              │
                └─ cancelled (wallet rejected) ├─ recoverable ─→ settling (resume)
                                               └─ failed
```

| State | Meaning |
|---|---|
| `draft` | Intent created on Send, not yet submitted. Orphaned drafts are purged when returning to Send. |
| `awaiting_signature` | Wallet prompt is open. |
| `submitted` | Approval confirmed (`bridge.approve`). |
| `settling` | Burn confirmed (`bridge.burn`); source hash saved; waiting for the mint on Arc. |
| `completed` | App Kit reported success with a mint transaction hash. |
| `recoverable` | The bridge returned a non-success result; the burn may have happened. Can be resumed. |
| `failed` | Unrecoverable error or failed resume. |
| `cancelled` | User rejected in the wallet. No payment was sent. |

`quoting` and `ready` are declared in the type but not currently entered; the UI treats them like `draft`.

## What "completed" means

An intent becomes `completed` when `bridge()` returns `state === 'success'`. The destination hash is read from the SDK's `mint` step. Payflow does not make a second, independent query to Arc to confirm the mint; it relies on App Kit's result. Independent verification is on the roadmap.

## Recovery

When a transfer finishes in a non-success state the intent becomes `recoverable` and the Home screen shows a banner linking to Progress in resume mode.

- **Same session:** the live App Kit result is still in memory, so `retryBridge` continues from the failed step without a new burn.
- **After a reload:** the in-memory result is gone. Payflow falls back to running the full bridge again, which asks for a new signature and, if the original burn already happened, would burn USDC a second time. Before resuming after a reload, check the source-chain explorer for the original burn transaction.

Reducing this risk (by checking the stored `sourceTxHash` or the Circle attestation before re-bridging) is the most valuable robustness improvement.

## Payment requests

1. The creator enters an amount, optional note and optional expiry on `/request/new`. A record is saved locally and a `/r/<uuid>` link is generated.
2. The payer opens the link, connects a wallet and taps Pay. This creates an intent with `requestId` set and enters the normal Review flow. The creator cannot pay their own request.
3. On Receipt, `markRequestPaid` records the destination hash and payer. It is idempotent and checks expiry.

Because requests are stored in `localStorage`, links only resolve in the browser that created them. A server-backed store is needed for real-world sharing.

## Error handling

All errors pass through `parsePayflowError`, which matches known wallet/SDK phrases and returns one of seven fixed messages (see `src/lib/errors.ts`). Anything unrecognised becomes "Payment couldn't be completed."

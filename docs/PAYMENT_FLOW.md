# Payment flow

## Steps

1. **Send** – the user enters an amount (minimum 0.01 USDC) and a recipient. The address is validated with viem's `isAddress`. The source chain is the wallet's current chain and must be a supported CCTP source; otherwise the wallet is asked to switch.
2. **Estimate** – `estimateTransfer` asks App Kit for a quote with the Forwarding Service. App Kit needs a source adapter even for a quote, so Payflow builds a read-only one from the connected wallet; estimating never asks for a signature. The relay fee comes from Circle's API for the exact source → Arc route, so it is known for every supported source chain. Source-chain gas is separate and is shown by the wallet when it asks you to sign. If the fee would meet or exceed the amount, the user sees an "amount too small" message and no intent is created. If the estimate call fails, Payflow continues without a quote and any error surfaces during the transfer.
3. **Review** – the saved intent is shown with amount, fee and what the recipient receives. Confirming switches the wallet to the source chain if needed and opens Progress.
4. **Progress** – `executeTransfer` runs the App Kit bridge. The wallet prompts for approval and the burn; the UI shows Preparing → Waiting for wallet → Sending USDC → Settling on Arc → Complete.
5. **Verify** – App Kit reports success with the mint transaction hash. Payflow reads that transaction's receipt from Arc and requires it to have succeeded before marking the intent complete.
6. **Receipt** – shown for completed intents, with explorer links for the source and destination transactions. If the payment came from a request link, the request is marked paid in this browser.

## Direct transfer on Arc

If the connected wallet is already on Arc, there is nothing to bridge. Send skips the fee estimate and Review shows "Paid in USDC gas" instead of a relay fee. On confirm, Payflow signs one ERC-20 `transfer` on the Arc USDC contract (6-decimal amounts), moves the intent to `settling` once the hash exists, and applies the same completion rule: the receipt is read from Arc and must have succeeded. If Arc cannot confirm the receipt in time the intent becomes `recoverable`, and resuming only re-checks that hash — it never sends again.

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
| `completed` | App Kit reported success and the mint transaction receipt on Arc was read and succeeded. |
| `recoverable` | The bridge returned a non-success result, or the Arc receipt could not be confirmed yet. The burn may have happened. Can be resumed. |
| `failed` | Unrecoverable error, failed resume, or the Arc mint transaction reverted. |
| `cancelled` | User rejected in the wallet. No payment was sent. |

`quoting` and `ready` are declared in the type but not currently entered; the UI treats them like `draft`.

## What "completed" means

An intent becomes `completed` only when both are true:

1. `bridge()` returned `state === 'success'`. With the Forwarding Service, the SDK only reports success after Circle's relayer confirms the mint and returns its Arc transaction hash.
2. Payflow read that transaction's receipt from the Arc RPC (polling for up to about 20 seconds to allow for RPC lag) and its status is `success`.

If the receipt cannot be found in that window the intent becomes `recoverable` with "could not confirm yet". Resuming re-checks the same transaction without any wallet signature. If the receipt shows a revert the intent becomes `failed`.

## Recovery

When a transfer finishes in a non-success state the intent becomes `recoverable` and the Home screen shows a banner linking to Progress in resume mode. Resume picks the safest applicable path:

- **Settlement hash already known:** re-verify it on Arc. No signature needed.
- **Same session, bridge stalled:** the live App Kit result is still in memory, so `retryBridge` continues from the failed step without a new burn.
- **After a reload, burn already happened:** Payflow does **not** re-run the bridge, since that would ask for a new signature and burn again. It shows the source transaction and explains that Circle completes the Arc side automatically.
- **Nothing was ever sent:** no recoverable state; the intent is marked failed.

`executeTransfer` also refuses to start if the intent already has a source transaction hash.

## Verified receipt links

On a completed receipt, `Copy verified link` copies `/p/<transaction hash>`. Anyone who opens it gets a read-only page that fetches the receipt from Arc and shows the status, block, time and the USDC transfers in that transaction (largest first; smaller ones are usually fees). If the transaction has no decodable USDC transfer, the page says so and points to the explorer instead of guessing. The link can also carry `?to=<address>` (the receipt adds it automatically). The page then headlines the USDC that address received in the transaction, with any other transfers (typically the relay fee) listed below. The address comes from the link but the amount always comes from Arc: if the transaction contains no transfer to that address, the page says so. Without `?to=`, the page only calls a transfer "Received" when the transaction contains exactly one; otherwise it lists every transfer.

The link carries only a hash and an optional address, so it cannot be forged to show a payment that does not exist on Arc.

## Payment requests

1. The creator enters an amount and an optional note on `/request/new`. Payflow encodes the request (creator address, amount, note, expiry, id) into the link: `/r/<token>`. A copy is also kept in the creator's `localStorage`.
2. The payer opens the link in any browser. The token is decoded and validated (address format, amount format, field lengths); anything malformed shows "Link not found". The payer connects a wallet and taps Pay. This creates an intent with `requestId` set and enters the normal Review flow. The creator cannot pay their own request.
3. On Receipt, `markRequestPaid` records the destination hash and payer. It is idempotent and checks expiry.

Because the request travels inside the link, no server is needed and links work across devices. The trade-off is that there is no shared state: "paid" is recorded only in the browser that paid, so the creator does not see it, and the same link can be paid again. Older `/r/<uuid>` links still resolve in the browser that created them.

## Error handling

All errors pass through `parsePayflowError`, which matches known wallet/SDK phrases and returns one of seven fixed messages (see `src/lib/errors.ts`). Anything unrecognised becomes "Payment couldn't be completed."

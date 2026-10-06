# Security

## Model

Payflow is a non-custodial, client-only app. It has no server, no accounts and no stored secrets. All signing happens in the user's own wallet. Funds move wallet → CCTP burn on the source chain → mint on Arc via Circle's Forwarding Service.

## What the app does

| Area | Behaviour |
|---|---|
| Keys | Never accessed. The app only receives an EIP-1193 provider from the connected wallet. |
| Recipient | Validated with viem `isAddress` before an intent is created. |
| Amounts | Kept as decimal strings and handled as `bigint` with explicit decimals; no floating-point balance math. The fee estimate display uses JavaScript numbers for presentation only. |
| Double submit | Review disables the confirm button once submitted, and Progress starts each intent once per connector. |
| Double send | An intent that already has a transaction on chain can never start another payment, including resume after a page reload. |
| Verified links | `/p/:hash` accepts a validated transaction hash and an optional `?to=` address. Amounts and status are displayed from what the Arc RPC returns; if the address has no transfer in the transaction, the page says so. |
| Settlement | The Arc mint transaction receipt is read from the Arc RPC and must have succeeded before a payment is marked complete. |
| Request links | The token is decoded and validated (address, amount, field lengths) before use. The note is rendered as plain text. |
| Network | Chain is switched to the intent's source chain before signing. |
| Errors | Raw SDK/wallet errors are mapped to fixed messages. |
| Injection | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `src/`. |
| Secrets | None in the bundle. `.env` is gitignored and only `VITE_USE_MAINNET` is read. |

## Limits to be aware of

- Intent and request data in `localStorage` is user-editable and is not authoritative. Treat it as a convenience record, not proof of payment. Use the explorer links to verify.
- A request link is data, not a signed message: anyone can create a link naming any address, and links carry no shared "paid" state. Always check the recipient and amount on the Review screen before signing.
- If a reload interrupts settlement, Payflow will not re-send; Circle completes the Arc side and the source transaction can be checked on the explorer.
- No Content-Security-Policy is shipped in this repository. If deploying on your own infrastructure, add one at the hosting layer (connections are needed to chain RPCs, Circle endpoints and Google Fonts).
- The app has not had an independent security audit. Use small amounts first.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository (Security → Report a vulnerability) rather than a public issue.

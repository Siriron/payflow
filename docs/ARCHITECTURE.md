# Architecture

Payflow is a client-only single-page app. There is no backend, database or API of its own. The browser talks to the user's wallet, to chain RPC endpoints (through wagmi/viem) and to Circle App Kit.

## Layers

```
pages/        Screens and routing targets
components/   Presentational pieces
hooks/        Data hooks (balances, navigation)
lib/          Payment logic and storage (no React)
providers/    wagmi, ConnectKit, theme
config.ts     Network selection
onchain-*.ts  Chain facts and USDC math
```

### Routes (`App.tsx`)

| Path | Page | Purpose |
|---|---|---|
| `/` | Home | Total balance, Send / Request entry points, recoverable-payment banner |
| `/send` | Send | Amount and recipient entry, fee estimate |
| `/review` | Review | Fee summary, route details, confirm |
| `/progress` | Progress | Runs the transfer and shows live steps |
| `/receipt` | Receipt | Completed payment with explorer links and a verified-receipt link |
| `/activity` | Activity | Local payment history, resume actions |
| `/request/new` | NewRequest | Create a payment request link |
| `/r/:id` | ResolveRequest | Pay a request |
| `/p/:hash` | VerifiedPayment | Public, read-only verification of a payment from its Arc transaction hash |
| `*` | | Redirects to `/` |

`vercel.json` rewrites all paths to `index.html` so client-side routes survive a refresh.

### `config.ts`

Reads `VITE_USE_MAINNET`. When `'true'` the destination is Arc and sources are Ethereum, Base, Arbitrum, Avalanche and Optimism. Otherwise the destination is Arc Testnet and sources are the matching testnets. The wagmi config registers transports for all chains regardless, and uses the `injected()` connector only.

### `lib/kit.ts` — App Kit facade

The only module that imports `@circle-fin/app-kit`. It exposes:

- `estimateTransfer({ sourceChain, amount, recipient })` – calls `estimateBridge` with the Forwarding Service enabled, sums the returned fees and reports whether the fee would meet or exceed the amount.
- `executeTransfer({ intent, provider })` – builds a viem adapter from the wallet's EIP-1193 provider, runs `bridge`, and moves the intent through its states from App Kit events (`bridge.approve`, `bridge.burn`).
- `retryTransfer({ intent, provider })` – resumes a recoverable payment: re-verifies a known Arc hash, resumes the live SDK result in the same session, and never re-bridges after a reload (see [PAYMENT_FLOW.md](PAYMENT_FLOW.md#recovery)).
- `verifyArcMint` (internal) – reads the mint transaction receipt from the Arc RPC; a payment completes only if it succeeded.
- `isDirectArcIntent` / direct transfer – when the payer's wallet is already on Arc (`sourceChainId` equals the Arc chain ID), `executeTransfer` skips App Kit and sends a standard ERC-20 `transfer` on the Arc USDC contract, signed in the wallet. Gas is paid in USDC. The transaction receipt is then verified like any other payment.
- `CHAIN_ID_TO_KIT_NAME` – maps numeric chain IDs to App Kit chain names.

The destination uses `useForwarder: true`, so Circle's forwarding service mints on Arc and no destination wallet or adapter is needed.

### `lib/intent.ts` — payment intents

A `PaymentIntent` records payer, recipient, amount (decimal **string**), source/destination chain, fee quote, source and destination transaction hashes, state and error message. Intents are persisted to `localStorage` under `payflow:intents` (latest 50) and every state change is saved immediately. See [PAYMENT_FLOW.md](PAYMENT_FLOW.md) for the states.

### `lib/requests.ts` — payment requests

Request records (creator, amount, description, optional expiry, status) under `payflow:requests` (latest 100). A request link is `/r/<token>` where the token is the request encoded as base64url JSON; `decodeRequestToken` validates it and `resolveRequest` prefers a local record (older `/r/<uuid>` links, paid status) before falling back to the token. IDs come from `crypto.randomUUID()`. `markRequestPaid` is idempotent and respects expiry.

### `lib/errors.ts`

Maps raw wallet/SDK errors to seven user-facing messages: cancelled, insufficient balance, invalid address, route unavailable, still settling, needs attention, payment failed. Internal error text is never shown to users.

### `lib/verify.ts` — public verification

`verifyArcPayment(hash)` validates the hash, reads the transaction receipt from the Arc RPC and returns `confirmed`, `reverted`, `not_found` or `invalid`. For confirmed transactions it decodes USDC `Transfer` events emitted by the Arc USDC contract (`decodeUsdcTransfers`, pure and unit-testable) and lists them largest first. The `/p/:hash` page only ever takes a hash from the URL; amounts, recipients and status all come from the chain.

### `hooks/useMultiChainBalances.ts`

Issues one ERC-20 `balanceOf` per chain via wagmi's `useReadContracts`, refetching every 15 seconds. Totals are summed as `bigint` and formatted only for display.

### `onchain-facts.ts` and `onchain-money.ts`

- `onchain-facts.ts` is the single source for chain metadata: chain IDs, USDC addresses and decimals, CCTP domains, explorer URLs. Addresses are not hard-coded elsewhere.
- `onchain-money.ts` holds USDC amount math on integer `bigint` values with an explicit decimal count. Mixing decimal counts throws instead of silently mis-scaling. This matters on Arc, where the native gas token is USDC at 18 decimals while the ERC-20 interface uses 6.

## Data and state

| Data | Where | Notes |
|---|---|---|
| Wallet and chain | wagmi | Injected connector |
| Balances | wagmi + TanStack Query | 15 s refetch |
| Payment intents | `localStorage` `payflow:intents` | Last 50 |
| Payment requests | In the link itself, plus `localStorage` `payflow:requests` for status | Last 100 locally |
| Theme | `localStorage` | Via `ThemeProvider` |
| Live bridge result | in-memory `Map` in `kit.ts` | Lost on reload; used for fast resume |

Nothing is sent to a Payflow server. There isn't one.

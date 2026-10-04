<div align="center">

<br/>

<img src="https://img.shields.io/badge/Payflow-USDC%20Payments-22c55e?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI2IiBmaWxsPSIjMGYxYzJlIi8+PHBhdGggZD0iTTcgN2g1LjVhMy41IDMuNSAwIDAgMSAwIDdIN00xNSAxMmg0IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+" />

<h1>Payflow</h1>

<p><strong>Send USDC. We handle the chain.</strong></p>

<p>
  A non-custodial USDC payment app built on Arc Network.<br/>
  Connect any EVM wallet, enter an amount and a recipient — Payflow routes and settles on Arc.
</p>

<br/>

<a href="https://payflow-xyz.vercel.app"><img src="https://img.shields.io/badge/Live%20App-payflow--xyz.vercel.app-22c55e?style=flat-square&logo=vercel" /></a>
&nbsp;
<img src="https://img.shields.io/badge/Network-Arc%20Mainnet-3b82f6?style=flat-square" />
&nbsp;
<img src="https://img.shields.io/badge/Asset-USDC%20only-2775ca?style=flat-square" />
&nbsp;
<img src="https://img.shields.io/badge/Custody-Non--custodial-f59e0b?style=flat-square" />
&nbsp;
<img src="https://img.shields.io/badge/License-MIT-6b7280?style=flat-square" />

<br/><br/>

<a href="docs/ARCHITECTURE.md">Architecture</a> &nbsp;·&nbsp;
<a href="docs/PAYMENT_FLOW.md">Payment flow</a> &nbsp;·&nbsp;
<a href="docs/SECURITY.md">Security</a> &nbsp;·&nbsp;
<a href="docs/DEVELOPMENT.md">Development</a>

<br/><br/>

</div>

---

## What is Payflow?

Payflow abstracts cross-chain USDC settlement into a single payment experience. The user enters an amount and a recipient address on Arc. Payflow detects where the payer holds USDC, routes the transfer through Circle's Cross-Chain Transfer Protocol (CCTP) with the Forwarding Service, shows the relay fee before any signature, and hands the user a receipt with explorer links once the payment lands on Arc.

**No bridge jargon. No custody. No fake states.**

It works like sending money through Wise — you see what you send, what the recipient gets, and the fee. Nothing is hidden.

---

## Features

| | |
|---|---|
| **Unified balance** | USDC balances on every supported chain are read in parallel and shown as one total, with a per-chain breakdown sheet. |
| **Send from any supported chain** | Pick the source chain, enter an amount and an Arc recipient. Payflow handles the route. |
| **Fee before you sign** | The relay fee is estimated up front. If the fee would consume the whole amount, the payment is stopped before anything is created. |
| **Sign once** | A single wallet flow (approve + burn) on the source chain. The Forwarding Service mints on Arc, so the recipient needs no wallet interaction. |
| **Resumable payments** | Every payment is a persisted intent with a named state. Stalled payments surface as a banner on Home and a resume action in Activity. |
| **Payment request links** | Create a `/r/:id` link that pre-fills a payment to your address, with optional note and expiry. |
| **Receipts and history** | Receipt with source and destination explorer links, plus a local Activity list. |
| **Light and dark themes** | Persisted per browser. |

---

## Why Arc?

Arc is a blockchain where USDC is the native gas token. Every transaction fee is paid in USDC — the same asset users are sending. There is no separate gas token to acquire, no price volatility on fees, and settlement is near-instant.

Payflow uses Arc as the universal destination: regardless of which chain the payer holds USDC on, the recipient always receives USDC on Arc. This makes Arc the settlement layer for a payment flow that works from every CCTP-supported source chain.

---

## How it works

```
Payer wallet (any supported chain)
        │
        │  1. Payflow reads live USDC balances across all supported chains
        │  2. User selects source chain, enters amount + recipient
        │  3. Payflow queries Circle App Kit for a real fee estimate
        │  4. User reviews: amount sent, fee, amount received — then signs
        │
        ▼
Circle CCTP (Cross-Chain Transfer Protocol)
        │
        │  5. USDC is approved and burned on the source chain
        │  6. Circle attests the burn
        │  7. Circle's Forwarding Service mints USDC on Arc to the recipient
        │     — 1:1, no liquidity pool, no destination wallet needed
        │
        ▼
Recipient receives USDC on Arc
        │
        │  8. App Kit reports success with the mint transaction hash
        │  9. Receipt generated with real source and Arc explorer links
        │ 10. Intent marked completed and saved to local history
```

Full walkthrough: [docs/PAYMENT_FLOW.md](docs/PAYMENT_FLOW.md).

---

## Arc components used

| Component | How Payflow uses it |
|---|---|
| **Arc Mainnet** (chain ID 5042) | Destination for every payment on the live app. USDC as native gas. |
| **Arc Testnet** | Destination when `VITE_USE_MAINNET` is not `true`. |
| **Circle App Kit** (`@circle-fin/app-kit`) | Fee estimation, CCTP bridge execution, Forwarding Service, retry of failed steps |
| **Circle viem adapter** (`@circle-fin/adapter-viem-v2`) | EIP-1193 adapter connecting App Kit to the user's browser wallet |
| **CCTP + Forwarding Service** | Burn-and-mint settlement from any supported source chain to Arc, minted by Circle's relay |
| **Arc RPC** | Native-USDC balance reads on the destination chain |
| **Arc Explorer** | Receipt links for every completed payment |

---

## How Payflow differs from a raw App Kit integration

Most App Kit integrations call `kit.bridge()` and display a spinner until it resolves. Payflow adds a structured layer on top:

| Feature | Raw App Kit | Payflow |
|---|---|---|
| Fee shown before signing | No | Yes — real estimate on the Review screen |
| Tiny-amount protection | No | Yes — rejected up front when the fee would meet or exceed the amount |
| State machine | None | 10 named states, persisted to `localStorage` on every change |
| Live progress | Raw events | `bridge.approve` and `bridge.burn` events mapped to 5 plain-language steps |
| Recovery | Manual | Stalled payments become `recoverable`; same-session resume continues from the failed step |
| Double-submit protection | None | Confirm is disabled once submitted; each intent is started once per wallet connection |
| Error messages | SDK errors | Mapped to 7 fixed user-facing messages |
| Multi-chain balance | Connected chain only | All supported chains read in parallel, refreshed every 15 seconds |
| Amount handling | Strings / floats | Decimal strings stored, `bigint` math with explicit decimals for balances |

---

## Architecture

```
src/
├── lib/
│   ├── intent.ts         # Payment intent states + localStorage persistence
│   ├── kit.ts            # Circle App Kit facade + EIP-1193 adapter boundary
│   ├── errors.ts         # SDK/wagmi → user-facing error string mapper
│   └── requests.ts       # Payment request storage + opaque ID generation
│
├── hooks/
│   ├── useMultiChainBalances.ts   # Parallel balanceOf across all supported chains
│   └── useNavigateToResume.ts     # Jump into Progress in resume mode
│
├── pages/
│   ├── Home.tsx           # Balance hero + action entry points
│   ├── Send.tsx           # Amount + recipient entry, source chain detection, fee estimate
│   ├── Review.tsx         # Fee summary, route details, confirm CTA
│   ├── Progress.tsx       # Live step transitions while the transfer runs
│   ├── Receipt.tsx        # Completed payment + explorer links
│   ├── Activity.tsx       # Payment history from local intents, resume actions
│   └── RequestPage.tsx    # /request/new and /r/:id payment requests
│
├── components/
│   ├── BalanceCard.tsx         # Animated total balance hero card
│   ├── ChainBalanceSheet.tsx   # Per-chain breakdown bottom sheet
│   ├── AmountInput.tsx         # Amount entry with quick-chips + live balance
│   ├── RecipientInput.tsx      # Address entry with validation
│   ├── RouteDetails.tsx        # Expandable route info (no bridge jargon)
│   ├── IntentStatusBanner.tsx  # Recoverable intent alert
│   └── ...                     # Shell, splash, wallet button, logo
│
├── providers/
│   ├── Web3Provider.tsx   # wagmi + ConnectKit
│   └── ThemeProvider.tsx  # Dark/light mode with localStorage persistence
│
├── config.ts              # Network selection + wagmi config
├── onchain-facts.ts       # Chain IDs, USDC addresses, CCTP domains, explorer URLs
└── onchain-money.ts       # Integer (bigint) USDC amount math with explicit decimals
```

Deeper write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Payment intent state machine

```
                    ┌─────────────┐
                    │    draft    │   created on Send
                    └──────┬──────┘
                           │ user confirms on Review
               ┌───────────▼───────────┐
               │  awaiting_signature   │──── wallet rejected ───► cancelled
               └───────────┬───────────┘
                           │ approval confirmed
               ┌───────────▼───────────┐
               │       submitted       │
               └───────────┬───────────┘
                           │ burn confirmed on source chain
               ┌───────────▼───────────┐
               │       settling        │◄──────────────┐
               └───────────┬───────────┘               │ resume
                           │                           │
              ┌────────────┼─────────────┐             │
              │ success    │ not success │ error       │
     ┌────────▼──────┐  ┌──▼──────────┐  │             │
     │   completed   │  │ recoverable ├──┼─────────────┘
     └───────────────┘  └─────────────┘  │
                                   ┌─────▼─────┐
                                   │  failed   │
                                   └───────────┘
```

**Invariants:**
- `completed` is only written when App Kit reports a successful bridge; the mint transaction hash is read from the SDK result
- Amounts are stored as decimal strings and never as floats
- Payflow never holds USDC — all transfers go wallet → CCTP → Arc
- A payment request, once marked paid in a browser, cannot be paid again from that browser

`quoting` and `ready` exist in the type for future use and are not entered by the current flow.

---

## Security

| Concern | How it is handled |
|---|---|
| Private keys | Never touched — all signing is done by the user's wallet |
| Custody | None — funds go wallet → CCTP burn → Circle mint on Arc |
| Address validation | viem `isAddress` before any intent is created |
| Amount validation | Decimal-only input, minimum 0.01 USDC, `bigint` math with explicit decimals for balances |
| Double submit | Confirm disabled after the first tap; each intent starts once per wallet connection |
| Network safety | Wallet is switched to the intent's source chain before signing |
| Error handling | Raw SDK/wallet errors mapped to fixed messages |
| Replay / double-pay | Requests use opaque `crypto.randomUUID()` IDs; paid status is checked before a request can be paid |
| Secrets | None in the browser bundle — `.env` is gitignored, only `VITE_USE_MAINNET` is read |
| XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `src/` |

See [docs/SECURITY.md](docs/SECURITY.md) for limits worth knowing before you use real funds.

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh), a browser wallet (MetaMask or any injected wallet), and USDC on a supported chain.

```bash
git clone https://github.com/Siriron/payflow
cd payflow
bun install
```

Create `.env`:

```env
# false (default) = Arc Testnet and testnet source chains
# true            = Arc mainnet and mainnet source chains (the live app)
VITE_USE_MAINNET=false
```

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect your wallet.

The live app at [payflow-xyz.vercel.app](https://payflow-xyz.vercel.app) runs with `VITE_USE_MAINNET=true`. Local setups default to testnet so you can try the flow without real funds — get testnet USDC from [faucet.circle.com](https://faucet.circle.com).

| Script | Description |
|---|---|
| `bun run dev` | Start the dev server |
| `bun run build` | Production build to `dist/` |
| `bun run preview` | Serve the production build |
| `bun run check` | Lint + typecheck |

More in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), including deployment and adding a source chain.

---

## Supported chains

| Chain | Mainnet | Testnet | Notes |
|---|---|---|---|
| Arc | ✓ | ✓ | Destination — USDC is the native gas token |
| Ethereum | ✓ | Sepolia | Primary CCTP source |
| Base | ✓ | Base Sepolia | Fast, low-fee |
| Arbitrum | ✓ | Arbitrum Sepolia | |
| Avalanche | ✓ | Avalanche Fuji | |
| Optimism | ✓ | OP Sepolia | |

Fee estimates are fetched at runtime from Circle App Kit — never hardcoded. USDC only. Wallet connection is via injected browser wallets.

---

## Known limitations

Payflow is a focused prototype. These are the current boundaries:

- **No backend.** Intents, requests and history live in `localStorage`. A `/r/:id` link resolves only in the browser that created it, and a request is marked paid only in the payer's browser.
- **Completion comes from App Kit.** Payflow trusts App Kit's reported result and mint hash; it does not run a separate on-chain check on Arc.
- **Resume after a reload.** Fast resume relies on an in-memory App Kit result and works within the same session. After a reload, resume re-runs the bridge and asks for a new signature — check the explorer for your original burn before resuming.
- **Injected wallets only.** No WalletConnect or passkey support yet.

---

## Roadmap

Not yet built:

- **Safer resume** — use the stored source transaction hash before ever re-running a bridge after a reload
- **Independent settlement verification** — confirm the mint directly on Arc before marking a payment complete
- **Payment links at scale** — server-backed `/r/:id` links with expiry, status, webhook callbacks and a reconciliation dashboard
- **Developer payment API** — `POST /api/payment-intents` for server-side payment creation with status webhooks
- **More wallets** — WalletConnect and passkey onboarding for non-crypto users
- **Smart contract accounts** — batch approvals, session keys for recurring payments
- **Gateway deposits** — fast fund-then-spend flow using Circle Gateway for users who already hold Arc USDC

---

## Built with

- [Arc Network](https://arc.io) — settlement chain, USDC as gas
- [Circle App Kit](https://developers.circle.com) — CCTP routing and execution
- [React](https://react.dev) + [Vite](https://vitejs.dev) + [TypeScript](https://typescriptlang.org)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) + [ConnectKit](https://docs.family.co/connectkit) — wallet connection and chain reads
- [TanStack Query](https://tanstack.com/query) — data fetching
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Tailwind CSS](https://tailwindcss.com) — styling

---

<div align="center">

**Built on Arc Network** &nbsp;·&nbsp; Non-custodial &nbsp;·&nbsp; USDC only &nbsp;·&nbsp; MIT License

<sub>Payflow is an independent project. It is not affiliated with, endorsed by, or sponsored by Circle Internet Financial or Arc.</sub>

</div>

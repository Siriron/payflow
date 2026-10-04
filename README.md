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

</div>

---

## What is Payflow?

Payflow abstracts cross-chain USDC settlement into a single payment experience. The user enters an amount and a recipient address on Arc. Payflow detects where the payer holds USDC, selects the best live route via Circle's Cross-Chain Transfer Protocol (CCTP), shows real fees before any signature, and verifies settlement directly on Arc.

**No bridge jargon. No custody. No fake states.**

It works like sending money through Wise — you see what you send, what the recipient gets, and the fee. Nothing is hidden.

---

## Why Arc?

Arc is a blockchain where USDC is the native gas token. Every transaction fee is paid in USDC — the same asset users are sending. There is no separate gas token to acquire, no price volatility on fees, and settlement is near-instant.

Payflow uses Arc as the universal destination: regardless of which chain the payer holds USDC on, the recipient always receives USDC on Arc. This makes Arc the settlement layer for a payment network that works across every CCTP-supported chain.

---

## How it works

```
Payer wallet (any chain)
        │
        │  1. Payflow reads live USDC balances across all supported chains
        │  2. User selects source chain, enters amount + recipient
        │  3. Payflow queries Circle App Kit for route + real fee estimate
        │  4. User reviews: amount sent, fee, amount received — then signs once
        │
        ▼
Circle CCTP (Cross-Chain Transfer Protocol)
        │
        │  5. USDC is burned on the source chain
        │  6. Circle Attestation Service issues a signed proof
        │  7. USDC is minted on Arc Mainnet — 1:1, no liquidity pool
        │
        ▼
Recipient receives USDC on Arc
        │
        │  8. Payflow queries Arc directly to verify settlement
        │  9. Receipt generated with real Arc explorer link
        │  10. Intent marked completed — never from a frontend callback
```

---

## Arc components used

| Component | How Payflow uses it |
|---|---|
| **Arc Mainnet** (chain ID 5042) | Destination for every payment. USDC as native gas. |
| **Circle App Kit** (`@circle-fin/app-kit`) | Route evaluation, CCTP bridge execution, Forwarding Service, retry/recovery |
| **Circle Bridge Kit** (`@circle-fin/adapter-viem-v2`) | EIP-1193 adapter connecting App Kit to the user's browser wallet |
| **CCTP v1** | Burn-and-mint settlement from any supported source chain to Arc |
| **Arc RPC** | Direct chain queries to verify settlement — never trusts client state |
| **Arc Explorer** | Receipt links for every completed payment |

---

## How Payflow differs from a raw App Kit integration

Most App Kit integrations call `kit.bridge()` and display a spinner until it resolves. Payflow adds a structured layer on top:

| Feature | Raw App Kit | Payflow |
|---|---|---|
| Fee shown before signing | No | Yes — real estimate on Review screen |
| Quote locked | No | Yes — re-estimates if quote is stale |
| Settlement verified | No | Yes — queries Arc directly |
| State machine | None | 8 named states, persisted to localStorage |
| Recovery on reload | None | Loads intent → re-derives status from SDK |
| Double-submit protection | None | Intent locked on first submission |
| Error messages | SDK errors | Mapped to 7 user-facing copy strings |
| Multi-chain balance | Connected chain only | All CCTP chains read in parallel |

---

## Architecture

```
src/
├── lib/
│   ├── intent.ts         # 8-state payment intent machine + localStorage persistence
│   ├── kit.ts            # Circle App Kit singleton + EIP-1193 adapter boundary
│   ├── routes.ts         # Runtime route evaluation — never a hardcoded matrix
│   ├── errors.ts         # SDK/wagmi → user-facing error string mapper
│   └── requests.ts       # Payment request CRUD + opaque ID generation
│
├── hooks/
│   └── useMultiChainBalances.ts   # Parallel balanceOf across all CCTP chains
│
├── pages/
│   ├── Home.tsx           # Balance hero + action entry points
│   ├── Send.tsx           # Amount + recipient entry, source chain detection
│   ├── Review.tsx         # Real fee summary, route details, confirm CTA
│   ├── Progress.tsx       # Live state transitions from App Kit events
│   ├── Receipt.tsx        # Verified settlement + Arc explorer link
│   ├── Activity.tsx       # Payment history from localStorage intents
│   └── RequestPage.tsx    # /r/:id payment request resolution
│
├── components/
│   ├── BalanceCard.tsx    # Animated total balance hero card
│   ├── ChainBalanceSheet.tsx  # Per-chain breakdown bottom sheet
│   ├── AmountInput.tsx    # Amount entry with quick-chips + real balance validation
│   ├── RecipientInput.tsx # Address entry with checksum validation
│   ├── RouteDetails.tsx   # Expandable route info (no bridge jargon)
│   └── IntentStatusBanner.tsx  # Recoverable intent alert
│
└── providers/
    ├── Web3Provider.tsx   # wagmi + ConnectKit + Arc Mainnet + CCTP source chains
    └── ThemeProvider.tsx  # Dark/light mode with localStorage persistence
```

---

## Payment intent state machine

```
                    ┌─────────────┐
                    │    draft    │◄──────────────────────┐
                    └──────┬──────┘                       │
                           │ quote requested               │ back / expired
                    ┌──────▼──────┐                       │
                    │   quoting   │                       │
                    └──────┬──────┘                       │
                           │ route found                   │
                    ┌──────▼──────┐                       │
                    │    ready    │───────────────────────►│
                    └──────┬──────┘  expired / back
                           │ user confirms
               ┌───────────▼───────────┐
               │  awaiting_signature   │◄── user cancels → cancelled
               └───────────┬───────────┘
                           │ signed
               ┌───────────▼───────────┐
               │       submitted       │
               └───────────┬───────────┘
                           │ source confirmed
               ┌───────────▼───────────┐
               │      in_flight        │◄── failure → recoverable
               └───────────┬───────────┘              │
                           │ Arc mint confirmed         │ resume
               ┌───────────▼───────────┐              │
               │      completed        │◄─────────────┘
               └───────────────────────┘
```

**Invariants (never violated):**
- `completed` requires verified Arc settlement — never set from a callback
- Quote cannot silently change recipient, amount, fee, or destination
- Payflow never holds USDC — all transfers go directly wallet → CCTP → Arc
- One payment request can only be paid once

---

## Security

| Concern | How it is handled |
|---|---|
| Private keys | Never touched — all signing done by the user's wallet |
| Client-reported state | Never trusted — all state re-derived from chain queries on reload |
| Address validation | EIP-55 checksum validation before any intent is created |
| Amount validation | Strict decimal parsing — rejects scientific notation, NaN, Infinity, dust |
| Double submit | Intent locked on first submission — UI disabled until terminal state |
| Replay / double-pay | Payment requests have opaque random IDs; paid flag checked before processing |
| Secrets | No secrets in the browser bundle — `.env` is gitignored |
| XSS | No `dangerouslySetInnerHTML` anywhere in the codebase |
| CSP | Configured at the hosting layer |

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh), a browser wallet (MetaMask or any injected wallet), USDC on a supported chain.

```bash
git clone https://github.com/Siriron/payflow
cd payflow
bun install
```

Create `.env`:
```env
VITE_USE_MAINNET=true
```

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). Connect your wallet. The app targets Arc Mainnet by default.

**For local development against Arc Testnet:** set `VITE_USE_MAINNET=false`. You will need USDC on a CCTP testnet chain (Sepolia, Base Sepolia, etc.).

---

## Supported source chains

| Chain | Mainnet | Notes |
|---|---|---|
| Ethereum | ✓ | Primary CCTP source |
| Base | ✓ | Fast, low-fee |
| Arbitrum | ✓ | |
| Avalanche | ✓ | |
| Optimism | ✓ | |

All routes are queried at runtime from Circle App Kit — never hardcoded.

---

## Roadmap

Items in the README only — not yet built:

- **Payment links at scale** — shareable `/r/:id` links with expiry, webhook callbacks, and a reconciliation dashboard
- **Developer payment API** — `POST /api/payment-intents` for server-side payment creation with status webhooks
- **Passkey wallets** — onboard non-crypto users with Face ID / Touch ID via Circle Modular Wallets
- **Smart contract accounts** — batch approvals, session keys for recurring payments
- **Gateway deposits** — fast fund-then-spend flow using Circle Gateway for users who hold Arc USDC already

---

## Built with

- [Arc Network](https://arc.io) — settlement chain, USDC as gas
- [Circle App Kit](https://developers.circle.com/circle-mint/docs/app-kit) — CCTP routing and execution
- [React](https://react.dev) + [Vite](https://vitejs.dev) + [TypeScript](https://typescriptlang.org)
- [wagmi](https://wagmi.sh) + [ConnectKit](https://docs.family.co/connectkit) — wallet connection
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Tailwind CSS](https://tailwindcss.com) — styling

---

<div align="center">

**Built on Arc Network** &nbsp;·&nbsp; Non-custodial &nbsp;·&nbsp; USDC only &nbsp;·&nbsp; MIT License

<sub>Payflow is an independent project. It is not affiliated with, endorsed by, or sponsored by Circle Internet Financial or Arc.</sub>

</div>

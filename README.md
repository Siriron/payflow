# Payflow

**Send USDC. We handle the chain.**

Payflow is a non-custodial USDC payment app built on Arc Network. Connect any wallet, enter an amount and an Arc recipient address. Payflow selects the best live CCTP route, shows real fees before you sign, tracks every state transition, and verifies settlement on Arc — no bridge jargon, no custody, no surprises.

---

## Why Arc

Arc is the chain where USDC is native gas. That means:

- **Users pay fees in what they are already sending.** No ETH, no MATIC, no "get gas first" step.
- **Sub-second finality.** The receipt screen shows a real confirmed tx hash, not an estimated arrival.
- **Stable, predictable fees.** No gas-price anxiety during a payment.

Payflow uses Arc as the universal destination: no matter which chain the sender is on (Ethereum, Base, Arbitrum, Avalanche, Optimism), the recipient always receives USDC on Arc. This is the core product promise — "Send from anywhere, receive on Arc."

---

## What Payflow Uses from Arc / Circle

| Component | Role |
|---|---|
| Arc Mainnet (chain ID 5042) | Destination for all payments |
| `@circle-fin/app-kit` | CCTP route execution + Forwarding Service |
| `@circle-fin/adapter-viem-v2` | EIP-1193 adapter — connects App Kit to the user's browser wallet |
| USDC ERC-20 on Arc | Balance read, receipt amount |
| Arc Explorer | Every receipt links to the real on-chain tx |

**No custom contracts.** No custody. No server-side signing.

---

## How It Differs from Raw App Kit

Most App Kit demos just wrap `kit.bridge()` with no state management. Payflow adds:

- **Payment intent layer**: 8-state machine (draft → quoting → awaiting_signature → submitted → settling → completed / recoverable / failed / cancelled). Persisted to localStorage with a stable ID. Never double-submits.
- **Quote locking**: if the wallet switches chain or the quote goes stale mid-flow, Payflow re-estimates rather than silently mutating the amount.
- **Honest states**: every step the user sees maps to a real SDK event. No fake progress, no timers, no optimistic "completed" from a frontend callback.
- **Recovery**: if a transfer reaches `recoverable` (source committed, destination not confirmed), the banner on Home lets the user resume via `kit.retry()` without losing funds.
- **Payment requests**: shareable `/r/:id` links that pre-fill the send form. Marked paid only after verified Arc settlement, not on a frontend event.

---

## Architecture

```
Browser wallet
    ↓  wagmi / ConnectKit
Payment intent (src/lib/intent.ts)
    ↓  8-state machine, localStorage
Arc adapter (src/lib/kit.ts)
    ↓  @circle-fin/app-kit + adapter-viem-v2
CCTP → Circle Forwarding Service → Arc Mainnet
```

- **No backend.** Payment requests are localStorage-only for the demo.
- **Config flip.** `VITE_USE_MAINNET=true` switches everything (chain, USDC address, explorer) from testnet to mainnet. No hardcoded addresses in source.
- **All chain facts** come from `@/onchain-facts` (Arc Studio registry). Nothing typed from memory.

---

## Running Locally

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). Connect MetaMask. Set the network to Arc Testnet (chain ID 5042002) or any CCTP-supported testnet. Send a test payment.

### Mainnet

```bash
# .env
VITE_USE_MAINNET=true
```

Restart the dev server. Connect a wallet with USDC on a CCTP-supported mainnet chain.

---

## Roadmap

- Shareable payment links backed by a real backend (Cloudflare KV)
- Circle Modular Wallet passkey path — no MetaMask required
- Multi-source chain balance picker
- Reconciliation dashboard
- Developer payment API (POST /api/payment-intents)

---

## Security

- No keys stored. No server-side signing. Non-custodial throughout.
- All amounts use `@/onchain-money` helpers — no raw `parseUnits`/`formatUnits`, no float arithmetic.
- Address validation: EIP-55 checksum enforced before any intent is created.
- State is derived from the SDK on every reload — never trusted from a frontend callback.
- No lending, no yield, no speculation. Payments only.

---

*Built with Arc Studio · Not affiliated with or endorsed by Arc or Circle.*

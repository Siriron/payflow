# Payflow

> Built with Arc Studio — https://studio.arc.io

Non-custodial USDC payment app. Send USDC to any Arc address from any CCTP-supported chain. Payflow picks the route, shows real fees, and verifies settlement on Arc.

---

## What This App Does

Payflow lets users send USDC to a recipient on Arc Network from any chain with a live CCTP→Arc route (Ethereum, Base, Arbitrum, Avalanche, Optimism, or Arc itself). No bridge jargon in the UI — the user sees "Send USDC" and a receipt.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Bridge: @circle-fin/app-kit (CCTP + Forwarding Service), @circle-fin/adapter-viem-v2
- Routing: react-router-dom v7
- Fonts: Space Grotesk (display), DM Sans (body), JetBrains Mono (addresses/hashes)
- Chain: Arc Testnet (dev) → Arc Mainnet (submission, chain ID 5042)
- Token: USDC 6-decimal ERC-20 at 0x3600000000000000000000000000000000000000

## Key Files

- `src/App.tsx` — Router (/, /send, /review, /progress, /receipt, /r/:id, /request/new)
- `src/config.ts` — wagmi config. ACTIVE_ARC_CHAIN, CCTP_SOURCE_CHAINS. Flip VITE_USE_MAINNET=true to target mainnet.
- `src/lib/intent.ts` — PaymentIntent 8-state machine + localStorage persistence
- `src/lib/kit.ts` — App Kit facade: executeTransfer, retryTransfer
- `src/lib/requests.ts` — PaymentRequest CRUD + generateRequestLink
- `src/lib/errors.ts` — parsePayflowError → 7 user-facing copy strings
- `src/providers/Web3Provider.tsx` — WagmiProvider + QueryClient + ConnectKit with Arc Light theme
- `src/pages/Home.tsx` — Balance hero, Send/Request CTAs, recoverable intent banner
- `src/pages/Send.tsx` — Amount + recipient entry
- `src/pages/Review.tsx` — Fee summary + Confirm payment
- `src/pages/Progress.tsx` — Live state transitions, no fake timers
- `src/pages/Receipt.tsx` — Payment complete + Arc explorer link
- `src/pages/RequestPage.tsx` — /request/new (create link) + /r/:id (resolve + pay)
- `src/components/BalanceCard.tsx` — Real Arc USDC balance (6-decimal ERC-20 view only)
- `src/components/AmountInput.tsx` — Decimal input + real balance validation
- `src/components/RecipientInput.tsx` — Address input + EIP-55 checksum validation
- `src/components/IntentStatusBanner.tsx` — Recoverable intent banner with Resume button
- `src/components/RouteDetails.tsx` — Expandable route details (no bridge jargon in collapsed view)

## Deployed Contracts

None — Payflow has no custom contracts. All settlement via Circle App Kit + CCTP Forwarding Service.

## Mainnet Config

Set `VITE_USE_MAINNET=true` in `.env` to target Arc Mainnet (chain ID 5042).
Arc Mainnet moves real USDC. Transactions are irreversible.

## To Run

```bash
bun install
cp .env.example .env  # add VITE_WALLETCONNECT_PROJECT_ID
bun run dev
```

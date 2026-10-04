<div align="center">

# Payflow

**Send USDC. We handle the chain.**

A non-custodial USDC payment app on [Arc](https://arc.io). Connect a browser wallet, enter an amount and a recipient, and Payflow moves your USDC from whichever supported chain you hold it on to the recipient on Arc.

[Live app](https://payflow-xyz.vercel.app) · [Architecture](docs/ARCHITECTURE.md) · [Payment flow](docs/PAYMENT_FLOW.md) · [Security](docs/SECURITY.md) · [Development](docs/DEVELOPMENT.md)

![Network](https://img.shields.io/badge/Network-Arc-3b82f6?style=flat-square)
![Asset](https://img.shields.io/badge/Asset-USDC-2775ca?style=flat-square)
![Custody](https://img.shields.io/badge/Custody-Non--custodial-f59e0b?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-6b7280?style=flat-square)

</div>

---

## Overview

Arc uses USDC as its native gas token, so a payment app on Arc needs no second token for fees. Payflow makes Arc the destination for every payment. The payer can hold USDC on Ethereum, Base, Arbitrum, Avalanche or Optimism, and the recipient receives USDC on Arc.

Under the hood Payflow uses [Circle App Kit](https://developers.circle.com) and CCTP (Cross-Chain Transfer Protocol): USDC is burned on the source chain and minted on Arc. No liquidity pool is involved, and Payflow never holds funds. The user signs once in their own wallet.

## Features

- **Unified balance.** Reads USDC on every supported chain in parallel and shows the total, with a per-chain breakdown.
- **Send from any supported chain.** Pick the source chain, enter an amount and an Arc recipient address.
- **Fee shown before you sign.** The relay fee is estimated up front. Amounts the fee would consume entirely are rejected early.
- **Resumable payments.** Every payment is stored as an intent with a named state. If a transfer stalls, it can be resumed from the Activity screen.
- **Payment request links.** Create a `/r/:id` link that pre-fills a payment to your address. See [Known limitations](#known-limitations).
- **Receipts and history.** Receipt with explorer links, and a local Activity list.
- **Light and dark themes.**

## Supported chains

| Role | Mainnet (`VITE_USE_MAINNET=true`) | Testnet (default) |
|---|---|---|
| Destination | Arc | Arc Testnet |
| Sources | Ethereum, Base, Arbitrum, Avalanche, Optimism | Sepolia, Base Sepolia, Arbitrum Sepolia, Avalanche Fuji, OP Sepolia |

Wallet connection is via injected browser wallets (MetaMask and similar). USDC only, minimum payment 0.01 USDC.

## How it works

```
Payer wallet (source chain)
   │ 1. Read USDC balances on all supported chains
   │ 2. Choose amount + Arc recipient; Payflow estimates the fee via App Kit
   │ 3. Review screen shows amount, fee and what the recipient receives
   │ 4. Sign in the wallet (approve + burn on the source chain)
   ▼
Circle CCTP + Forwarding Service
   │ 5. USDC burned on source chain, attested by Circle
   │ 6. Forwarding Service mints on Arc to the recipient
   ▼
Recipient has USDC on Arc → Receipt with explorer links
```

Details: [docs/PAYMENT_FLOW.md](docs/PAYMENT_FLOW.md).

## Tech stack

React 18 · Vite · TypeScript · wagmi + viem · ConnectKit · TanStack Query · React Router · Tailwind CSS · Framer Motion · `@circle-fin/app-kit` and `@circle-fin/adapter-viem-v2`

## Quick start

Requires [Bun](https://bun.sh) and a browser wallet.

```bash
git clone https://github.com/Siriron/payflow
cd payflow
bun install
cp .env.example .env     # VITE_USE_MAINNET=false targets Arc Testnet
bun run dev
```

Open http://localhost:5173. For testnet you need testnet USDC on one of the source chains (see [Circle's faucet](https://faucet.circle.com)). Full setup, scripts and deployment: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Project structure

```
src/
├── pages/        Home, Send, Review, Progress, Receipt, Activity, RequestPage
├── components/   UI building blocks (balance card, inputs, sheets, banners)
├── hooks/        useMultiChainBalances, useNavigateToResume
├── lib/          intent (state + storage), kit (App Kit facade), requests, errors
├── providers/    Web3Provider (wagmi + ConnectKit), ThemeProvider
├── config.ts     Chain selection and wagmi config
├── onchain-facts.ts   Chain metadata, USDC and CCTP addresses, explorer URLs
└── onchain-money.ts   Integer (bigint) USDC amount math
```

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Known limitations

Payflow is a focused prototype. Read these before relying on it:

- **Request links are local to one browser.** Payment requests and intents live in `localStorage`; there is no backend. A `/r/:id` link only resolves in the browser that created it, and a request is only marked paid in the payer's browser.
- **Completion comes from App Kit's result.** A payment is marked complete when the App Kit bridge reports success and a mint transaction hash. Payflow does not separately re-query Arc to confirm it.
- **Resume after a page reload.** Fast resume uses an in-memory App Kit result and only works within the same session. After a reload, resume re-runs the bridge and asks for a new signature, so check the explorer for your original burn transaction before resuming.
- **Injected wallets only.** No WalletConnect or passkey support yet.

## Roadmap

Not yet built: server-backed payment links with expiry and status, a payment-intents API with webhooks, independent on-chain settlement verification, WalletConnect and passkey wallets.

## License

[MIT](LICENSE). Payflow is an independent project and is not affiliated with or endorsed by Circle or Arc.

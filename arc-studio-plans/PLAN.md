# Payflow — Arc Studio Build Instructions

> Single file. Everything the build agent needs. Under 10,000 characters.
> Paste this into Arc Studio Build mode and approve.

---

## Summary

Payflow is a non-custodial USDC payment app: enter an amount and an Arc recipient address, Payflow picks the best live CCTP route, shows real fees, you sign once, and Payflow tracks and verifies settlement on Arc. Includes shareable payment request links (`/r/:id`). Built for the Arc Microgrants deadline of Oct 14, 2026 — targeting submission by Oct 9 to get early review.

## Scope decision

- **Build and verify on Arc Testnet.** One config swap (`arcTestnet` → `arc`, testnet explorer → mainnet explorer) flips to mainnet for submission. Protects real USDC during development.
- **Core send flow + payment request links.** Payment requests (`/r/:id`) are the differentiating feature — they make Payflow more than a USDC sender. localStorage-only for the demo; no backend required.
- **Deferred to post-grant:** Activity list, Unified Balance route 2/3, Circle Modular Wallet passkey path, multi-chain balance picker UI, full 13-state machine (simplified to 8 observable states).

## Architecture

- **Blockchain**: Arc Testnet for dev → Arc Mainnet for submission. Destination is always Arc. Source chain detected from wallet's connected chain at runtime. All chain facts from `@/onchain-facts`; amounts from `@/onchain-money`.
- **Contract**: None. All settlement via Circle App Kit (`@circle-fin/app-kit`) + Viem EIP-1193 adapter (`@circle-fin/adapter-viem-v2`). Forwarding Service (`useForwarder: true`) — no destination wallet needed.
- **SDK routing**: CCTP bridge via `kit.bridge()` as the primary and only route for now. "Route unavailable" if the wallet's source chain has no CCTP→Arc route. Unified Balance spend deferred.
- **State machine (8 states)**: `draft → quoting → ready → awaiting_signature → submitted → settling → completed / failed`. Plus `recoverable` and `cancelled`. Intent persisted to `localStorage` keyed by stable ID. On reload: re-derive status from SDK, never trust client-reported completion.
- **Payment requests**: `PaymentRequest` stored in localStorage with opaque random ID. `/r/:id` resolves the request and pre-fills the send form. Marked paid only after verified Arc settlement. One settlement cannot pay a request twice.
- **Frontend**: React + Vite + Tailwind. Arc Light mode, mobile-first `max-w-md`, Space Grotesk / DM Sans, wagmi + ConnectKit.
- **Wallet**: ConnectKit with injected + WalletConnect. `VITE_WALLETCONNECT_PROJECT_ID` env var required.

## Files to Create / Modify

1. `src/config.ts` — Arc Testnet + mainnet chains, CCTP source chains, WalletConnect config; `ACTIVE_CHAIN` constant for easy testnet↔mainnet flip
2. `src/lib/usdc.ts` — `parseUsdc`, `formatUsdc`, `nativeUsdc18ToUsdc6`, `usdc6ToNativeUsdc18`; unit tests inline
3. `src/lib/intent.ts` — `PaymentIntent` type, 8-state machine, `localStorage` persistence, stable ID generation, reload-and-rederive logic
4. `src/lib/kit.ts` — App Kit singleton + Viem EIP-1193 adapter; `executeTransfer(intent, provider)` and `retryTransfer(intent, provider)` facades; `kit.on()` event → intent state mapping
5. `src/lib/requests.ts` — `PaymentRequest` CRUD in localStorage; opaque ID via `crypto.randomUUID()`; paid-only-once check
6. `src/lib/errors.ts` — `parsePayflowError` mapping SDK / wagmi errors to the 7 spec copy strings
7. `src/providers/Web3Provider.tsx` — wagmi `createConfig` with Arc + CCTP source chains + ConnectKit; exports `usePayflowChain()` hook
8. `src/pages/Home.tsx` — real USDC balance hero card, "USDC available to send", Send + Request CTAs, recoverable intent banner
9. `src/pages/Send.tsx` — amount input, recipient input, "Receive on Arc. We'll handle the route.", Review payment button
10. `src/pages/Review.tsx` — "You send / Fees / Recipient receives / Destination" rows from real App Kit estimate; "View route details" expander (no jargon in main view); "Confirm payment" CTA
11. `src/pages/Progress.tsx` — progress surface wired to real intent state; labels from spec copy ("Preparing your payment" → "Waiting for wallet" → "Sending USDC" → "Moving funds" → "Settling on Arc" → "Confirming receipt"); no fake timers
12. `src/pages/Receipt.tsx` — "Payment complete. Recipient received the payment on Arc." + Arc explorer link + Copy receipt
13. `src/pages/Request.tsx` — `/r/:id` resolves request, shows "Someone requested X USDC", pre-fills Send form
14. `src/components/BalanceCard.tsx` — hero USDC balance via `useReadContract` ERC-20 `balanceOf` on Arc; 6-decimal ERC-20 view only
15. `src/components/AmountInput.tsx` — accessible numeric input, Max button, real-time balance validation
16. `src/components/RecipientInput.tsx` — address input, checksum validation, clear error copy
17. `src/components/IntentStatusBanner.tsx` — shown on Home when a recoverable intent exists; "Resume payment" → `retryTransfer`
18. `src/components/RouteDetails.tsx` — expandable panel: source chain name, fee breakdown, settlement note; no "bridge/CCTP/burn/mint" in the collapsed view
19. `src/App.tsx` — client-side router: `/`, `/send`, `/review`, `/progress`, `/receipt`, `/r/:id`
20. `src/main.tsx` — wrap with `Web3Provider`
21. `src/index.css` — Space Grotesk + DM Sans from Google Fonts; Arc Light design tokens (warm neutral canvas, navy CTA, translucent white cards)
22. `package.json` — add `@circle-fin/app-kit`, `@circle-fin/adapter-viem-v2`, `react-router-dom`
23. `README.md` — what Payflow does, what Arc components it uses and why, architecture diagram (text), difference from raw App Kit, roadmap (post-grant features), security notes

## Build Sequence

1. **Foundations** (Oct 2–3): `usdc.ts` helpers + tests; `intent.ts` 8-state machine; `errors.ts` error map
2. **Config + providers** (Oct 3): `config.ts` with testnet/mainnet flip; `Web3Provider.tsx`; update `main.tsx`
3. **App Kit layer** (Oct 4): `kit.ts` — App Kit singleton, EIP-1193 adapter, `executeTransfer`, `retryTransfer`, event→state mapping
4. **Core send flow** (Oct 5–6): `BalanceCard`, `AmountInput`, `RecipientInput`; Home, Send, Review pages; router in `App.tsx`
5. **Execution + receipt** (Oct 6–7): Progress page wired to real intent state transitions; Receipt page with explorer link
6. **Recovery + errors** (Oct 7): `IntentStatusBanner`; `retryTransfer` path; all 7 error messages mapped
7. **Payment requests** (Oct 8): `requests.ts`; Request page at `/r/:id`; generate request link from Home
8. **Mainnet flip + smoke test** (Oct 8–9): swap `ACTIVE_CHAIN` to mainnet; real 1 USDC payment; verify explorer link; README; deploy to public URL
9. **Submit** (Oct 9): submit to Arc Microgrants with live URL + public repo

## Done When

- [ ] Wallet connects; real USDC balance from Arc ERC-20 `balanceOf` (6-decimal view only, never native)
- [ ] Send form validates address (checksum) and amount against real balance
- [ ] Review screen shows real fee estimate from App Kit before any signature
- [ ] Sign → progress labels driven by real SDK events, no fake timers or mocked steps
- [ ] "Payment complete. Recipient received the payment on Arc." + working Arc explorer link
- [ ] Refresh mid-flight: intent reloads, status re-derived from SDK, no double-submit possible
- [ ] Recoverable state: banner on Home, "Resume payment" triggers `retryTransfer`
- [ ] `/r/:id` pre-fills Send form; request marked paid only after verified Arc settlement
- [ ] No bridge/CCTP/mint/burn jargon in the collapsed main flow
- [ ] No fake balances, fees, addresses, or tx hashes anywhere
- [ ] Single config line switches testnet → mainnet
- [ ] README covers: what it does, Arc components used, architecture, roadmap
- [ ] `VITE_WALLETCONNECT_PROJECT_ID` in `.env.example`; no secrets in browser bundle

## Post-Grant Roadmap (README only)

- Circle Modular Wallets passkey path (no seed phrase onboarding)
- Unified Balance spend route (for users with existing Gateway deposits)
- Backend for cross-device shareable payment links
- Activity list with full intent history
- Developer payment API

## Pre-Build Checklist

- [ ] Add `VITE_WALLETCONNECT_PROJECT_ID` to `.env` (free at https://cloud.walletconnect.com)
- [ ] Fund Arc Testnet wallet from https://faucet.circle.com for development
- [ ] Have Arc Mainnet wallet with USDC ready for smoke test (Oct 8–9)
- [ ] Public repo created and linked to Arc Studio
- [ ] Public builder profile (GitHub / X / Farcaster) ready for submission

# Development

## Requirements

- [Bun](https://bun.sh) (version in `.bun-version`)
- A browser wallet (MetaMask or any injected wallet)
- USDC on a supported source chain

## Setup

```bash
bun install
cp .env.example .env
bun run dev
```

The dev server runs at http://localhost:5173.

## Configuration

| Variable | Values | Effect |
|---|---|---|
| `VITE_USE_MAINNET` | `true` / anything else | `true` targets Arc and mainnet source chains. Otherwise Arc Testnet and testnet sources (default). |

Vite inlines `VITE_*` variables at build time, so change them before building. Never put secrets in them.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Production build to `dist/` |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | oxlint (type-aware) with autofix |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run check` | Lint and typecheck |

## Testing on testnet

1. Set `VITE_USE_MAINNET=false`.
2. Get testnet USDC from [faucet.circle.com](https://faucet.circle.com) on a source chain such as Base Sepolia.
3. Connect your wallet, open Send, and send a small amount to an Arc Testnet address.
4. Confirm the receipt's explorer links resolve and the recipient balance increases on Arc Testnet.

## Deploying

The app is a static build. On Vercel:

- Framework preset: Vite
- Build command: `bun run build`
- Output directory: `dist`
- Environment: set `VITE_USE_MAINNET` for the target network

`vercel.json` contains the SPA rewrite that sends every path to `index.html`; keep it, or `/r/:id` and other deep links will 404 on refresh. Any static host works if it provides the same fallback.

## Adding a source chain

1. Add the viem chain to `config.ts` (`CCTP_SOURCE_CHAINS`, the all-chains list and the transports).
2. Add its metadata, USDC address and explorer to `onchain-facts.ts`.
3. Add its numeric ID to `CHAIN_ID_TO_KIT_NAME` in `lib/kit.ts` using the App Kit chain name.
4. Check that App Kit supports a route from it to Arc.

## Conventions

- Keep App Kit usage inside `lib/kit.ts`.
- Take chain facts from `onchain-facts.ts` and do USDC math with `onchain-money.ts`; never hard-code addresses or decimals.
- Store amounts as strings and compute with `bigint`.

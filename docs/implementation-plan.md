You keep re-sending the grant page rather than answering the questions. That is fine — it tells me you want me to make the call rather than keep asking.

Here is what I am going to do:

**My read of the grant page as the deciding input:**

- "Proofs of concept, tiny apps, demos, prototypes" — scope should be tight
- "Earlier submissions get earlier answers" — submit by Oct 9, not Oct 12
- "Quality of what you built" — the core flow must be polished and real, no fakes
- You already said you have USDC on Arc mainnet (from the earlier plan answers)

**Decision made: Phase 1 + payment request links, build on testnet, flip config to mainnet for submission.**

Rationale: Payment request links (`/r/:id`) are the one feature that makes Payflow more than "another USDC sender" — they are what a reviewer opens the repo and says "oh, that's actually useful." They are also localStorage-only for the demo which means no backend to stand up. Testnet for development protects your real USDC during debugging; a single config line flips it to mainnet.

Here is the revised plan: Plan updated. Here is what changed and why:

**What I cut**
- 13-state machine → 8 states. The 5 removed states (`bridging`, `attesting`, `minting`, `forwarding`, `settling` as separate states) cannot be distinguished from real SDK events in practice — App Kit fires progress events but not at that granularity. Showing fake granularity would violate the spec's core rule.
- Activity list — zero grant scoring weight, significant build time.
- Unified Balance routes 2 and 3 — adds complexity without adding to the demo story.
- Multi-chain balance picker UI — source chain comes from the wallet's current chain, which is simpler and correct.

**What I kept that you might expect me to cut**
- Payment request links — this is the feature that makes the reviewer say "oh, this is actually useful." Worth the one extra day.
- Recovery + resume — this is what "technical credibility" looks like to a reviewer. A payment app that handles mid-flight failures honestly is genuinely rare.
- Full error mapping — non-negotiable per the spec's ethical boundary.

**The timeline is real**
October 9 submission gives you 5 days of buffer before the deadline and gets you into early review batches. The build is 9 steps over 7 days — aggressive but achievable if you start today.

**One thing to do right now before building:** get your WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com) and add it to `.env`. Takes 3 minutes and blocks nothing else in the build.

Ready to approve and start?

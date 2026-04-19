# Wave 2 Deployment Guide

Wave 2 introduces new contract fields (`deadline`, `negotiationType`) and a new function (`submitReservationAsAgent`). The Wave 1 factory at `0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE` does NOT have the new signature — **you must deploy a new factory before using the Wave 2 frontend or API routes.**

## 1. Environment variables

Create `.env` at repo root:

```bash
# Hardhat
PRIVATE_KEY=0x...                         # deployer (needs arb-sepolia ETH)
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Agent
ANTHROPIC_API_KEY=sk-ant-...

# Two-Agent Battle (server-only — NEVER commit)
DEMO_AGENT_A_PRIVATE_KEY=0x...            # fresh wallet, pre-funded
DEMO_AGENT_B_PRIVATE_KEY=0x...            # fresh wallet, pre-funded
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_FACTORY_ADDRESS=<new factory address from step 3>
# Server-only (for API routes) — Next.js will NOT ship these to the browser:
ANTHROPIC_API_KEY=sk-ant-...
DEMO_AGENT_A_PRIVATE_KEY=0x...
DEMO_AGENT_B_PRIVATE_KEY=0x...
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## 2. Fund the demo wallets

Generate two fresh wallets:

```bash
node -e "const w = require('ethers').Wallet.createRandom(); console.log(w.privateKey, w.address)"
```

Fund each with a small amount of Arbitrum Sepolia ETH (0.02 ETH is enough for many runs). Use the Arbitrum Sepolia faucet: https://faucet.quicknode.com/arbitrum/sepolia

## 3. Deploy the new factory

```bash
pnpm compile
npx hardhat deploy-factory --network arb-sepolia
# → NegotiationFactory deployed to: 0x<NEW_ADDRESS>
```

Copy `0x<NEW_ADDRESS>` into `frontend/.env.local` as `NEXT_PUBLIC_FACTORY_ADDRESS`.

## 4. Smoke test the CLI agent (one-shot)

```bash
# Terminal 1 — partyA (uses your deployer wallet)
npx hardhat agent-negotiate \
  --factory 0x<NEW_ADDRESS> \
  --counterparty <DEMO_AGENT_B_ADDRESS> \
  --role partyA \
  --type salary \
  --context "Senior backend engineer, 6 years experience, Bay Area, currently earning 148K base, has a competing offer at 165K base" \
  --network arb-sepolia
# → logs the room address and tx hash
```

At this point Party A has submitted. For the other side you have two choices:

**Option A — Use Solo Agent from the frontend:**
1. `cd frontend && pnpm dev`
2. Open the room via "Enter Existing Room" using the address logged above
3. Switch to "Solo Agent" mode, paste Party B context, derive + submit

**Option B — Use the CLI with the second wallet:**
Import `DEMO_AGENT_B_PRIVATE_KEY` as the signer and run:
```bash
PRIVATE_KEY=$DEMO_AGENT_B_PRIVATE_KEY npx hardhat agent-negotiate \
  --factory 0x<NEW_ADDRESS> \
  --room <ROOM_ADDRESS_FROM_STEP_ABOVE> \
  --role partyB \
  --type salary \
  --context "We are a Series B startup..." \
  --network arb-sepolia
```

## 5. Verify on Arbiscan

1. Go to `https://sepolia.arbiscan.io/address/<ROOM_ADDRESS>`
2. Confirm:
   - Two `PartySubmitted` events
   - Two `AgentSubmission` events (if both sides used the agent path)
   - `resolved()` returns `true`
3. Read `getEncryptedResult()` — returns the encrypted result handle
4. Use the CoFHE SDK's `decryptForTx` flow off-chain to get the plaintext signature
5. Call `publishResults(ebool, bool, bytes, euint64, uint64, bytes)` — `dealExists` and `revealedSplit` are now set

Capture the tx hashes for README + WAVE-SUBMISSION.md.

## 6. Run the frontend locally

```bash
cd frontend
pnpm dev
# Open http://localhost:3000
```

Smoke test both flows:
1. **Two-Agent Battle card** (top of landing page) — click Start with the salary preset
2. **RoomCreator** — create a room with a deadline and `NegotiationType.SALARY`
3. Enter the room as Party A, toggle **Solo Agent**, paste a job description, derive + submit
4. Switch accounts to Party B, repeat

## 7. Vercel deployment (optional — Phase 7)

```bash
cd frontend
vercel --prod
```

In the Vercel dashboard, set the following env vars as **server-side** (NOT `NEXT_PUBLIC_*`):
- `ANTHROPIC_API_KEY`
- `DEMO_AGENT_A_PRIVATE_KEY`
- `DEMO_AGENT_B_PRIVATE_KEY`
- `ARBITRUM_SEPOLIA_RPC_URL`

And one public env var:
- `NEXT_PUBLIC_FACTORY_ADDRESS=0x<NEW_ADDRESS>`

## 8. Troubleshooting

**`Server missing ANTHROPIC_API_KEY`** — the env var isn't loaded in the API route. Check `.env.local` is in the `frontend/` directory (not the repo root).

**`Server missing DEMO_AGENT_A_PRIVATE_KEY`** — same, but for the battle endpoint.

**Two-Agent Battle stuck at `creating_room`** — either the factory address is wrong or `DEMO_AGENT_A` has no ETH to deploy a room.

**`Negotiation expired` on submit** — the room's deadline has passed. Create a new room.

**CoFHE SDK WASM errors in Vercel build** — `serverComponentsExternalPackages` in `next.config.mjs` must include `@cofhe/sdk`, `node-tfhe`, and `tfhe`.

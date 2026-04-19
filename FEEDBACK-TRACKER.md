# BATNA Protocol — Feedback Tracker

> Wave 1 closes the encrypted-input gap. Wave 2 ships the agent layer + deadline + agent provenance. Mark [x] when done.

## Wave 2 — Intent Layer + Live CoFHE

### 8. Agent SDK (agent/)

- [x] Install `@anthropic-ai/sdk` at repo root
- [x] `agent/types.ts` with `NegotiationType` enum mirroring the contract
- [x] `agent/templates/salary.ts` — CANDIDATE vs EMPLOYER prompt framing
- [x] `agent/templates/otc.ts` — SELLER vs BUYER with cents-per-unit (euint64-safe)
- [x] `agent/templates/ma.ts` — SELLER'S BOARD vs ACQUIRER with millions (euint64-safe)
- [x] Template registry + `getTemplate(type)` helper
- [x] `derivePrice.ts` with injectable Anthropic client + 1-retry parse recovery
- [x] `encryptSubmit.ts` bridging CoFHE encryption + ethers submission (reused by CLI + API)
- [x] 30 agent tests (templates, derivePrice w/ mocked Anthropic, encryptSubmit w/ mock CoFHE)

### 9. Contract Extensions (strict TDD)

- [x] `enum NegotiationType { GENERIC, SALARY, OTC, MA }`
- [x] `NegotiationType public negotiationType` storage + constructor param
- [x] `uint256 public deadline` storage + constructor param
- [x] `notExpired` modifier applied to `submitReservation` and `submitReservationAsAgent`
- [x] `event AgentSubmission(address indexed party, address indexed agent)`
- [x] `submitReservationAsAgent(InEuint64, address)` function reusing `_submit()` internal
- [x] Factory `createRoom` passes `deadline` + `negotiationType` through to room
- [x] 8 new Wave 2 contract tests green
- [x] All 19 Wave 1 tests still green (57 total)
- [x] tasks/deploy.ts `create-room` task accepts `--deadline` and `--type`

### 10. Hardhat Task: agent-negotiate

- [x] `tasks/agent.ts` wired into `hardhat.config.ts`
- [x] `--role`, `--type`, `--context`, `--factory`, `--counterparty` params
- [x] Derives via Claude → encrypts via CoFHE mock client → submits via `submitReservationAsAgent`

### 11. Next.js API Routes

- [x] `@anthropic-ai/sdk` + `ethers` added to frontend
- [x] `@batna/agent` path alias (tsconfig + webpack alias + type shim)
- [x] `/api/agent/derive` (POST) — validates input + calls Claude
- [x] `/api/demo/two-agents/start` (POST) — runs full battle using two server-side signers
- [x] `/api/demo/two-agents/status/[sessionId]` (GET) — in-memory session polling
- [x] `serverComponentsExternalPackages` configured for CoFHE SDK WASM compatibility
- [x] Session store split into `_sessions.ts` (lightweight) + `_lib.ts` (heavy) so the status route stays tiny

### 12. Frontend UI

- [x] `ModeToggle` component (Manual / Solo Agent)
- [x] `SoloAgentMode` — paste context → derive via API → browser encrypts → user signs
- [x] `TwoAgentBattle` — landing page demo with pre-filled templates + live progress animation
- [x] `NegotiationUI` wraps existing Manual flow with `<ModeToggle>`
- [x] `RoomCreator` extended with deadline picker + NegotiationType dropdown
- [x] Frontend ABI updated to match Wave 2 contract
- [x] `pnpm build` completes cleanly

### 13. Deployment + demo (owner action)

- [ ] Deploy new factory (Wave 1 factory at 0x1221 lacks the new signature)
- [ ] Fund DEMO_AGENT_A/B wallets on Arbitrum Sepolia
- [ ] Run `agent-negotiate` once for each side as a smoke test
- [ ] Verify publishResults end-to-end and capture tx hashes
- [ ] `cd frontend && vercel --prod` with env vars set server-side
- [ ] Record 60s demo video of Two-Agent Battle
- [ ] Update README with new factory address + Vercel URL + demo video link

---

# Wave 1 Feedback Tracker (archived)

## Must-Do (Items 1-3)

### 1. Ship Real Encrypted Input Flow

- [x] Change `submitReservation(uint256)` → `submitReservation(InEuint64 calldata)`
- [x] Import `InEuint64` in contract
- [x] Update NatSpec comments
- [x] Add `@cofhe/sdk` + `@cofhe/react` to frontend
- [x] Configure next.config.mjs for WASM
- [x] Add CofheProvider to Providers.tsx (dynamic import for SSR)
- [x] Encrypt client-side with `Encryptable.uint64()` before submission
- [x] Encryption progress UI (InitTfhe → FetchKeys → Pack → Prove → Verify)
- [x] Update ABI in frontend config
- [x] No plaintext reservation price ever touches contract API

### 2. Fix Repo Trust Gap

- [x] Frontend code updated and ready to push
- [x] Push frontend/ to GitHub
- [x] Add repo description, website, and topics on GitHub
- [ ] Publish tagged release (e.g., `wave1-submission`) — deferred, not needed now
- [x] Add screenshots/GIF in README
- [x] Add deployed contract address and tx links in README
- [x] Deploy contracts to Arbitrum Sepolia (Factory: 0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE)

### 3. Add publishResults Tests

- [x] Test: cannot publish before resolution
- [x] Test: getEncryptedResult reverts before resolution
- [x] Test: getEncryptedZopa reverts before resolution
- [x] Update existing tests to use encrypted inputs (InEuint64 via Encryptable.uint64())

## Should-Do (Items 4-7)

### 4. Weighted Midpoint / Programmable Settlement

- [x] Add `weightA` parameter to NegotiationRoom constructor (0-100)
- [x] Implement weighted settlement: `(A * w + B * (100-w)) / 100`
- [x] Update factory to pass weight parameter
- [x] Add tests for weighted midpoint (weightA=60 → 140000, weightA=50 → 137500)
- [x] Update frontend RoomCreator with weight slider

### 5. Rename "Zero-Knowledge" → "Encrypted"

- [x] README title: "Encrypted Negotiation Engine on Fhenix CoFHE"
- [x] All references in README, ABOUT.md, WAVE-SUBMISSION.md
- [x] Frontend UI text ("Encrypted Negotiation")
- [x] Contract NatSpec ("Encrypted ZOPA Detection")

### 6. Add Threat-Model Table

- [x] Add "Privacy Boundary — What Leaks, What Doesn't" table to README
- [x] Covers: party prices, overlap existence, final result, room metadata, timing, weight

### 7. Sharpen Wave 1 Demo Angle

- [x] Lead WAVE-SUBMISSION.md with: "fully encrypted bilateral negotiation primitive"
- [x] Updated submission to emphasize: InEuint64 inputs, weighted settlement, CoFHE SDK integration
- [x] Privacy boundary section in submission
- [x] Push all changes to GitHub
- [x] Deploy to Arbitrum Sepolia
- [ ] Create release tag — deferred, not needed now

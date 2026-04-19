## What it does

BATNA Protocol is an **encrypted negotiation engine** on Fhenix CoFHE. Two parties submit encrypted reservation prices — plaintext never touches the chain. The contract computes overlap and weighted settlement on ciphertexts. Only the outcome is revealed.

**Live:** https://batna-protocol.vercel.app/ — click **Start Battle** to watch two AI agents auto-negotiate on Arbitrum Sepolia in real time.

**Three modes:**

| Mode | Who derives the price | Who encrypts + submits |
|---|---|---|
| **Manual** | Human types a number | Browser (WASM) · user wallet |
| **Solo Agent** | Claude reads free-form context | Browser (WASM) · user wallet |
| **Two-Agent Battle** | Two Claude agents read opposing contexts | Server · two demo wallets |

**How it works:** Party A encrypts min as `InEuint64`, Party B encrypts max. `FHE.lte(encMinA, encMaxB)` checks overlap on ciphertexts. Weighted settlement: `(minA·weightA + maxB·weightB) / 100`. `decryptForTx` + `publishResults` reveals only the final plaintext via threshold decryption — inputs stay sealed forever.

**Example (Two-Agent Battle):** Candidate = "Senior engineer, competing offer at $165K." Employer = "Series B, band $135K–$170K." Claude derives **$168K floor + $170K ceiling**. Resolves to **$169K midpoint** on-chain. Neither number ever leaked.

### AI Agents Turn Any Negotiation Into Math (Shipped in Wave 2)

An agent reads free-form context, calls `claude-opus-4-6`, derives a reservation price, encrypts via CoFHE SDK, and submits on-chain. Three templates — Salary, OTC, M&A. `submitReservationAsAgent()` + `AgentSubmission` event record provenance on-chain.

| Scenario | Agent behavior |
|---|---|
| **Salary** | Candidate reads job desc → encrypted floor. Employer reads band → encrypted ceiling. |
| **OTC** | Seller + buyer agents derive unit price in cents per token (euint64-safe). |
| **M&A** | Board floor vs acquirer ceiling in integer USD millions. |

**Geopolitical example (US-Iran):** neither side can publicly state acceptable concessions without appearing weak. Each side's agent analyzes sanctions, military cost, domestic pressure → derives encrypted terms, submits. If ranges overlap, a framework emerges. If not, neither side learns the gap. **No diplomat reveals a position. The math finds the deal.**

## The problem it solves

Whoever reveals their number first gets exploited — an 80-year-old game theory problem.

| Alternative | Why it fails |
|---|---|
| **Trusted third party** | Can leak or be compromised |
| **Commit-reveal** | Reveal phase exposes your number |
| **ZK proofs** | Cannot compute on ciphertexts — no `FHE.add()` equivalent |

**FHE is the only primitive where both values stay encrypted during computation and only the result is revealed.** This product cannot exist without FHE.

## Privacy Boundary

| Data | Visibility |
|---|---|
| Party reservation prices | **Hidden** — encrypted client-side, never decrypted |
| ZOPA existence (before publish) | **Hidden** |
| Final settlement result | **Revealed** only after threshold decryption + `publishResults` |
| Room metadata / addresses / timing | **Public** |

**Auditor invariant (enforced + tested):** when an auditor address is set, `FHE.allow(encResult, auditor)` + `FHE.allow(encZopaExists, auditor)` are the only grants. `encMinA` and `encMaxB` are never allowed. The contract exposes `auditorAccess()` which reads the ACL live via `FHE.isAllowed()`; tests assert `canSeeMinA == canSeeMaxB == false` after every resolution.

## Challenges I ran into

**`euint256` doesn't exist** — redesigned around `euint64`. **ACL is unforgiving** — forgetting `FHE.allowThis()` bricks the contract. **CoFHE SDK SSR** — Next.js WASM fixed with dynamic imports + `serverComponentsExternalPackages`. **Vercel stateless Lambdas** — in-memory session store 404'd in prod; rewrote `/start` as NDJSON streaming so the whole battle runs in one Lambda. **Threshold decryption timing** — `decryptForTx` returns zeros right after `allowPublic()`; fixed with retry + backoff (~40s) until the signed plaintext lands.

## Technologies I used

**FHE:** `InEuint64`, `euint64`, `ebool`, `FHE.lte()`, `FHE.mul()`, `FHE.add()`, `FHE.div()`, `FHE.select()`, `FHE.allowPublic()`, `FHE.publishDecryptResult()`
**Agent SDK:** `@anthropic-ai/sdk` (`claude-opus-4-6`) with mock-injectable client + 3 templates.
**CoFHE:** `@cofhe/sdk` (browser) + `@cofhe/sdk/node` + `@cofhe/react` — `Encryptable.uint64()`, `decryptForTx`, CofheProvider.
**Stack:** Solidity 0.8.25, Hardhat, Next.js 14 (NDJSON streaming), wagmi v2, ethers v6, RainbowKit, Fraunces + Geist Mono — **62 TDD tests green** (incl. auditor-ACL invariant + edge-weight overflow cases).
**Deployed:** [Arbitrum Sepolia](https://sepolia.arbiscan.io/address/0x5325cF28337b2f2cf7C8EcE121fdF73d18885915) · [Live dApp](https://batna-protocol.vercel.app/)

## How we built it

Strict TDD from the first line. Contract tests use real CoFHE SDK encrypted inputs; agent tests inject a mock Anthropic client so prompt/parse stays deterministic and offline. The `encryptSubmit` helper is shared by the Hardhat CLI `agent-negotiate` task and the Next.js streaming `/start` route — one code path, two surfaces. Wave 2 contract additions: `NegotiationType` enum, `deadline` + `notExpired`, `AgentSubmission(party, agent)` event, `submitReservationAsAgent()`.

## What we learned

**FHE hides _what_, not just _who_.** Encrypted inputs matter as much as encrypted compute: `InEuint64` + browser-WASM closes the gap `FHE.add()` alone can't. Six FHE ops power the mechanism: `lte`, `mul`, `add`, `div`, `select`, `allowPublic`.

## What's next

**Wave 2 — ✅ Shipped:** Claude agent layer, 3 templates, Two-Agent Battle, on-chain agent provenance, publish-result reveal, Vercel deploy.
**Wave 3:** N-party encrypted ZOPA + encrypted reputation.
**Wave 4:** Privara settlement + `@batna-protocol/sdk`.
**Wave 5:** NY Tech Week live demo.

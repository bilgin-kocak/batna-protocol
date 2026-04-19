# BATNA Protocol — Wave 2 Submission


== UPDATES IN THIS WAVE (Wave 2) ==

Wave 2 lands the differentiator: humans submit intent, the protocol computes the deal. Claude reads free-form context, derives a reservation price, encrypts via CoFHE SDK, submits on-chain. Anthropic API key stays server-side; user custody never touched.

LIVE: https://batna-protocol.vercel.app/

HEADLINE DEMO — TWO-AGENT BATTLE: Two AI agents read opposing context (candidate vs employer, seller vs buyer, board vs acquirer). Each derives a reservation price via claude-opus-4-6, encrypts via CoFHE Node SDK, submits via submitReservationAsAgent() — emitting on-chain AgentSubmission(party, agent) for provenance. Room auto-resolves on ciphertexts. Click Reveal on-chain: server threshold-decrypts via decryptForTx and calls publishResults(). The plaintext midpoint lands on-chain, closing the full encrypted→settled loop. Example: candidate floor 168000, employer ceiling 170000 → settles at 169000. Neither number ever leaked.

SOLO AGENT: Party pastes context. /api/agent/derive returns a price; browser encrypts via CoFHE WASM; user signs via wagmi. Derivation and custody cleanly separated.

CONTRACT ITERATION (strict TDD): NegotiationType enum, uint256 deadline + notExpired modifier, AgentSubmission event, submitReservationAsAgent() reusing _resolve(). Judge feedback addressed: new auditorAccess() view queries FHE.isAllowed() live — canSeeMinA/canSeeMaxB MUST be false; invariant asserted in tests. Overflow: (minA·wA + maxB·wB)/100 safe when max(minA,maxB) < 2^64/100 ≈ 1.84e17 — documented + covered by wA=0, wA=100, and $1T-deal tests.

AGENT SDK (agent/): TypeScript registry of templates (Salary, OTC cents-per-unit, M&A millions). derivePrice.ts uses an injectable Anthropic client so tests mock the LLM; encryptSubmit.ts shares one CoFHE-encrypt+ethers-submit path between CLI and API routes.

NEXT.JS API: /api/demo/two-agents/start is an NDJSON stream — the whole battle runs in ONE Lambda with maxDuration=60, sidestepping Vercel's stateless-between-requests trap (no KV, no polling). /api/demo/two-agents/reveal retries decryptForTx + publishResults with backoff (~40s) until the coprocessor signs.

TESTS: 19 → 62 (all green). Auditor-ACL invariant, edge-weight overflow, deadline, enum, AgentSubmission, templates, derivePrice retry, encryptSubmit e2e. Contract tests use real CoFHE SDK encrypted inputs; agent tests inject a mock Anthropic client.

FRONTEND: ZopaHero SVG hero + Fraunces×Geist Mono typography + trading-terminal corner brackets. Two-Agent Battle card with scenario presets and split-console context inputs; progress as a vertical timeline with timestamps, Arbiscan tx links, ticking counters, vault-reveal callout on resolve. Manual / Solo Agent toggle per room.

DEPLOYED (Wave 2, Arbitrum Sepolia): https://sepolia.arbiscan.io/address/0x5325cF28337b2f2cf7C8EcE121fdF73d18885915

Wave 2 converts BATNA into intent-driven agentic negotiation, settled on-chain.


== MILESTONE — 3rd Wave ==

Multi-Party ZOPA — find a deal that satisfies ALL parties without revealing ANY party's constraints. N suppliers submit encrypted price ranges; buyer submits encrypted budget; contract finds which supplier fits, at what price — no supplier sees competitor pricing. Encrypted reputation: deal count (public) + total value + fairness ratings (private). N-way FHE.lte() chains, encrypted max-of-mins / min-of-maxes, threshold decryption of multi-party results. Enterprise procurement on encrypted rails — the open FHE engineering problem no other team will attempt.


== MILESTONE — 4th Wave ==

Privara Settlement + Developer SDK — turn BATNA from "computes the price" into "executes the deal end-to-end". When a room resolves, @reineira-os/sdk executes confidential payment over Privara's compliant stablecoin rails: encrypted escrow locks funds before submission, confidential transfer fires on settlement, the negotiated amount is the only plaintext that ever appears. The developer counterpart: @batna-protocol/sdk — five-line integration for any dApp. Pre-built React hooks (useNegotiationRoom, useEncryptedSubmit, useDealResult), TypeScript types for every contract surface, reference apps for salary tooling, OTC desks, and procurement portals. Exhaustive FHE.allowList audit — every ciphertext handle documented with who can access it, gas benchmarks for all FHE ops on Arbitrum Sepolia, emergency pause. BATNA stops being a primitive and becomes composable infrastructure.

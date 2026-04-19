# BATNA Protocol — Wave Submissions


== UPDATES IN THIS WAVE (Wave 1) ==

Whoever reveals their number first loses. Every salary negotiation, every OTC deal, every M&A term sheet — the party that anchors first gets exploited. Billions lost annually. This is an 80-year-old game theory problem with no prior on-chain solution.

BATNA (Best Alternative to a Negotiated Agreement) Protocol solves it. Parties submit encrypted reservation prices via CoFHE SDK (InEuint64) — plaintext never touches the blockchain. The contract computes overlap and weighted settlement entirely on ciphertexts. Only the outcome is revealed. No brokers, no escrow agents, no off-chain negotiation.

DEMO: Candidate submits $130K minimum (encrypted). Company submits $145K maximum (encrypted). Neither number appears in calldata, state, or events. Contract settles at $137,500. No party ever sees the other's number.

If no overlap? The contract proves "no deal" without revealing how far apart positions were. Even the failure path leaks nothing.

This is impossible on any transparent chain.

WHY FHE (NOT ZK/COMMIT-REVEAL): Commit-reveal leaks at reveal phase. ZK can prove "my value is in range X" but cannot compute the midpoint of two hidden ranges — there is no ZK equivalent to FHE.add() on ciphertexts. FHE is the ONLY method enabling computation on hidden inputs with permanent input secrecy. BATNA cannot exist without FHE.

CONTRACTS: NegotiationRoom.sol executes full negotiation on ciphertexts — overlap detection (FHE.lte), weighted settlement (FHE.mul + FHE.add + FHE.div, programmable 0-100), conditional routing (FHE.select), confidential auditability (optional party-designated auditor decrypts result only, never inputs — disabled by default), threshold decryption (FHE.publishDecryptResult), strict ACL.

Side-channel resistant: FHE.select() ensures identical gas and execution path for deal and no-deal outcomes. A failed negotiation is indistinguishable from a successful one on-chain.

NegotiationFactory.sol — permissionless deployment with configurable weight + auditor.

TESTING: 19 TDD tests — all using real CoFHE SDK encrypted inputs (Encryptable.uint64()), not plaintext. Mock coprocessor is standard for local testing; live CoFHE integration targets Wave 2. Covers ZOPA detection (137,500 verified), weighted settlement (weightA=60 → 140,000), no-deal, publishResults guards, access control, factory tracking.

FRONTEND: Next.js 14 + wagmi v2 + RainbowKit + CoFHE SDK. Client-side encryption — plaintext never leaves the browser. Encryption progress UI. Four states: Input → Sealed → Deal → No Deal.

DEPLOYED (Arbitrum Sepolia): https://sepolia.arbiscan.io/address/0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE

Individual reservation prices never become decryptable — not by the contract, not by the other party, not by the network. The first system that executes real negotiations on-chain without revealing positions. It cannot exist without FHE.


== UPDATES IN THIS WAVE (Wave 2) ==

Wave 2 lands the differentiator: humans submit intent, the protocol computes the deal. Claude reads a job description, OTC brief, or M&A memo, derives a reservation price, encrypts it via CoFHE SDK, and submits to the contract. The Anthropic API key never leaves the server. The user's wallet never signs anything it didn't approve.

HEADLINE DEMO — TWO-AGENT BATTLE: Click Start. Two AI agents read opposing context (candidate vs employer, seller vs acquirer, seller's board vs strategic buyer). Both derive their reservation price via claude-opus-4-6 in parallel. Both encrypt via CoFHE Node SDK. Both submit via submitReservationAsAgent, which emits an on-chain AgentSubmission event for provenance. The room auto-resolves on ciphertexts. User just watches encrypted tx hashes settle on Arbitrum Sepolia. Neither agent's number ever leaks.

SOLO AGENT MODE: Inside any existing room, a party can paste free-form context ("Senior backend engineer, 6 years, Bay Area, competing offer at 165K"). POST to /api/agent/derive returns a plaintext price. The browser then encrypts it via the CoFHE WASM client and the user signs + submits via wagmi. Agent derivation and user custody remain cleanly separated.

TEMPLATES SHIPPED: salary (candidate floor vs employer ceiling, integer USD), OTC (seller floor vs buyer ceiling, integer cents per unit so euint64 fits without floats), M&A (seller's board floor vs acquirer ceiling, integer USD millions). Each template is a single file — the registry pattern makes Wave 3 additions one-file drops.

CONTRACT ITERATION (strict TDD): NegotiationRoom.sol now ships NegotiationType enum {GENERIC, SALARY, OTC, MA} with on-chain metadata; uint256 deadline + notExpired modifier enforcing submission timeouts; event AgentSubmission(address indexed party, address indexed agent); function submitReservationAsAgent(InEuint64 encryptedAmount, address agent) reusing the same _resolve() path. NegotiationFactory.createRoom passes deadline + type through. All 19 Wave 1 tests stay green; 8 new Wave 2 contract tests cover deadline enforcement, enum storage, agent event emission, and end-to-end resolution via the agent entry point.

AGENT SDK (agent/): TypeScript module at repo root. derivePrice.ts wraps Anthropic with an injectable client so unit tests mock the LLM. encryptSubmit.ts bridges CoFHE encryption + ethers submission with a single helper reused by both the CLI task and the Next.js API routes. 30 new agent tests: 18 template tests (prompt shape, parser edge cases, registry), 5 derivePrice tests (retry on garbage, parse success, prompt composition), 4 encryptSubmit tests (mock CoFHE + real room + verifies AgentSubmission event fires + e2e resolves to correct midpoint).

CLI DEMO: npx hardhat agent-negotiate --factory <addr> --role partyA --type salary --context "..." --counterparty <addr> --network arb-sepolia. One command derives, encrypts, submits, logs the room state. Perfect for screen recordings and CI-style verification.

NEXT.JS API (Node runtime, server-only env vars): /api/agent/derive proxies Claude with input validation. /api/demo/two-agents/start runs the full battle using two pre-funded ephemeral demo wallets (DEMO_AGENT_A/B_PRIVATE_KEY), streams state through an in-memory session store. /api/demo/two-agents/status/[sessionId] for browser polling. CoFHE Node SDK (@cofhe/sdk/node) is externalized via serverComponentsExternalPackages so WASM loads correctly in the Next.js build.

TEST COUNT: 19 → 57. All green. Coverage: 6 factory + 21 room (incl. 8 new Wave 2 tests) + 18 template + 5 derivePrice + 4 encryptSubmit + 3 parseInteger.

FRONTEND: ModeToggle (Manual / Solo Agent) inside every room UI. TwoAgentBattle component on the landing page with pre-filled sample contexts for each template. Pollable progress visualization: deriving_a → deriving_b → creating_room → encrypting_a → submitted_a → encrypting_b → resolved. RoomCreator extended with deadline picker + NegotiationType dropdown. Dynamic SSR-off import preserved for CoFHE WASM compatibility.

TOTAL WAVE 2 DIFF: ~1,500 lines of Solidity + TypeScript + React + API routes. All tests green. Frontend builds clean. Architecture flows cleanly through the same code path from Hardhat task → API route → browser.

DEPLOYED (Wave 2, Arbitrum Sepolia): https://sepolia.arbiscan.io/address/0xE387f4FDa884FCc976F3f27853E34FdB895E9fBE


== MILESTONE — 3rd Wave ==


== MILESTONE — 3rd Wave ==

Multi-Party ZOPA — Find a deal that satisfies ALL parties without revealing ANY party's constraints. N suppliers submit encrypted price ranges. Buyer submits encrypted budget. Contract finds which supplier fits, at what price — no supplier sees competitor pricing. Encrypted reputation system: deal count (public) + total value + fairness ratings (private). This is enterprise procurement on encrypted rails.

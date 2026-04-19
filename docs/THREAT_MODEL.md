# BATNA Protocol — Threat Model

This document enumerates adversaries, their capabilities, what they can attack, and the mitigations BATNA provides.

## Adversary catalogue

| # | Adversary | Capabilities | Mitigation |
|---|---|---|---|
| **T1** | **Counterparty** — Party B wants Party A's floor so B can quote that number exactly. | Has the room address. Can read all on-chain state. Can call any public function. Can watch Party A's submission tx in mempool. | Party A's floor is encrypted via `InEuint64` in the browser before the tx. `encMinA` is FHE-ciphertext throughout. `FHE.allow(encMinA, partyA)` only — never B. `FHE.lte / mul / add / div / select` run on ciphertexts; the result is the only plaintext. Covered by `test/NegotiationRoom.test.ts` auditor-ACL invariant tests. |
| **T2** | **Chain observer / MEV** — wants to extract the reservation prices from calldata or logs. | Indexes every tx, every event. Runs a validator. | `InEuint64` is already a ciphertext when submitted; the raw plaintext never enters calldata. The result is the only plaintext after `publishResults`. No plaintext context either — `contextHash` is `bytes32 keccak256(context)`. |
| **T3** | **Auditor** (designated at room creation) — may be compromised or acting in bad faith. | `auditor != address(0)`. Has standard EOA capabilities. The coprocessor will return a signed decryption for any handle on which `FHE.allow(handle, auditor)` was called. | `FHE.allow(encMinA, auditor)` and `FHE.allow(encMaxB, auditor)` are **never** called. Only `encResult` and `encZopaExists` are granted. The `auditorAccess()` view function exposes the live ACL state; tests assert `canSeeMinA == canSeeMaxB == false` after every resolution. |
| **T4** | **Stalled-room denial of service** — a malicious counterparty never submits to lock up Party A. | Creates or joins a room and never submits. Keeps the room in limbo. | Rooms accept an optional `deadline`. Past the deadline, either party can call `expireRoom()` → status becomes `EXPIRED` → no more submissions possible, off-chain escrow logic (Wave 4) can refund. Before any submission, either party can call `cancelRoom()` to abort cleanly. |
| **T5** | **Agent service operator** (a legitimate BATNA deployer running the Next.js API with `DEMO_AGENT_A/B_PRIVATE_KEY`). | Sees the plaintext context, sees the Claude response (the derived price), and briefly holds the plaintext before it's encrypted via CoFHE Node SDK. | **Wave 2 trust assumption (documented honestly):** the agent service is trusted with the plaintext derivation. Only the BATNA deployer operates it. Two mitigations already in place: (a) in the UI's Solo Agent mode, the plaintext price is returned to the browser and the user signs + submits from their own wallet, so the server never holds user funds or custody; (b) the agent service never sees the user's actual reservation price — it only sees the context the user pasted, and derives a price from it, then immediately encrypts. **Wave 5 roadmap:** move the agent into a TEE (Intel SGX via Phala, or Lit Protocol) so the operator can prove the derivation without ever seeing the plaintext. |
| **T6** | **Server-side compromise of `DEMO_AGENT_A/B_PRIVATE_KEY`** — an attacker exfiltrates the demo wallet keys. | Can impersonate the demo agent wallets. Can submit arbitrary reservation prices on behalf of the compromised wallet. | These keys are **demo-only** with minimal arb-sepolia ETH. No mainnet funds, no real user funds. Compromise cost is bounded by the dust in the demo wallets. Production deployment would not use shared demo wallets — each party signs from their own wallet. |
| **T7** | **Replay / multi-submission from the same party.** | Calls `submitReservation` twice to overwrite their earlier value. | `aSubmitted` / `bSubmitted` bool flags prevent a second submission from the same party. Tests: `prevents double submission from party A/B`. |
| **T8** | **Non-party callers** — a third party tries to submit or publish. | Calls public functions directly. | `onlyParty` modifier rejects any non-party caller. Tests: `rejects submission from non-party address`, `submitReservationAsAgent rejects non-party callers`. |
| **T9** | **Threshold network failure during reveal.** | `decryptForTx` returns stale / placeholder values with invalid signatures. | `FHE.publishDecryptResult` in the contract verifies the coprocessor signature. Invalid signature → revert. Client-side, the reveal route retries `decryptForTx + publishResults` with backoff (~40s) until the network's signed plaintext lands. |
| **T10** | **Overflow at extreme reservation values.** | Submits `minA ≈ type(uint64).max / 2` with `weightA = 100`. Intermediate products would overflow. | Safe range documented in `_resolve()` NatSpec: `max(minA, maxB) < 2^64 / 100 ≈ 1.84e17`. Covers every realistic deal size by 8+ orders of magnitude. Edge-weight tests (`weightA=0`, `weightA=100`) pin the formula. |

## Trust anchors

BATNA's security reduces to these:

1. **Fhenix CoFHE threshold network** is honest (n-of-m threshold, standard FHE assumption).
2. **The FHE encryption scheme (TFHE)** is IND-CPA secure.
3. **The Solidity compiler and EVM** execute the contract as written.
4. **Agent service operator** is trusted with plaintext derivation in Wave 2 (see T5).

Everything else — counterparty behavior, MEV, auditor behavior, non-party callers — is handled by the protocol.

## Known limitations

- **Plaintext context preimage** is stored in the creator's browser `localStorage` and shared out-of-band with counterparties. This is the same trust model as any off-chain metadata.
- **Auditor registration is creator-chosen**, not permissioned. If a party doesn't trust the creator's choice of auditor, they should not participate.
- **Deadline enforcement relies on `block.timestamp`**. Validator timestamp manipulation has a window of ~15s on Arbitrum; setting `deadline` to at least a few minutes in the future avoids meaningful exposure.

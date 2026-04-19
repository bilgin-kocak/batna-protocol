# BATNA Protocol — Privacy Model

This document specifies, for every piece of data the protocol touches, who can see it at every stage. It is the contract-level answer to _"what leaks?"_

## Actor vocabulary

| Actor | Description |
|---|---|
| **Party A** | The address that submits the minimum acceptable value (floor). In Two-Agent Battle mode, this is a pre-funded demo server wallet. |
| **Party B** | The address that submits the maximum willing value (ceiling). |
| **Auditor** | Optional address designated at room creation. `address(0)` = no auditor. |
| **Agent (AI)** | Optional address that produced a reservation price via an LLM. Logged for provenance; does not control funds. |
| **Coprocessor** | The CoFHE threshold network that holds the FHE decryption share. Does not run on a single server. |
| **Public** | Anyone with an RPC endpoint. Covers judges, indexers, block explorers. |

## Data matrix

| Data | Party A | Party B | Auditor | Agent | Public |
|---|---|---|---|---|---|
| `encMinA` (floor, ciphertext) | 🔓 allow-list only | ❌ | ❌ | ❌ | ❌ |
| `encMaxB` (ceiling, ciphertext) | ❌ | 🔓 allow-list only | ❌ | ❌ | ❌ |
| Party A plaintext floor | 🟢 | ❌ | ❌ | ❌ (sees the context it was derived from; never the derived number after encryption) | ❌ |
| Party B plaintext ceiling | ❌ | 🟢 | ❌ | ❌ (same) | ❌ |
| `encZopaExists` (bool, before publish) | ❌ | ❌ | 🔓 via allow | ❌ | 🔓 via allowPublic |
| `encResult` (settlement, before publish) | ❌ | ❌ | 🔓 via allow | ❌ | 🔓 via allowPublic |
| `dealExists` (after `publishResults`) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| `revealedSplit` (after `publishResults`) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| `contextHash` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Plaintext negotiation context | depends on off-chain distribution; browser preserves preimage in `localStorage` for the creator | same | not granted by default | depends on delivery | ❌ |
| Room address, party addresses, timing | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Settlement weight (`weightA`) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| `AgentSubmission.templateId` / `modelHash` / `promptVersionHash` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |

Legend: 🟢 plaintext-readable · 🔓 only via the CoFHE ACL (threshold decryption + signed by the network) · ❌ cryptographically sealed

## Invariants (all enforced on-chain, covered by tests)

1. **The auditor never learns individual reservation prices.** `FHE.allow(encMinA, auditor)` and `FHE.allow(encMaxB, auditor)` are **never** called. `auditorAccess()` returns `canSeeMinA == canSeeMaxB == false`. Asserted in `test/NegotiationRoom.test.ts`.
2. **The contract itself never decrypts.** All ZOPA + midpoint logic runs on ciphertexts (`FHE.lte`, `FHE.mul`, `FHE.add`, `FHE.div`, `FHE.select`). The contract has no access to the plaintext values.
3. **Side-channel resistance.** `_resolve()` executes an identical code path for deal and no-deal outcomes (`FHE.select(zopaExists, midpoint, 0)`). Gas usage does not encode the outcome.
4. **`revealedSplit` only becomes non-zero after a threshold-signed publish.** `FHE.publishDecryptResult` verifies the coprocessor signature before the plaintext is written.
5. **`contextHash` is the only on-chain metadata.** The plaintext context never appears in calldata, storage, or events.

## What the threat model does **not** cover

- **Social / off-chain leakage.** If Party A tells Party B their floor over coffee, the protocol can't help.
- **Browser-side plaintext.** While the party types a number, the plaintext is in their browser memory. Encrypted at submission; unencrypted until then.
- **Agent service compromise.** See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the agent trust boundary.

See also: [`THREAT_MODEL.md`](./THREAT_MODEL.md), [`../README.md#confidential-auditability`](../README.md).

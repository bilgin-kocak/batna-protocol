# Security

## Reporting a vulnerability

If you discover a security issue in BATNA Protocol, please **do not open a public GitHub issue**. Instead, email the maintainer: **kocakbilgin@gmail.com** with:

- A description of the vulnerability
- Reproduction steps, PoC, or affected contract / file paths
- Your assessment of impact

Expect an initial response within **72 hours**. If the issue is confirmed, we will work on a fix, coordinate disclosure, and credit the reporter in the advisory.

## Scope

| In scope | Out of scope |
|---|---|
| `contracts/NegotiationRoom.sol` | Old factory at `0x1221...` (Wave 1, deprecated) |
| `contracts/NegotiationFactory.sol` | Third-party dependencies (CoFHE, OpenZeppelin, viem, ethers) — report upstream |
| `agent/` TypeScript module | Frontend styling, typography, animation |
| `frontend/src/app/api/*` route code | Vercel platform issues |

## Supported versions

The `wave2-submission` tag is the current supported release. `main` tracks work-in-progress and may contain unreviewed changes.

## Known trust assumptions

See [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) for the full adversary catalogue. Summary of the assumptions that are **by design**:

1. **CoFHE threshold network** is honest (standard FHE assumption).
2. **TFHE** is IND-CPA secure.
3. **EVM and Solidity compiler** execute as specified.
4. **Agent service operator** is trusted with plaintext derivation in Wave 2. Wave 5 roadmap moves agent execution into a TEE (Phala / Lit Protocol) to remove this assumption.

## Privacy invariants (enforced + tested)

Full list in [`docs/PRIVACY_MODEL.md`](./docs/PRIVACY_MODEL.md). Three critical ones:

1. **Auditor never decrypts individual reservation prices** — enforced in `_resolve()`, exposed via `auditorAccess()`, tested in `test/NegotiationRoom.test.ts`.
2. **Plaintext context never lands on-chain** — only `bytes32 contextHash`.
3. **Settlement side-channel resistance** — `FHE.select` ensures identical gas + execution for deal and no-deal outcomes.

## Operational security

- **Server-only env vars** (`ANTHROPIC_API_KEY`, `DEMO_AGENT_*_PRIVATE_KEY`) must never have `NEXT_PUBLIC_` prefix in Vercel. Verified at startup via explicit `process.env` reads.
- **Demo wallets** hold minimal arb-sepolia ETH. Not funded on mainnet. Key compromise is bounded by demo-wallet dust.
- **Contracts are not upgradeable.** Fixes require a new factory deployment and client migration.

## Acknowledgments

Thanks to the judges and reviewers whose feedback materially hardened the protocol during Wave 2 — context hash migration, room lifecycle, auditor ACL invariant, and overflow analysis all came from direct security review.

# BATNA Protocol

**On-chain private deal execution. Powered by Fhenix CoFHE.**

**Whoever reveals their number first loses** — salary, OTC, M&A, procurement. BATNA solves this 80-year-old game theory problem using FHE.

**How it works:** Both parties submit encrypted reservation prices (InEuint64 via CoFHE SDK). The contract computes overlap and weighted settlement entirely on ciphertexts. Only the result is revealed. If no deal — the contract proves disagreement without revealing positions.

**Why only FHE:** ZK can prove ranges but can't compute the midpoint of two hidden values. Commit-reveal leaks at reveal. FHE is the only primitive where inputs stay permanently sealed while computation runs on ciphertexts.

**Wave 1 shipped:** Encrypted inputs (InEuint64), weighted settlement (FHE.mul + FHE.div), side-channel resistant (identical gas for deal/no-deal), optional auditor, 19 tests with real encrypted inputs, Next.js + CoFHE SDK frontend, deployed on Arbitrum Sepolia.

**Next:** Wave 2 — intent-based automation. Wave 4 — Privara SDK for confidential settlement payment.

**GitHub:** https://github.com/bilgin-kocak/batna-protocol
**Live contract (Wave 2.1):** https://sepolia.arbiscan.io/address/0x5325cF28337b2f2cf7C8EcE121fdF73d18885915

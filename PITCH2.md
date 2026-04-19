# BATNA Protocol

**Encrypted deal execution on Fhenix CoFHE.**

**Whoever reveals their number first loses.** BATNA turns negotiation into encrypted on-chain execution — salary, OTC, M&A, procurement. Two parties submit hidden reservation prices (InEuint64 via CoFHE SDK). The contract computes overlap and weighted settlement on ciphertexts. Only the result is revealed. Not a dark pool — the negotiation primitive that runs before any execution. No broker, no reveal phase, no leaked positions.

If no deal — the contract proves disagreement without revealing how far apart positions were. Even failure paths are side-channel resistant (identical gas via FHE.select).

**Why FHE:** ZK can't compute the midpoint of two hidden values. Commit-reveal leaks at reveal. FHE is the only primitive where inputs stay permanently sealed while computation runs on ciphertexts.

**Wave 1 shipped:** Encrypted inputs, weighted settlement, optional auditor, 19 tests with real encrypted inputs, Next.js + CoFHE SDK frontend, deployed on Arbitrum Sepolia. Next: AI agents that read context, derive prices, and submit encrypted bids autonomously (Wave 2). Privara confidential settlement (Wave 4). Two-party ZOPA is solved — N-party encrypted consensus is Wave 3.

https://github.com/bilgin-kocak/batna-protocol | [Live contract (Wave 2.1)](https://sepolia.arbiscan.io/address/0x5325cF28337b2f2cf7C8EcE121fdF73d18885915)

## What it does

BATNA Protocol is an **encrypted negotiation engine** on Fhenix CoFHE. Two parties submit encrypted reservation prices via CoFHE SDK (`InEuint64`) — plaintext never touches the blockchain. The contract computes overlap and weighted settlement on ciphertexts. Only the final outcome is revealed.

**How it works:**

1. Party A encrypts their **minimum** client-side and submits `InEuint64`
2. Party B encrypts their **maximum** client-side and submits `InEuint64`
3. `FHE.lte(encMinA, encMaxB)` checks overlap — entirely on ciphertexts
4. If deal: weighted settlement `(minA * weightA + maxB * weightB) / 100`
5. Only the result is revealed via threshold decryption — inputs stay sealed forever

**Example:** Alice accepts $130K. Company pays up to $145K. Weight 50/50: _"Deal at $137,500."_ Weight 60/40: _"Deal at $140,000."_ Nobody knows either number.

### Programmable Settlement

| Mode                 | Weight | Settlement              |
| -------------------- | ------ | ----------------------- |
| **Equal midpoint**   | 50/50  | `(A + B) / 2`           |
| **Buyer-preferred**  | 40/60  | Weighted toward Party B |
| **Seller-preferred** | 60/40  | Weighted toward Party A |
| **Custom**           | 0-100  | Set at room creation    |

### AI Agents Turn Any Negotiation Into Math

The real power unlocks when AI agents act as negotiation proxies. An agent can:

- **Read any context** — job descriptions, deal memos, diplomatic communiques, market data
- **Reason about it** — using Claude to analyze leverage, alternatives, and precedents
- **Derive a reservation price** — converting qualitative context into a single number
- **Encrypt and submit autonomously** — the human never types a number

**Any negotiation described in words becomes encrypted arithmetic:**

| Scenario                   | What the AI agent computes                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Salary**                 | Candidate agent reads job desc + market data -> encrypted floor. Company agent reads budget -> encrypted ceiling.   |
| **M&A**                    | Buyer agent analyzes financials -> encrypted max offer. Seller agent assesses alternatives -> encrypted min accept. |
| **Real estate**            | Buyer agent studies comps -> encrypted bid. Seller agent factors costs -> encrypted floor.                          |
| **Geopolitical ceasefire** | Each side's agent analyzes military position, economic costs, domestic pressure -> encrypted acceptable terms.      |

Consider US-Iran tensions: neither side can publicly state acceptable concessions without appearing weak. AI agents analyze each side's strategic position — sanctions, military costs, domestic pressure — derive encrypted terms, and submit. If ranges overlap, a framework emerges. If not, neither side learns the gap. **No diplomat reveals a position. The math finds the deal.**

## The problem it solves

Whoever reveals their number first gets exploited — an 80-year-old game theory problem.

| Alternative             | Why it fails                                              |
| ----------------------- | --------------------------------------------------------- |
| **Trusted third party** | Can leak or be compromised                                |
| **Commit-reveal**       | Reveal phase exposes your number                          |
| **ZK proofs**           | Cannot compute on ciphertexts — no `FHE.add()` equivalent |

**FHE is the only primitive where both values stay encrypted during computation and only the result is revealed.** This product cannot exist without FHE.

## Privacy Boundary

| Data                               | Visibility                                          |
| ---------------------------------- | --------------------------------------------------- |
| Party reservation prices           | **Hidden** — encrypted client-side, never decrypted |
| ZOPA existence (before publish)    | **Hidden**                                          |
| Final settlement result            | **Revealed** — after threshold decryption           |
| Room metadata / addresses / timing | **Public**                                          |

## Challenges I ran into

**`euint256` doesn't exist** — redesigned around `euint64`. **ACL is unforgiving** — forgetting `FHE.allowThis()` bricks the contract. **CoFHE SDK SSR** — Next.js WASM issues solved with dynamic imports. **Testing** — `mock_expectPlaintext` is the only way to verify encrypted outputs.

## Technologies I used

**FHE:** `InEuint64`, `euint64`, `ebool`, `FHE.lte()`, `FHE.mul()`, `FHE.add()`, `FHE.div()`, `FHE.select()`, `FHE.allowPublic()`, `FHE.publishDecryptResult()`
**SDK:** `@cofhe/sdk` + `@cofhe/react` — `Encryptable.uint64()`, CofheProvider
**Stack:** Solidity 0.8.25, Hardhat, Next.js 14, wagmi v2, RainbowKit — 19 TDD tests
**Deployed:** [Arbitrum Sepolia (Wave 2)](https://sepolia.arbiscan.io/address/0xE387f4FDa884FCc976F3f27853E34FdB895E9fBE)

## How we built it

Strict TDD — 19 tests written first, all using real CoFHE SDK encrypted inputs. Frontend encrypts client-side with CoFHE SDK. Deployed to Arbitrum Sepolia.

## What we learned

**FHE hides _what_, not just _who_.** Most blockchain privacy hides identities. FHE computes on data no one can see.

**Encrypted inputs matter as much as encrypted compute.** FHE operations mean nothing if plaintext is in calldata. `InEuint64` makes the entire pipeline private.

**Six FHE operations power the mechanism:** `lte`, `mul`, `add`, `div`, `select`, `allowPublic`.

## What's next

**Wave 2:** AI agents read negotiation context, derive prices, encrypt and submit autonomously.
**Wave 3:** N-party ZOPA + encrypted reputation.
**Wave 4:** Privara settlement + developer SDK.
**Wave 5:** NY Tech Week live demo — AI agents negotiate on-screen.

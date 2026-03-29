<p align="center">
  <strong>BATNA PROTOCOL</strong><br/>
  <em>Encrypted Negotiation Engine on Fhenix CoFHE</em>
</p>

<p align="center">
  <a href="#how-it-works">How It Works</a> &nbsp;|&nbsp;
  <a href="#why-fhe">Why FHE</a> &nbsp;|&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;|&nbsp;
  <a href="#quick-start">Quick Start</a> &nbsp;|&nbsp;
  <a href="#tests">Tests</a> &nbsp;|&nbsp;
  <a href="#roadmap">Roadmap</a>
</p>

---

<p align="center">
  <img src="images/batna-home-page.png" alt="BATNA Protocol — Encrypted Negotiation UI" width="800"/>
</p>

> **The first negotiation where revealing your minimum first is no longer a disadvantage.**

Alice would accept **$130K**. The company would pay up to **$145K**. Neither knows the other's number.

The contract reveals: **_"Deal found at $137,500."_**

Nobody learns either party's actual reservation price. Not the blockchain. Not a server. Not even the other party.

---

## How It Works

```
   Party A (Floor)              Party B (Ceiling)
        |                             |
   encrypt($130K)               encrypt($145K)
        |                             |
        +──────── on-chain ───────────+
                    |
            NegotiationRoom.sol
                    |
         FHE.lte(encMinA, encMaxB)     ← ZOPA check on ciphertexts
         FHE.add(encMinA, encMaxB)     ← encrypted sum
         FHE.div(encSum, enc(2))       ← encrypted midpoint
         FHE.select(zopa, mid, zero)   ← conditional routing
                    |
              ┌─────┴─────┐
          ZOPA exists    No ZOPA
              |              |
       "Deal at $137.5K"   "No Deal"
       (midpoint only)   (nothing revealed)
```

Both reservation prices stay encrypted throughout. The contract computes the result on ciphertexts. Only the outcome is revealed.

## Why FHE

This is the core question: _would this work without FHE?_

**No.** Every alternative breaks:

| Approach            | Failure Mode                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| Trusted third party | Can leak, manipulate, or be compromised                                             |
| Commit-reveal       | Reveal phase exposes your number before counterparty commits                        |
| ZK proofs           | Can prove a number is in a range, but **cannot compute `(A+B)/2` on hidden values** |

FHE is the only cryptographic primitive where:

- Both values stay **encrypted** during comparison
- Arithmetic runs **on ciphertexts** (`add`, `div`, `lte`, `select`)
- Only the **result** is revealed via threshold decryption

This is not privacy bolted onto an existing product. This is a product that **cannot exist** without FHE.

### Encrypted State Flow

```mermaid
flowchart LR
    A["Party A\n(encrypt floor)"] -->|euint64| C["NegotiationRoom.sol"]
    B["Party B\n(encrypt ceiling)"] -->|euint64| C
    C -->|"FHE.lte()"| D{"ZOPA\nexists?"}
    D -->|Yes| E["FHE.add() + FHE.div()\n= encrypted midpoint"]
    D -->|No| F["FHE.select() → 0"]
    E --> G["FHE.allowPublic()"]
    F --> G
    G -->|"Threshold\nDecryption"| H["Result revealed\n(midpoint or 'No Deal')"]

    style A fill:#1a1a22,stroke:#c9a227,color:#e8e6e3
    style B fill:#1a1a22,stroke:#c9a227,color:#e8e6e3
    style C fill:#1a1a22,stroke:#c9a227,color:#c9a227
    style D fill:#1a1a22,stroke:#c9a227,color:#e8e6e3
    style E fill:#1a1a22,stroke:#2ecc71,color:#2ecc71
    style F fill:#1a1a22,stroke:#e74c3c,color:#e74c3c
    style G fill:#1a1a22,stroke:#c9a227,color:#e8e6e3
    style H fill:#1a1a22,stroke:#c9a227,color:#c9a227
```

> **Every box above operates on ciphertexts.** Plaintext only appears at the final output — and only the result, never the inputs.

### Privacy Boundary — What Leaks, What Doesn't

| Data                            | Visibility   | Notes                                                                       |
| ------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Party reservation prices        | **Hidden**   | Encrypted client-side via CoFHE SDK; never decrypted individually on-chain  |
| ZOPA existence (before publish) | **Hidden**   | Encrypted `ebool`; revealed only via threshold decryption after both submit |
| Final settlement result         | **Revealed** | Only after both parties submit + threshold network decrypts                 |
| Room metadata / context         | **Public**   | Stored as plaintext string on-chain                                         |
| Participant addresses           | **Public**   | On-chain, visible in contract state                                         |
| Submission timing               | **Public**   | Transaction timestamps visible on-chain                                     |
| Number of rooms / negotiations  | **Public**   | Factory tracks all rooms publicly                                           |
| Settlement weight               | **Public**   | Set at room creation, visible in contract state                             |

> **Design principle:** Individual reservation prices _never_ become decryptable — only the computed result does. Even the contract itself cannot read Party A's floor or Party B's ceiling.

### Side-Channel Resistance

The `_resolve()` function executes an **identical code path** regardless of whether a deal exists:

```solidity
// No if/else branching — FHE.select() computes both paths, picks one
encResult = FHE.select(zopaExists, encMidpoint, zeroValue);
```

Gas usage and execution trace are the same for deal/no-deal outcomes. An observer watching gas costs or execution metadata learns nothing about whether the negotiation succeeded.

### Confidential Auditability

Rooms can optionally designate an **auditor** address at creation. The auditor can decrypt the settlement result via `FHE.allow()`, but **never** the individual reservation prices:

```solidity
// Auditor sees: "Deal at $137,500" or "No Deal"
// Auditor CANNOT see: Party A's $130K floor or Party B's $145K ceiling
FHE.allow(encResult, auditor);
```

This enables institutional compliance — proving a negotiation was fair without revealing positions to the public.

## The Vision: AI Agents + FHE

Every negotiation — salary, M&A, real estate, even geopolitical ceasefires — reduces to the same math: _do two hidden ranges overlap?_

With AI agents, **any negotiation described in words becomes encrypted arithmetic:**

| Scenario         | What the AI Agent Does                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| **Salary**       | Reads job description + market data → encrypted floor/ceiling               |
| **M&A**          | Analyzes financials → encrypted max offer / min accept                      |
| **Real estate**  | Studies comps → encrypted bid / floor                                       |
| **Geopolitical** | Analyzes strategic position, sanctions, domestic pressure → encrypted terms |

> Consider US-Iran tensions: neither side can state acceptable concessions without appearing weak. AI agents derive encrypted terms from each side's strategic position. If ranges overlap, a framework emerges. If not, neither side learns the gap.
>
> **No diplomat reveals a position. The math finds the deal.**

## Architecture

```
batna/
├── contracts/
│   ├── NegotiationRoom.sol       ← Core: FHE ZOPA detection + midpoint
│   └── NegotiationFactory.sol    ← Factory: permissionless room deployment
├── test/
│   ├── NegotiationRoom.test.ts   ← 14 tests (access, ZOPA, weighted midpoint, publishResults)
│   └── NegotiationFactory.test.ts← 5 tests (creation, tracking, lookup)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── NegotiationUI.tsx  ← CoFHE SDK encryption → Sealed → Deal/NoDeal
│       │   ├── CofheWrapper.tsx   ← CoFHE SDK provider (dynamic import for SSR)
│       │   ├── RoomCreator.tsx    ← Create new negotiation rooms
│       │   └── Header.tsx         ← Wallet connection
│       └── config/
│           ├── contracts.ts       ← ABIs + addresses
│           └── wagmi.ts           ← Chain config
├── ignition/modules/              ← Hardhat Ignition deployment
├── tasks/deploy.ts                ← CLI tasks: deploy-factory, create-room
└── hardhat.config.ts              ← Solidity 0.8.25, Arbitrum Sepolia
```

### Core Contract: NegotiationRoom.sol

```solidity
// Client submits encrypted input — plaintext never touches calldata
function submitReservation(InEuint64 calldata encryptedAmount) external {
    encMinA = FHE.asEuint64(encryptedAmount);
}

// ZOPA detection — entirely on ciphertexts
ebool zopaExists = FHE.lte(encMinA, encMaxB);

// Weighted settlement — (minA * weightA + maxB * weightB) / 100
euint64 settlement = FHE.div(
    FHE.add(FHE.mul(encMinA, encWeightA), FHE.mul(encMaxB, encWeightB)),
    FHE.asEuint64(100)
);

// Conditional result — no branching, no information leak
encResult = FHE.select(zopaExists, settlement, FHE.asEuint64(0));

// Only results become decryptable — individual prices never do
FHE.allowPublic(encResult);
```

### Key FHE Patterns Used

| Operation                    | Purpose                           | Why It Matters                                     |
| ---------------------------- | --------------------------------- | -------------------------------------------------- |
| `InEuint64`                  | Client-encrypted input type       | Plaintext never touches calldata or contract state |
| `FHE.lte()`                  | Compare two encrypted values      | ZOPA check without decrypting either               |
| `FHE.mul()`                  | Multiply encrypted values         | Weighted settlement on ciphertexts                 |
| `FHE.add()`                  | Sum encrypted values              | Weighted sum on ciphertexts                        |
| `FHE.div()`                  | Divide encrypted values           | Settlement calculation                             |
| `FHE.select()`               | Encrypted ternary                 | No `if/else` branching = no information leak       |
| `FHE.allowThis()`            | Contract self-access              | Called after EVERY mutation — #1 FHE pitfall       |
| `FHE.allowPublic()`          | Enable threshold decryption       | Only on final results, never on inputs             |
| `FHE.publishDecryptResult()` | Verify + publish decrypted result | Threshold signature verification on-chain          |

## Quick Start

### Prerequisites

- Node.js v20+
- pnpm

### Install & Test

```bash
git clone <repo-url> batna-protocol
cd batna-protocol

# Install dependencies
pnpm install

# Run all 19 tests
pnpm test

# Compile contracts
pnpm compile
```

### Deployed Contracts (Arbitrum Sepolia)

| Contract               | Address                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **NegotiationFactory** | [`0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE`](https://sepolia.arbiscan.io/address/0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE) |
| Deployer               | `0x48D185bc646534597E25199dd4d73692ebD98BAc`                                                                                   |

### Deploy to Arbitrum Sepolia

```bash
# Set up environment
cp .env.example .env
# Add your PRIVATE_KEY and ARBITRUM_SEPOLIA_RPC_URL

# Deploy factory
npx hardhat deploy-factory --network arb-sepolia

# Create a negotiation room
npx hardhat create-room \
  --factory 0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE \
  --partyb <COUNTERPARTY_ADDRESS> \
  --context "Salary negotiation: Senior Engineer" \
  --weight 50 \
  --network arb-sepolia
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

## Tests

**19 tests, strict TDD** — every test written before its implementation. Tests use real CoFHE SDK encrypted inputs via `Encryptable.uint64()`.

```
  NegotiationFactory
    ✔ creates a room and tracks it
    ✔ emits RoomCreated event with correct args
    ✔ created room has correct parties and context
    ✔ can create multiple rooms
    ✔ tracks rooms by party

  NegotiationRoom
    ✔ rejects submission from non-party address
    ✔ prevents double submission from party A
    ✔ prevents double submission from party B
    ✔ accepts encrypted submission from party A
    ✔ auto-resolves when both parties submit
    ✔ computes correct midpoint when ZOPA exists (minA <= maxB)
    ✔ returns zero when no ZOPA (minA > maxB)
    ✔ emits PartySubmitted event on each submission
    ✔ rejects submission after resolution
    ✔ computes weighted settlement when weightA != 50
    ✔ equal weight (50) produces standard midpoint
    ✔ cannot call publishResults before resolution
    ✔ getEncryptedResult reverts before resolution
    ✔ getEncryptedZopa reverts before resolution

  19 passing
```

## Tech Stack

| Layer          | Technology                                                            |
| -------------- | --------------------------------------------------------------------- |
| FHE Contracts  | Fhenix CoFHE — `@fhenixprotocol/cofhe-contracts` (InEuint64, FHE.sol) |
| FHE Client SDK | `@cofhe/sdk` + `@cofhe/react` — client-side encryption + React hooks  |
| Contracts      | Solidity 0.8.25                                                       |
| Testing        | Hardhat + `@cofhe/hardhat-plugin` + Mocha/Chai (19 tests)             |
| Frontend       | Next.js 14 + Tailwind CSS                                             |
| Web3           | wagmi v2 + viem + RainbowKit                                          |
| Chain          | Arbitrum Sepolia                                                      |
| Deployment     | Hardhat Ignition                                                      |

## Roadmap

| Wave  | Dates        | Deliverable                                                                           |
| ----- | ------------ | ------------------------------------------------------------------------------------- |
| **1** | Mar 21–31    | Encrypted ZOPA + weighted settlement + 19 tests + CoFHE SDK frontend + deploy scripts |
| **2** | Mar 30–Apr 8 | AI Agent Layer — Claude agents convert any context into encrypted arithmetic          |
| **3** | Apr 8–May 8  | Multi-party ZOPA + encrypted reputation + market oracle                               |
| **4** | May 11–23    | Privara SDK settlement + developer SDK                                                |
| **5** | May 23–Jun 5 | NY Tech Week live demo — AI agents negotiate on-screen                                |

## License

MIT

---

<p align="center">
  <strong>Built on Fhenix CoFHE | Arbitrum Sepolia</strong><br/>
  <em>Fhenix Privacy-by-Design Buildathon</em>
</p>

<p align="center">
  <strong>BATNA PROTOCOL</strong><br/>
  <em>Zero-Knowledge Negotiation Engine on Fhenix CoFHE</em>
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

> **The first negotiation where revealing your minimum first is no longer a disadvantage.**

Alice would accept **$130K**. The company would pay up to **$145K**. Neither knows the other's number.

The contract reveals: ***"Deal found at $137,500."***

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

This is the core question: *would this work without FHE?*

**No.** Every alternative breaks:

| Approach | Failure Mode |
|---|---|
| Trusted third party | Can leak, manipulate, or be compromised |
| Commit-reveal | Reveal phase exposes your number before counterparty commits |
| ZK proofs | Can prove a number is in a range, but **cannot compute `(A+B)/2` on hidden values** |

FHE is the only cryptographic primitive where:
- Both values stay **encrypted** during comparison
- Arithmetic runs **on ciphertexts** (`add`, `div`, `lte`, `select`)
- Only the **result** is revealed via threshold decryption

This is not privacy bolted onto an existing product. This is a product that **cannot exist** without FHE.

## The Vision: AI Agents + FHE

Every negotiation — salary, M&A, real estate, even geopolitical ceasefires — reduces to the same math: *do two hidden ranges overlap?*

With AI agents, **any negotiation described in words becomes encrypted arithmetic:**

| Scenario | What the AI Agent Does |
|---|---|
| **Salary** | Reads job description + market data → encrypted floor/ceiling |
| **M&A** | Analyzes financials → encrypted max offer / min accept |
| **Real estate** | Studies comps → encrypted bid / floor |
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
│   ├── NegotiationRoom.test.ts   ← 9 tests (access, ZOPA, midpoint, events)
│   └── NegotiationFactory.test.ts← 5 tests (creation, tracking, lookup)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── NegotiationUI.tsx  ← Submit → Sealed → Deal/NoDeal states
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
// ZOPA detection — entirely on ciphertexts
ebool zopaExists = FHE.lte(encMinA, encMaxB);

// Midpoint — encrypted arithmetic
euint64 encMidpoint = FHE.div(FHE.add(encMinA, encMaxB), FHE.asEuint64(2));

// Conditional result — no branching, no information leak
encResult = FHE.select(zopaExists, encMidpoint, FHE.asEuint64(0));

// Only results become decryptable — individual prices never do
FHE.allowPublic(encResult);
```

### Key FHE Patterns Used

| Operation | Purpose | Why It Matters |
|---|---|---|
| `FHE.lte()` | Compare two encrypted values | ZOPA check without decrypting either |
| `FHE.add()` | Sum encrypted values | Midpoint numerator on ciphertexts |
| `FHE.div()` | Divide encrypted values | Midpoint calculation |
| `FHE.select()` | Encrypted ternary | No `if/else` branching = no information leak |
| `FHE.allowThis()` | Contract self-access | Called after EVERY mutation — #1 FHE pitfall |
| `FHE.allowPublic()` | Enable threshold decryption | Only on final results, never on inputs |

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

# Run all 14 tests
pnpm test

# Compile contracts
pnpm compile
```

### Deploy to Arbitrum Sepolia

```bash
# Set up environment
cp .env.example .env
# Add your PRIVATE_KEY and ARBITRUM_SEPOLIA_RPC_URL

# Deploy factory
npx hardhat deploy-factory --network arb-sepolia

# Create a negotiation room
npx hardhat create-room \
  --factory <FACTORY_ADDRESS> \
  --partyb <COUNTERPARTY_ADDRESS> \
  --context "Salary negotiation: Senior Engineer" \
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

**14 tests, strict TDD** — every test written before its implementation.

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

  14 passing
```

## Tech Stack

| Layer | Technology |
|---|---|
| FHE | Fhenix CoFHE — `@fhenixprotocol/cofhe-contracts` |
| Contracts | Solidity 0.8.25 |
| Testing | Hardhat + `@cofhe/hardhat-plugin` + Mocha/Chai |
| Frontend | Next.js 14 + Tailwind CSS |
| Web3 | wagmi v2 + viem + RainbowKit |
| Chain | Arbitrum Sepolia |
| Deployment | Hardhat Ignition |

## Roadmap

| Wave | Dates | Deliverable |
|---|---|---|
| **1** | Mar 21–31 | Core FHE ZOPA mechanism + 14 tests + frontend + deploy scripts |
| **2** | Mar 30–Apr 8 | AI Agent Layer — Claude agents convert any context into encrypted arithmetic |
| **3** | Apr 8–May 8 | Multi-party ZOPA + encrypted reputation + market oracle |
| **4** | May 11–23 | Privara SDK settlement + developer SDK |
| **5** | May 23–Jun 5 | NY Tech Week live demo — AI agents negotiate on-screen |

## License

MIT

---

<p align="center">
  <strong>Built on Fhenix CoFHE | Arbitrum Sepolia</strong><br/>
  <em>Fhenix Privacy-by-Design Buildathon</em>
</p>

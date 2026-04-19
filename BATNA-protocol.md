# BATNA Protocol — Claude Code Context Document

## Zero-Knowledge Negotiation Engine on Fhenix CoFHE

> **Use this file as context when starting Claude Code sessions.**
> It contains everything needed: project overview, buildathon rules, contract specs, wave plans, judging criteria, and implementation notes.

---

## Quick Reference

| Item                    | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Project name**        | BATNA Protocol                                                                       |
| **Tagline**             | The first negotiation where revealing your minimum first is no longer a disadvantage |
| **Hackathon**           | Fhenix Privacy-by-Design Buildathon on AKINDO                                        |
| **Platform**            | https://app.akindo.io/wave-hacks/Nm2qjzEBgCqJD90W                                    |
| **Chain**               | Arbitrum Sepolia (testnet) → Arbitrum One (mainnet target)                           |
| **Grant pool**          | $50,000 USDC total across 5 waves                                                    |
| **Wave 1 deadline**     | March 31, 2026 01:53 UTC                                                             |
| **Wave 1 pool**         | $3,000 USDC                                                                          |
| **FHE stack**           | Fhenix CoFHE — `@fhenixprotocol/cofhe-contracts`                                     |
| **Starter repo**        | https://github.com/FhenixProtocol/cofhe-hardhat-starter                              |
| **Fhenix docs**         | https://cofhe-docs.fhenix.zone                                                       |
| **Fhenix examples**     | https://github.com/FhenixProtocol/awesome-fhenix                                     |
| **Buildathon Telegram** | https://t.me/+rA9gI3AsW8c3YzIx                                                       |

---

## The Core Insight

Every negotiation in history has the same fatal flaw: **whoever reveals their reservation price first gets exploited.** This is not a new problem — it has been the central challenge of game theory for 80 years. Economists call the overlap between two parties' acceptable ranges the **Zone of Possible Agreement (ZOPA)**.

BATNA stands for **Best Alternative To a Negotiated Agreement** — your secret minimum. The person who reveals their BATNA first walks away with exactly that minimum. The other party extracts all remaining value.

**FHE is the first technology that can find whether a ZOPA exists without either party revealing their reservation price.**

- If ZOPA exists → reveal only the midpoint (fair split)
- If ZOPA does not exist → reveal only "no deal" — neither party learns how far apart they were

This works for:

- Salary negotiations (you'd accept $130K, they'd pay $145K)
- M&A acquisition pricing (buyer max vs seller minimum)
- VC term sheets (valuation range overlap)
- Real estate offers (buyer ceiling vs seller floor)
- Geopolitical back-channels (US-Iran nuclear discussions — neither side can signal flexibility without appearing weak publicly)
- Any bilateral deal with hidden reservation prices

**No prior FHE implementation of this exists anywhere.**

---

## Why FHE Is Necessary (Not Bolted On)

This is the key judging criterion. The question every judge will ask: _"Would this work without FHE?"_

**Answer: No. The mechanism fails without FHE.**

Without FHE, you face a choice:

1. Submit reservation prices to a trusted third party → centralization, trust required, TTP can leak or manipulate
2. Use commit-reveal scheme → the reveal phase exposes your number before the other party commits, enabling exploitation
3. Use ZK proofs → can prove a number is in a range but cannot compute the midpoint on encrypted values

FHE is the only cryptographic primitive that enables:

- Both values to remain encrypted during comparison
- The comparison itself (`TFHE.lte`) to run on ciphertexts
- The midpoint calculation (`TFHE.add` + `TFHE.div`) to run on ciphertexts
- Only the result (deal/no-deal + midpoint) to be revealed via threshold network

This is FHE solving a problem that no other technology can solve. That is what "privacy necessary not bolted on" means.

---

## Buildathon Context — Critical Information

### What Judges Are Looking For (from kickoff video)

1. **Privacy must be necessary, not bolted on** — FHE should be required for the product to function, not just a feature
2. **Avoid "vibecoding"** — AI-assisted code is fine but logic must be technically sound; broken FHE access control will be caught
3. **Focus on UX** — privacy should not introduce "clunkiness"; use AI to build clean frontends
4. **Engage the team** — use Telegram and office hours; judges reward builders who interact
5. **Agentic workflows** — Lauren named this first; AI agent integration scores well
6. **Real use cases** — institutional finance, compliance, RWA, agentic coordination

### Judging Criteria (weighted)

| Criterion                | Weight | What BATNA scores                               |
| ------------------------ | ------ | ----------------------------------------------- |
| Privacy Architecture     | High   | ★★★★★ — TFHE comparison is the mechanism itself |
| Innovation & Originality | High   | ★★★★★ — no prior FHE implementation exists      |
| User Experience          | Medium | ★★★★☆ — simple UI, two inputs, one output       |
| Technical Execution      | Medium | ★★★★☆ — clean contracts, mock tests passing     |
| Market Potential         | Medium | ★★★★★ — every negotiation ever is the TAM       |

### Wave Structure and Evaluation Rhythm

Each wave has a **building period** followed by an **evaluation period**. Judges evaluate **progress since the last wave**, not absolute completeness. This means:

- Wave 1 baseline matters — ship something real, not slides
- Each subsequent wave must show meaningful new capability
- Consistent iteration is rewarded over one big Wave 5 dump

**Important:** Submit your product page on AKINDO as early as possible. Judges can see submission history and engagement in comments.

### WaveHack Rules That Help BATNA

- You can submit an **update of an existing product** — no need to build from scratch each wave
- Grant distribution is automated on-chain after evaluation
- 10% protocol fee deducted from distributed grants
- Top performers get invited to **NY Tech Week demo day** and **AKINDO Deal Room** for VC introductions

---

## Wave 1 — Ideation (March 21–31)

### Goal: Prove the core FHE mechanism works. Ship contracts on Arbitrum Sepolia.

### What to Build

**`NegotiationRoom.sol`** — core contract

```solidity
// SPDX-License-Identifier: MIT
// BATNA Protocol — Zero-Knowledge Negotiation Engine
// Wave 1: Core ZOPA detection + encrypted midpoint calculation
pragma solidity >=0.8.19 <0.9.0;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract NegotiationRoom {

    // ── State ──────────────────────────────────────────────────
    address public partyA;
    address public partyB;
    string  public context;         // "Salary negotiation: Senior Engineer role"
    bool    public aSubmitted;
    bool    public bSubmitted;
    bool    public resolved;

    // Encrypted reservation prices
    // partyA submits their MINIMUM acceptable value
    // partyB submits their MAXIMUM acceptable value
    euint256 private encMinA;       // A's floor — stays sealed forever
    euint256 private encMaxB;       // B's ceiling — stays sealed forever

    // Results (revealed after both submit)
    bool    public dealExists;      // public: yes deal / no deal
    uint256 public revealedSplit;   // public: only if dealExists = true

    // Events
    event PartySubmitted(address indexed party);
    event DealFound(uint256 splitPoint);
    event NoDeal();

    // ── Constructor ────────────────────────────────────────────
    constructor(
        address _partyA,
        address _partyB,
        string memory _context
    ) {
        partyA  = _partyA;
        partyB  = _partyB;
        context = _context;
    }

    // ── Submit reservation price ───────────────────────────────
    // Party A calls with their minimum acceptable value
    // Party B calls with their maximum acceptable value
    // Amount is trivially encrypted — never stored in plaintext
    function submitReservation(uint256 amount) external {
        require(!resolved, "Already resolved");
        require(
            msg.sender == partyA || msg.sender == partyB,
            "Not a party"
        );
        require(
            !(msg.sender == partyA && aSubmitted),
            "A already submitted"
        );
        require(
            !(msg.sender == partyB && bSubmitted),
            "B already submitted"
        );

        euint256 encAmount = FHE.asEuint256(amount);

        if (msg.sender == partyA) {
            encMinA    = encAmount;
            aSubmitted = true;
            // Only partyA and this contract can access encMinA
            FHE.allowThis(encMinA);
            FHE.allow(encMinA, partyA);
        } else {
            encMaxB    = encAmount;
            bSubmitted = true;
            // Only partyB and this contract can access encMaxB
            FHE.allowThis(encMaxB);
            FHE.allow(encMaxB, partyB);
        }

        emit PartySubmitted(msg.sender);

        // Auto-resolve once both submitted
        if (aSubmitted && bSubmitted) {
            _resolve();
        }
    }

    // ── Core FHE logic: find ZOPA, compute midpoint ────────────
    function _resolve() internal {
        // ZOPA check: does A's minimum <= B's maximum?
        // i.e. is there an overlap where a deal is possible?
        ebool zopaExists = FHE.lte(encMinA, encMaxB);

        // Compute midpoint = (minA + maxB) / 2
        // This runs on ciphertexts — neither value decrypts
        euint256 encSum      = FHE.add(encMinA, encMaxB);
        euint256 encMidpoint = FHE.div(encSum, 2);

        // If ZOPA exists: reveal midpoint
        // If no ZOPA: reveal nothing meaningful (zero)
        euint256 encResult = FHE.select(
            zopaExists,
            encMidpoint,
            FHE.asEuint256(0)   // no deal → reveal nothing
        );

        // Allow threshold network to decrypt the result
        FHE.allowPublic(zopaExists);
        FHE.allowPublic(encResult);

        resolved = true;
        // dealExists and revealedSplit set via publishResults()
        // after Kofi SDK decrypts off-chain
    }

    // ── Publish results on-chain with threshold proof ──────────
    // Called after Kofi SDK runs decryptForTx off-chain
    function publishResults(
        ebool   zopaCtHash,
        bool    zopaBool,
        bytes calldata zopaSignature,
        euint256 resultCtHash,
        uint256  resultPlaintext,
        bytes calldata resultSignature
    ) external {
        require(resolved, "Not resolved yet");

        FHE.publishDecryptResult(zopaCtHash,   zopaBool,       zopaSignature);
        FHE.publishDecryptResult(resultCtHash, resultPlaintext, resultSignature);

        dealExists    = zopaBool;
        revealedSplit = resultPlaintext;

        if (zopaBool) {
            emit DealFound(resultPlaintext);
        } else {
            emit NoDeal();
        }
    }
}
```

**`NegotiationFactory.sol`** — deploy rooms permissionlessly

```solidity
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "./NegotiationRoom.sol";

contract NegotiationFactory {
    address[] public rooms;

    event RoomCreated(
        address indexed room,
        address indexed partyA,
        address indexed partyB,
        string context
    );

    function createRoom(
        address partyB,
        string calldata context
    ) external returns (address) {
        NegotiationRoom room = new NegotiationRoom(
            msg.sender,
            partyB,
            context
        );
        rooms.push(address(room));
        emit RoomCreated(address(room), msg.sender, partyB, context);
        return address(room);
    }

    function getRooms() external view returns (address[] memory) {
        return rooms;
    }
}
```

### Mock Tests (5 required)

```typescript
// test/NegotiationRoom.test.ts
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { mock_expectPlaintext } from "@cofhe/hardhat-cofhe/utils";
import { expect } from "chai";
import hre from "hardhat";

async function deployFixture() {
  const [owner, alice, bob] = await hre.ethers.getSigners();
  await hre.cofhe.createClientWithBatteries(owner);

  const Room = await hre.ethers.getContractFactory("NegotiationRoom");
  const room = await Room.deploy(
    alice.address,
    bob.address,
    "Salary negotiation: Senior Engineer",
  );
  return { room, alice, bob };
}

describe("NegotiationRoom", () => {
  it("accepts encrypted submissions from both parties", async () => {
    const { room, alice, bob } = await loadFixture(deployFixture);
    await room.connect(alice).submitReservation(130000); // Alice min: $130K
    await room.connect(bob).submitReservation(145000); // Bob max: $145K
    expect(await room.aSubmitted()).to.be.true;
    expect(await room.bSubmitted()).to.be.true;
  });

  it("finds deal when ZOPA exists (minA <= maxB)", async () => {
    const { room, alice, bob } = await loadFixture(deployFixture);
    await room.connect(alice).submitReservation(130000);
    await room.connect(bob).submitReservation(145000);
    expect(await room.resolved()).to.be.true;
    // dealExists set after publishResults — mock: zopaExists = true
  });

  it("finds no deal when ZOPA does not exist (minA > maxB)", async () => {
    const { room, alice, bob } = await loadFixture(deployFixture);
    await room.connect(alice).submitReservation(160000); // Alice wants $160K min
    await room.connect(bob).submitReservation(140000); // Bob max only $140K
    expect(await room.resolved()).to.be.true;
    // dealExists = false, revealedSplit = 0
  });

  it("prevents double submission from same party", async () => {
    const { room, alice } = await loadFixture(deployFixture);
    await room.connect(alice).submitReservation(130000);
    await expect(
      room.connect(alice).submitReservation(120000),
    ).to.be.revertedWith("A already submitted");
  });

  it("rejects submission from non-party address", async () => {
    const { room } = await loadFixture(deployFixture);
    const [, , , stranger] = await hre.ethers.getSigners();
    await expect(
      room.connect(stranger).submitReservation(100000),
    ).to.be.revertedWith("Not a party");
  });
});
```

### React Frontend — Key Components

```tsx
// src/components/NegotiationUI.tsx
// Core UI: enter your minimum → submit sealed → see result

import { useState } from "react";
import { useWrite } from "@cofhe/react";
import { useReadContract, useAccount } from "wagmi";

export function NegotiationUI({ roomAddress }: { roomAddress: string }) {
  const { address } = useAccount();
  const [myMin, setMyMin] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { write, isPending } = useWrite({
    address: roomAddress,
    abi: NegotiationRoomABI,
    functionName: "submitReservation",
  });

  const { data: dealExists } = useReadContract({
    address: roomAddress,
    abi: NegotiationRoomABI,
    functionName: "dealExists",
  });
  const { data: revealedSplit } = useReadContract({
    address: roomAddress,
    abi: NegotiationRoomABI,
    functionName: "revealedSplit",
  });
  const { data: resolved } = useReadContract({
    address: roomAddress,
    abi: NegotiationRoomABI,
    functionName: "resolved",
  });

  if (submitted && !resolved)
    return (
      <div className="status-card">
        <span className="lock-icon">🔒</span>
        <p>Your reservation price is sealed.</p>
        <p className="muted">Waiting for counterparty...</p>
      </div>
    );

  if (resolved && dealExists)
    return (
      <div className="result-card deal">
        <h2>Deal Found ✓</h2>
        <div className="split-amount">
          ${Number(revealedSplit).toLocaleString()}
        </div>
        <p className="muted">
          Fair split. Neither party's minimum was revealed.
        </p>
      </div>
    );

  if (resolved && !dealExists)
    return (
      <div className="result-card no-deal">
        <h2>No Deal</h2>
        <p className="muted">
          Ranges did not overlap. Neither party knows how far apart you were.
        </p>
      </div>
    );

  return (
    <div className="submission-form">
      <label>Your minimum acceptable value (stays sealed)</label>
      <input
        type="number"
        placeholder="e.g. 130000"
        value={myMin}
        onChange={(e) => setMyMin(e.target.value)}
      />
      <button
        onClick={async () => {
          await write([BigInt(myMin)]);
          setSubmitted(true);
        }}
        disabled={isPending || !myMin}
      >
        {isPending ? "Sealing..." : "Submit Sealed 🔒"}
      </button>
      <p className="disclaimer">
        Your number will never appear on any server in plaintext.
      </p>
    </div>
  );
}
```

### Wave 1 Day-by-Day Plan

| Day | Task                                                                | Deliverable               |
| --- | ------------------------------------------------------------------- | ------------------------- |
| 1   | Clone cofhe-hardhat-starter, run `pnpm test` on Counter.sol         | Green CI locally          |
| 2   | Write NegotiationRoom.sol skeleton (no FHE yet, plain Solidity)     | Compiles, deploys on mock |
| 3   | Add FHE: `euint256` inputs, `TFHE.lte()` ZOPA check, `FHE.select()` | Mock tests 1-2 passing    |
| 4   | Add `TFHE.add()` + `TFHE.div()` midpoint, `FHE.allowPublic()` flow  | Mock tests 3-5 passing    |
| 5   | Deploy to Arbitrum Sepolia, verify on Arbiscan                      | Live contract address     |
| 6   | NegotiationFactory.sol, deploy factory                              | Factory live on Arbiscan  |
| 7   | React frontend: submission form + result display                    | Vercel deployment         |
| 8   | Kofi SDK integration: `publishResults()` flow                       | Full happy path working   |
| 9   | Demo video (2 min Loom), README, architecture diagram               | GitHub public             |
| 10  | AKINDO submission + Telegram announcement                           | ✅ Wave 1 submitted       |

### Wave 1 AKINDO Submission Template

**Product name:** BATNA Protocol

**One-liner:** The first on-chain negotiation engine where revealing your minimum is no longer a disadvantage — FHE finds the deal zone without either party exposing their reservation price.

**Description:**

```
Every negotiation has the same fundamental flaw: whoever reveals their
minimum acceptable price first gets exploited. This is not a blockchain
problem — it is an 80-year-old game theory problem in salary talks,
M&A deals, and geopolitical back-channels.

BATNA Protocol (Best Alternative To a Negotiated Agreement) is the first
FHE implementation of zero-knowledge ZOPA detection.

How it works:
• Party A submits encrypted minimum via euint256 (floor price)
• Party B submits encrypted maximum via euint256 (ceiling price)
• TFHE.lte(encMinA, encMaxB) checks if a Zone of Possible Agreement exists
• If yes: TFHE.add() + TFHE.div() computes encrypted midpoint
• FHE.allowPublic() → Kofi SDK threshold decryption → result revealed
• If no ZOPA: only "no deal" revealed — neither party learns the gap

FHE primitives used:
• euint256 encrypted reservation prices
• TFHE.lte() for ZOPA detection on ciphertext
• TFHE.add() + TFHE.div() for homomorphic midpoint calculation
• FHE.select() for conditional result routing
• FHE.allowPublic() + publishDecryptResult() for threshold reveal

Wave 1 deliverables:
• NegotiationRoom.sol + NegotiationFactory.sol on Arbitrum Sepolia
• 5 mock tests passing
• React frontend with sealed submission + result reveal
• Live demo: salary negotiation, deal found at $137,500

This is the first cryptographic solution to a problem that has existed
in every negotiation since humans began trading.
```

**Tags:** `#FHE #PrivacyByDesign #Arbitrum #CoFHE #Solidity #EVM #Negotiation #AgenticAI`

---

## Wave 2 — Core Build (March 30 – April 8) · $5,000 pool

### What to Add

**AI Agent Layer** — the agentic integration that scores well with judges

Each party is represented by an AI agent that:

1. Reads context (email thread, job description, deal memo)
2. Reasons about a fair BATNA using Claude Sonnet
3. Encrypts and submits autonomously
4. Returns only the final outcome to the human

```python
# batna/agent.py — autonomous BATNA agent

from anthropic import Anthropic
from cofhe_sdk import CofheClient

class BATNAAgent:
    """
    AI agent that infers and submits your BATNA without
    revealing your position to any server or counterparty.
    """
    def __init__(self, room_address: str, role: str):
        self.llm    = Anthropic()
        self.cofhe  = CofheClient(network="arb-sepolia")
        self.room   = NegotiationRoomContract(room_address)
        self.role   = role  # "partyA" or "partyB"

    def infer_batna(self, context: str) -> int:
        """Use Claude to reason about reservation price from context."""
        prompt = f"""
        You are negotiating on behalf of your principal.
        Context: {context}
        Role: {self.role}

        Based on the context, what is the {'minimum you would accept' if self.role == 'partyA' else 'maximum you would offer'}?

        Consider: market rates, alternatives, principal's stated preferences.
        Reply with only a number (integer).
        """
        response = self.llm.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=20,
            messages=[{"role": "user", "content": prompt}]
        )
        return int(response.content[0].text.strip())

    def negotiate(self, context: str) -> dict:
        """Full autonomous negotiation flow."""
        batna = self.infer_batna(context)
        # Submit encrypted — BATNA never stored in plaintext anywhere
        tx = self.room.submitReservation(batna)
        return {
            "tx_hash": tx.hash,
            "message": "Reservation sealed. Waiting for counterparty.",
            "batna_revealed": False  # Never reveal to anyone
        }
```

**Multi-context support:**

- Salary negotiation template
- Real estate offer template
- VC term sheet template
- Generic bilateral deal template

### Wave 2 New Contracts

`NegotiationRoom.sol` extension:

- Deadline enforcement (`uint256 deadline` — auto-resolve at expiry)
- Room metadata (negotiation type enum)
- Event log for agent submissions

### What to Show in Wave 2 Demo

1. Enter a job description into the React UI
2. Agent A infers BATNA from description ("Senior Engineer, SF, 5yr exp → $130K floor")
3. Agent B infers from the hiring manager's perspective ("Budget cap → $145K ceiling")
4. Both submit encrypted autonomously
5. "Deal found at $137,500" — no human typed any number

---

## Wave 3 — Marathon (April 8 – May 8) · $12,000 pool

### What to Add

**Multi-party ZOPA** — three or more parties finding consensus range

Useful for:

- Board decisions with multiple stakeholders
- Multi-party trade deals
- DAO compensation proposals with multiple candidates

```solidity
// MultiPartyNegotiation.sol — N-party ZOPA detection
// Find the range where ALL parties agree, not just two

euint256 private encGlobalMin;  // highest minimum across all parties
euint256 private encGlobalMax;  // lowest maximum across all parties
// ZOPA = encGlobalMin <= encGlobalMax

function submitRange(uint256 min, uint256 max) external {
    euint256 encMin = FHE.asEuint256(min);
    euint256 encMax = FHE.asEuint256(max);

    // Update global min: take the max of all submitted minimums
    encGlobalMin = FHE.max(encGlobalMin, encMin);

    // Update global max: take the min of all submitted maximums
    encGlobalMax = FHE.min(encGlobalMax, encMax);

    FHE.allowThis(encGlobalMin);
    FHE.allowThis(encGlobalMax);
}
```

**Reputation System** — encrypted track record

```solidity
// NegotiationReputation.sol
// Agents accumulate reputation from successful negotiations
// without revealing deal terms

mapping(address => euint32) private dealCount;      // public: how many deals
mapping(address => euint64) private encTotalValue;  // private: aggregate value
mapping(address => euint8)  private encAvgFairness; // private: peer ratings
```

**Real-world templates with AI oracle:**

- Pulls real salary data from public APIs (Levels.fyi, Glassdoor public feeds)
- AI agent calibrates BATNA recommendations based on live market data
- Oracle submits market range as a third encrypted input

### Wave 3 Demo

HR director uses multi-party BATNA to negotiate compensation for 3 candidates simultaneously. All 3 candidates submit encrypted floors. Company submits encrypted budget ceiling per role. System finds who fits within budget without candidates knowing each other's expectations.

---

## Wave 4 — Polish (May 11 – May 23) · $14,000 pool

### What to Add

**Privara SDK Integration** — confidential payment settlement after deal

When BATNA finds a deal, payment can execute via Privara's compliant stablecoin rails:

```typescript
// After deal found at $137,500
// Party B pays Party A via Privara — amount matches revealed split
import { PrivaraClient } from "@reineira-os/sdk";

const privara = new PrivaraClient();
await privara.transfer({
  from: partyB,
  to: partyA,
  amount: revealedSplit, // the only plaintext that ever appears
  memo: "BATNA settlement",
});
```

**SDK Package** — `@batna-protocol/sdk`

```typescript
// 5-line integration for any negotiation platform
import { BATNARoom } from "@batna-protocol/sdk";

const room = await BATNARoom.create({ context: "Series A term sheet" });
await room.submitFloor(2_000_000); // your minimum valuation
const result = await room.waitForResult();
// { deal: true, amount: 3_500_000 } or { deal: false }
```

**Security hardening:**

- Exhaustive `f.allowList` audit — document every ciphertext and who can access it
- Gas cost benchmarks for all FHE operations on Arbitrum Sepolia
- Emergency pause mechanism

---

## Wave 5 — Final (May 23 – June 5) · $14,000 + $2,000 bonus

### What to Show at Demo Day (NY Tech Week)

**The live demo:**

1. Open the BATNA Protocol app on screen
2. "I'm going to simulate a salary negotiation live"
3. Type as Party A (candidate): submit sealed floor $130K
4. Type as Party B (company): submit sealed ceiling $145K
5. Contracts run on Arbitrum Sepolia in real-time
6. Screen shows: "Deal found at $137,500"
7. Ask the audience: "Does anyone know what either party's actual minimum was?" — nobody does
8. Open Arbiscan: "Here are the two transactions. Here are the encrypted inputs. This is what an 80-year-old negotiation problem looks like when it's finally solved."

**The pitch sentence:**

> _"Every salary negotiation, every M&A deal, every geopolitical back-channel has the same flaw — whoever reveals their position first loses. Humans have known this for 80 years and had no solution. BATNA Protocol is the solution. It runs on Fhenix. It's live right now."_

---

## Technical Setup

### Installation

```bash
git clone https://github.com/FhenixProtocol/cofhe-hardhat-starter.git batna-protocol
cd batna-protocol
pnpm install
pnpm test  # verify mock environment works
```

### Environment Variables

```bash
# .env
PRIVATE_KEY=your_private_key_here
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
SEPOLIA_RPC_URL=your_sepolia_rpc_url
```

### Key FHE Operations Reference

```solidity
// Import — single import for everything
import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// Encrypted types available
euint8   // 0-255
euint16  // 0-65535
euint32  // 0-4294967295
euint64  // large integers
euint256 // very large (use for monetary values with precision)
ebool    // encrypted boolean
eaddress // encrypted address

// Core operations
FHE.asEuint256(value)           // trivially encrypt a plaintext
FHE.add(a, b)                   // homomorphic addition
FHE.sub(a, b)                   // homomorphic subtraction
FHE.mul(a, b)                   // homomorphic multiplication
FHE.div(a, scalar)              // divide by plaintext scalar
FHE.lte(a, b) → ebool           // encrypted comparison <=
FHE.lt(a, b)  → ebool           // encrypted comparison <
FHE.gte(a, b) → ebool           // encrypted comparison >=
FHE.gt(a, b)  → ebool           // encrypted comparison >
FHE.eq(a, b)  → ebool           // encrypted equality
FHE.select(cond, a, b)          // encrypted conditional (no branching)
FHE.max(a, b)                   // encrypted maximum
FHE.min(a, b)                   // encrypted minimum

// Access control — CRITICAL — must call after every mutation
FHE.allowThis(handle)           // contract can access
FHE.allowSender(handle)         // msg.sender can access
FHE.allow(handle, address)      // specific address can access
FHE.allowPublic(handle)         // threshold network can decrypt

// Reveal pattern (two-step)
// Step 1 (off-chain via Kofi SDK):
//   const result = await client.decryptForTx(ctHash).withoutPermit().execute()
// Step 2 (on-chain):
//   FHE.publishDecryptResult(ctHash, plaintext, signature)
```

### Common Mistakes to Avoid

1. **Forgetting `FHE.allowThis()` after every mutation** — the new ciphertext handle has no permissions; contract loses access to its own state
2. **Branching on encrypted values** — never `if (encValue > x)` — use `FHE.select()` instead
3. **Reusing handles** — after `FHE.add(a, b)`, `a` is a new handle; the old one is invalid
4. **Gas estimates in mock** — mock environment uses higher gas than testnet; don't panic
5. **`euint256` for monetary values** — use this for amounts that need precision; `euint64` is fine for counts and scores

---

## FHE Necessity Argument (Use in Submission)

When the judge asks "why do you need FHE?":

> "Without FHE, every alternative requires one party to reveal their number first or rely on a trusted third party who could leak or manipulate the result.
>
> Commit-reveal schemes fail because revealing the commitment exposes the value before the counterparty commits, enabling exploitation.
>
> ZK proofs can verify a range but cannot compute an encrypted midpoint — TFHE.add() on ciphertexts has no ZK equivalent.
>
> FHE is the only cryptographic primitive where both values stay encrypted during comparison, the comparison itself runs on ciphertexts, and only the result is revealed. This is not FHE bolted onto an existing product. This is a product that could not exist without FHE."

---

## Resources

| Resource                           | URL                                                                 |
| ---------------------------------- | ------------------------------------------------------------------- |
| Fhenix CoFHE docs                  | https://cofhe-docs.fhenix.zone                                      |
| Quick start guide                  | https://cofhe-docs.fhenix.zone/fhe-library/introduction/quick-start |
| Auction example (closest to BATNA) | https://cofhe-docs.fhenix.zone/fhe-library/examples/auction-example |
| FHE.sol reference                  | https://cofhe-docs.fhenix.zone/fhe-library/reference/fhe-sol        |
| Starter repo                       | https://github.com/FhenixProtocol/cofhe-hardhat-starter             |
| Awesome Fhenix examples            | https://github.com/FhenixProtocol/awesome-fhenix                    |
| Kofi SDK docs                      | https://cofhe-docs.fhenix.zone/client-sdk/introduction/overview     |
| Privara SDK                        | https://www.npmjs.com/package/@reineira-os/sdk                      |
| Privara docs                       | https://reineira.xyz/docs                                           |
| Buildathon Telegram                | https://t.me/+rA9gI3AsW8c3YzIx                                      |
| Arbiscan Sepolia                   | https://sepolia.arbiscan.io                                         |
| Arbitrum Sepolia faucet            | https://faucet.quicknode.com/arbitrum/sepolia                       |

---

## Project File Structure (Target)

```
batna-protocol/
├── contracts/
│   ├── NegotiationRoom.sol       ← Wave 1 core
│   ├── NegotiationFactory.sol    ← Wave 1 factory
│   ├── MultiPartyNegotiation.sol ← Wave 3
│   └── NegotiationReputation.sol ← Wave 3
├── test/
│   └── NegotiationRoom.test.ts   ← Wave 1 tests
├── tasks/
│   ├── deploy-room.ts
│   └── submit-reservation.ts
├── agent/
│   ├── batna_agent.py            ← Wave 2 AI agent
│   └── templates/
│       ├── salary.py
│       ├── realestate.py
│       └── termsheet.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NegotiationUI.tsx
│   │   │   ├── ResultDisplay.tsx
│   │   │   └── RoomCreator.tsx
│   │   └── pages/
│   │       ├── index.tsx
│   │       └── room/[address].tsx
│   └── package.json
├── hardhat.config.ts
├── .env.example
└── README.md
```

---

_BATNA Protocol — Built on Fhenix CoFHE — Arbitrum Sepolia_
_Fhenix Privacy-by-Design Buildathon · March–June 2026_
_Wave 1 deadline: March 31, 2026 01:53 UTC_

import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mock_expectPlaintext } from "@cofhe/hardhat-plugin";
import { Encryptable } from "@cofhe/sdk";

// Helper: keccak256 of a UTF-8 string — matches the frontend's contextHash.
const H = (s: string): string =>
  hre.ethers.keccak256(hre.ethers.toUtf8Bytes(s));

// Default AgentProvenance used when a test doesn't care about the provenance
// fields. Real agent flows should populate these with real values.
const DEFAULT_PROVENANCE = {
  templateId: 1, // SALARY
  contextHash: H(""),
  modelHash: H("claude-opus-4-6"),
  promptVersionHash: H("v1"),
};

describe("NegotiationRoom", function () {
  async function deployRoomFixture() {
    const [owner, alice, bob, stranger] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Salary negotiation: Senior Engineer"),
      50, // equal weight (standard midpoint)
      "0x0000000000000000000000000000000000000000", // no auditor
      0, // no deadline
      1 // NegotiationType.SALARY
    );

    return { room, owner, alice, bob, stranger, client };
  }

  // Helper: encrypt a value and submit as a given signer
  async function encryptAndSubmit(
    client: Awaited<ReturnType<typeof hre.cofhe.createClientWithBatteries>>,
    signer: Awaited<ReturnType<typeof hre.ethers.getSigners>>[0],
    room: Awaited<ReturnType<typeof deployRoomFixture>>["room"],
    amount: bigint
  ) {
    await hre.cofhe.connectWithHardhatSigner(client, signer);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(amount)])
      .execute();
    await room.connect(signer).submitReservation(encrypted);
  }

  // ── Access Control ──────────────────────────────────────────

  it("rejects submission from non-party address", async function () {
    const { room, stranger, client } = await loadFixture(deployRoomFixture);

    await hre.cofhe.connectWithHardhatSigner(client, stranger);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(100000n)])
      .execute();

    await expect(
      room.connect(stranger).submitReservation(encrypted)
    ).to.be.revertedWith("Not a party");
  });

  it("prevents double submission from party A", async function () {
    const { room, alice, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encrypted2] = await client
      .encryptInputs([Encryptable.uint64(120000n)])
      .execute();

    await expect(
      room.connect(alice).submitReservation(encrypted2)
    ).to.be.revertedWith("A already submitted");
  });

  it("prevents double submission from party B", async function () {
    const { room, bob, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, bob, room, 145000n);

    await hre.cofhe.connectWithHardhatSigner(client, bob);
    const [encrypted2] = await client
      .encryptInputs([Encryptable.uint64(140000n)])
      .execute();

    await expect(
      room.connect(bob).submitReservation(encrypted2)
    ).to.be.revertedWith("B already submitted");
  });

  // ── Submission Flow ─────────────────────────────────────────

  it("accepts encrypted submission from party A", async function () {
    const { room, alice, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);
    expect(await room.aSubmitted()).to.be.true;
    expect(await room.bSubmitted()).to.be.false;
    expect(await room.resolved()).to.be.false;
  });

  it("auto-resolves when both parties submit", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);
    expect(await room.resolved()).to.be.false;

    await encryptAndSubmit(client, bob, room, 145000n);
    expect(await room.aSubmitted()).to.be.true;
    expect(await room.bSubmitted()).to.be.true;
    expect(await room.resolved()).to.be.true;
  });

  // ── ZOPA Detection + Midpoint ───────────────────────────────

  it("computes correct midpoint when ZOPA exists (minA <= maxB)", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    // Alice floor: $130K, Bob ceiling: $145K → ZOPA exists
    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);

    expect(await room.resolved()).to.be.true;

    // Midpoint should be (130000 + 145000) / 2 = 137500
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 137500n);
  });

  it("returns zero when no ZOPA (minA > maxB)", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    // Alice floor: $160K, Bob ceiling: $140K → no ZOPA
    await encryptAndSubmit(client, alice, room, 160000n);
    await encryptAndSubmit(client, bob, room, 140000n);

    expect(await room.resolved()).to.be.true;

    // No deal → result should be 0
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 0n);
  });

  // ── Events ──────────────────────────────────────────────────

  it("emits PartySubmitted event on each submission", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encAlice] = await client
      .encryptInputs([Encryptable.uint64(130000n)])
      .execute();

    await expect(room.connect(alice).submitReservation(encAlice))
      .to.emit(room, "PartySubmitted")
      .withArgs(alice.address);

    await hre.cofhe.connectWithHardhatSigner(client, bob);
    const [encBob] = await client
      .encryptInputs([Encryptable.uint64(145000n)])
      .execute();

    await expect(room.connect(bob).submitReservation(encBob))
      .to.emit(room, "PartySubmitted")
      .withArgs(bob.address);
  });

  // ── Post-Resolution Guard ───────────────────────────────────

  it("rejects submission after resolution", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);
    expect(await room.resolved()).to.be.true;

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(130000n)])
      .execute();

    // After resolution, status != OPEN so the new onlyOpen modifier fires first.
    await expect(
      room.connect(alice).submitReservation(encrypted)
    ).to.be.revertedWith("Room not open");
  });

  // ── Weighted Midpoint ────────────────────────────────────────

  it("computes weighted settlement when weightA != 50", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    // weightA=60 means: settlement = (minA*60 + maxB*40) / 100
    const room = await Room.deploy(alice.address, bob.address, H("Weighted deal"), 60, "0x0000000000000000000000000000000000000000", 0, 1);

    // Alice floor: 100000, Bob ceiling: 200000
    // Settlement = (100000*60 + 200000*40) / 100 = (6000000 + 8000000) / 100 = 140000
    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encAlice] = await client.encryptInputs([Encryptable.uint64(100000n)]).execute();
    await room.connect(alice).submitReservation(encAlice);

    await hre.cofhe.connectWithHardhatSigner(client, bob);
    const [encBob] = await client.encryptInputs([Encryptable.uint64(200000n)]).execute();
    await room.connect(bob).submitReservation(encBob);

    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 140000n);
  });

  it("equal weight (50) produces standard midpoint", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    // weightA=50 (default fixture) → (130000*50 + 145000*50) / 100 = 137500
    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);

    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 137500n);
  });

  // ── publishResults Flow ─────────────────────────────────────

  it("cannot call publishResults before resolution", async function () {
    const { room } = await loadFixture(deployRoomFixture);

    // Try publishing with dummy values before any submissions
    await expect(
      room.publishResults(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        true,
        "0x",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        "0x"
      )
    ).to.be.revertedWith("Not resolved yet");
  });

  it("getEncryptedResult reverts before resolution", async function () {
    const { room } = await loadFixture(deployRoomFixture);

    await expect(room.getEncryptedResult()).to.be.revertedWith(
      "Not resolved yet"
    );
  });

  it("getEncryptedZopa reverts before resolution", async function () {
    const { room } = await loadFixture(deployRoomFixture);

    await expect(room.getEncryptedZopa()).to.be.revertedWith(
      "Not resolved yet"
    );
  });

  // ── Wave 2: Deadline Enforcement ────────────────────────────

  it("constructor stores the deadline value", async function () {
    const [, alice, bob] = await hre.ethers.getSigners();
    const Room = await hre.ethers.getContractFactory("NegotiationRoom");

    const targetDeadline = Math.floor(Date.now() / 1000) + 3600;
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Deadline test"),
      50,
      "0x0000000000000000000000000000000000000000",
      targetDeadline,
      1
    );

    expect(await room.deadline()).to.equal(targetDeadline);
  });

  it("submitReservation reverts after the deadline", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);
    const Room = await hre.ethers.getContractFactory("NegotiationRoom");

    // Set a deadline 60 seconds in the future, then advance past it
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const baseTs = latestBlock!.timestamp;
    const expiredDeadline = baseTs + 60;

    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Expired deal"),
      50,
      "0x0000000000000000000000000000000000000000",
      expiredDeadline,
      1
    );

    // Move chain time past the deadline
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [expiredDeadline + 1]);
    await hre.ethers.provider.send("evm_mine", []);

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(130000n)])
      .execute();

    await expect(
      room.connect(alice).submitReservation(encrypted)
    ).to.be.revertedWith("Negotiation expired");
  });

  it("submitReservation succeeds when deadline=0 (no deadline)", async function () {
    // The default fixture uses deadline=0; reuse it.
    const { room, alice, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);
    expect(await room.aSubmitted()).to.be.true;
  });

  // ── Wave 2: NegotiationType Enum ────────────────────────────

  it("constructor stores the negotiationType enum value", async function () {
    const [, alice, bob] = await hre.ethers.getSigners();
    const Room = await hre.ethers.getContractFactory("NegotiationRoom");

    const TYPE_MA = 3;
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Tender for Series A acquisition"),
      50,
      "0x0000000000000000000000000000000000000000",
      0,
      TYPE_MA
    );

    expect(await room.negotiationType()).to.equal(TYPE_MA);
  });

  // ── Wave 2: submitReservationAsAgent ────────────────────────

  it("submitReservationAsAgent emits PartySubmitted and AgentSubmission with full provenance", async function () {
    const { room, alice, client } = await loadFixture(deployRoomFixture);

    // Use a real signer address so ethers checksum casing is consistent
    const [, , , , agentSigner] = await hre.ethers.getSigners();
    const agentAddress = agentSigner.address;

    const provenance = {
      templateId: 1, // SALARY
      contextHash: H("Senior backend engineer — Bay Area — $165K competing"),
      modelHash: H("claude-opus-4-6"),
      promptVersionHash: H("salary-v1"),
    };

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(130000n)])
      .execute();

    const tx = await room
      .connect(alice)
      .submitReservationAsAgent(encrypted, agentAddress, provenance);

    await expect(tx)
      .to.emit(room, "PartySubmitted")
      .withArgs(alice.address);
    await expect(tx)
      .to.emit(room, "AgentSubmission")
      .withArgs(
        alice.address,
        agentAddress,
        provenance.templateId,
        provenance.contextHash,
        provenance.modelHash,
        provenance.promptVersionHash
      );
  });

  it("submitReservationAsAgent rejects non-party callers", async function () {
    const { room, stranger, client } = await loadFixture(deployRoomFixture);

    await hre.cofhe.connectWithHardhatSigner(client, stranger);
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(100000n)])
      .execute();

    await expect(
      room
        .connect(stranger)
        .submitReservationAsAgent(encrypted, stranger.address, DEFAULT_PROVENANCE)
    ).to.be.revertedWith("Not a party");
  });

  it("submitReservationAsAgent counts as the party for ZOPA resolution", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    // Alice via agent, Bob via direct submission — should still resolve
    await hre.cofhe.connectWithHardhatSigner(client, alice);
    const [encA] = await client
      .encryptInputs([Encryptable.uint64(130000n)])
      .execute();
    await room
      .connect(alice)
      .submitReservationAsAgent(encA, alice.address, DEFAULT_PROVENANCE);

    await encryptAndSubmit(client, bob, room, 145000n);

    expect(await room.resolved()).to.be.true;
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 137500n);
  });

  // ── Privacy Invariant: Auditor ACL ───────────────────────────

  it("auditor NEVER gets ACL access to encMinA or encMaxB — only result + ZOPA", async function () {
    const [owner, alice, bob, auditor] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Audited salary negotiation"),
      50,
      auditor.address, // auditor configured
      0,
      1
    );

    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);
    expect(await room.resolved()).to.be.true;

    // auditorAccess() mutates (calls into TaskManager) — read via staticCall
    const access = await room.auditorAccess.staticCall();

    expect(access.canSeeMinA, "auditor must NEVER see Party A's floor").to.be.false;
    expect(access.canSeeMaxB, "auditor must NEVER see Party B's ceiling").to.be.false;
    expect(access.canSeeResult, "auditor should be able to see the settlement").to.be.true;
    expect(access.canSeeZopa, "auditor should be able to see ZOPA existence").to.be.true;
  });

  it("when no auditor is set, auditorAccess returns all false", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);

    const access = await room.auditorAccess.staticCall();
    expect(access.canSeeMinA).to.be.false;
    expect(access.canSeeMaxB).to.be.false;
    expect(access.canSeeResult).to.be.false;
    expect(access.canSeeZopa).to.be.false;
  });

  // ── Edge-weight settlement (overflow surface) ────────────────

  it("weightA=100 returns Party A's floor exactly (extreme seller-preferred)", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("weightA=100"),
      100,
      "0x0000000000000000000000000000000000000000",
      0,
      1
    );

    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);

    // Settlement = (130000*100 + 145000*0) / 100 = 130000
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 130000n);
  });

  it("weightA=0 returns Party B's ceiling exactly (extreme buyer-preferred)", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("weightA=0"),
      0,
      "0x0000000000000000000000000000000000000000",
      0,
      1
    );

    await encryptAndSubmit(client, alice, room, 130000n);
    await encryptAndSubmit(client, bob, room, 145000n);

    // Settlement = (130000*0 + 145000*100) / 100 = 145000
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 145000n);
  });

  it("settles correctly at values well inside the safe range (no overflow)", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("Large deal within safe range"),
      50,
      "0x0000000000000000000000000000000000000000",
      0,
      3 // MA
    );

    // Trillion-dollar acquisition in integer USD millions — max product
    // per side is 1_000_000_000 * 100 = 1e11, orders of magnitude below
    // 2^64 / 100 ≈ 1.84e17. No overflow.
    const minA = 1_000_000_000n; // $1T seller floor
    const maxB = 1_100_000_000n; // $1.1T acquirer ceiling
    await encryptAndSubmit(client, alice, room, minA);
    await encryptAndSubmit(client, bob, room, maxB);

    // Settlement = (1e9*50 + 1.1e9*50) / 100 = 1.05e9
    const expected = (minA + maxB) / 2n;
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, expected);
  });

  // ── Wave 2.1: contextHash storage (no plaintext on-chain) ────

  it("stores contextHash as bytes32; plaintext never touches calldata/state", async function () {
    const { room } = await loadFixture(deployRoomFixture);
    const expected = H("Salary negotiation: Senior Engineer");
    expect(await room.contextHash()).to.equal(expected);
  });

  // ── Wave 2.1: RoomStatus lifecycle ───────────────────────────

  it("initial status is OPEN; resolved flips to RESOLVED on both-side submission", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    expect(await room.status()).to.equal(0); // OPEN

    await encryptAndSubmit(client, alice, room, 130000n);
    expect(await room.status()).to.equal(0); // still OPEN after just one submission

    await encryptAndSubmit(client, bob, room, 145000n);
    expect(await room.status()).to.equal(1); // RESOLVED
    expect(await room.resolved()).to.be.true; // legacy flag still set
  });

  it("expireRoom transitions to EXPIRED past the deadline", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    await hre.cofhe.createClientWithBatteries(owner);
    const Room = await hre.ethers.getContractFactory("NegotiationRoom");

    const latest = await hre.ethers.provider.getBlock("latest");
    const deadline = latest!.timestamp + 60;
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("expire me"),
      50,
      "0x0000000000000000000000000000000000000000",
      deadline,
      1
    );

    // Fast-forward past the deadline
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
    await hre.ethers.provider.send("evm_mine", []);

    await expect(room.connect(alice).expireRoom())
      .to.emit(room, "RoomExpired")
      .withArgs(alice.address);

    expect(await room.status()).to.equal(2); // EXPIRED
  });

  it("expireRoom reverts before deadline", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    await hre.cofhe.createClientWithBatteries(owner);
    const Room = await hre.ethers.getContractFactory("NegotiationRoom");

    const latest = await hre.ethers.provider.getBlock("latest");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      H("future"),
      50,
      "0x0000000000000000000000000000000000000000",
      latest!.timestamp + 3600,
      1
    );

    await expect(room.connect(alice).expireRoom()).to.be.revertedWith(
      "Deadline not passed"
    );
  });

  it("expireRoom reverts when no deadline is set (deadline == 0)", async function () {
    const { room, alice } = await loadFixture(deployRoomFixture);

    await expect(room.connect(alice).expireRoom()).to.be.revertedWith(
      "No deadline set"
    );
  });

  it("cancelRoom transitions to CANCELLED only before any submission", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    await expect(room.connect(alice).cancelRoom())
      .to.emit(room, "RoomCancelled")
      .withArgs(alice.address);

    expect(await room.status()).to.equal(3); // CANCELLED
  });

  it("cancelRoom reverts after a submission exists", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await encryptAndSubmit(client, alice, room, 130000n);

    await expect(room.connect(bob).cancelRoom()).to.be.revertedWith(
      "Submission already made"
    );
  });

  it("submissions revert after the room is cancelled", async function () {
    const { room, alice, bob, client } = await loadFixture(deployRoomFixture);

    await room.connect(alice).cancelRoom();

    await hre.cofhe.connectWithHardhatSigner(client, bob);
    const [enc] = await client
      .encryptInputs([Encryptable.uint64(150000n)])
      .execute();

    await expect(
      room.connect(bob).submitReservation(enc)
    ).to.be.revertedWith("Room not open");
  });
});

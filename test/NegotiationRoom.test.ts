import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mock_expectPlaintext } from "@cofhe/hardhat-plugin";
import { Encryptable } from "@cofhe/sdk";

describe("NegotiationRoom", function () {
  async function deployRoomFixture() {
    const [owner, alice, bob, stranger] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      "Salary negotiation: Senior Engineer",
      50 // equal weight (standard midpoint)
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

    await expect(
      room.connect(alice).submitReservation(encrypted)
    ).to.be.revertedWith("Already resolved");
  });

  // ── Weighted Midpoint ────────────────────────────────────────

  it("computes weighted settlement when weightA != 50", async function () {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    // weightA=60 means: settlement = (minA*60 + maxB*40) / 100
    const room = await Room.deploy(alice.address, bob.address, "Weighted deal", 60);

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
});

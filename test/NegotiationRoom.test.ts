import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mock_expectPlaintext } from "@cofhe/hardhat-plugin";

describe("NegotiationRoom", function () {
  async function deployRoomFixture() {
    const [owner, alice, bob, stranger] = await hre.ethers.getSigners();
    await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      "Salary negotiation: Senior Engineer"
    );

    return { room, owner, alice, bob, stranger };
  }

  // ── Access Control ──────────────────────────────────────────

  it("rejects submission from non-party address", async function () {
    const { room, stranger } = await loadFixture(deployRoomFixture);

    await expect(
      room.connect(stranger).submitReservation(100000)
    ).to.be.revertedWith("Not a party");
  });

  it("prevents double submission from party A", async function () {
    const { room, alice } = await loadFixture(deployRoomFixture);

    await room.connect(alice).submitReservation(130000);
    await expect(
      room.connect(alice).submitReservation(120000)
    ).to.be.revertedWith("A already submitted");
  });

  it("prevents double submission from party B", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    await room.connect(bob).submitReservation(145000);
    await expect(
      room.connect(bob).submitReservation(140000)
    ).to.be.revertedWith("B already submitted");
  });

  // ── Submission Flow ─────────────────────────────────────────

  it("accepts encrypted submission from party A", async function () {
    const { room, alice } = await loadFixture(deployRoomFixture);

    await room.connect(alice).submitReservation(130000);
    expect(await room.aSubmitted()).to.be.true;
    expect(await room.bSubmitted()).to.be.false;
    expect(await room.resolved()).to.be.false;
  });

  it("auto-resolves when both parties submit", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    await room.connect(alice).submitReservation(130000);
    expect(await room.resolved()).to.be.false;

    await room.connect(bob).submitReservation(145000);
    expect(await room.aSubmitted()).to.be.true;
    expect(await room.bSubmitted()).to.be.true;
    expect(await room.resolved()).to.be.true;
  });

  // ── ZOPA Detection + Midpoint ───────────────────────────────

  it("computes correct midpoint when ZOPA exists (minA <= maxB)", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    // Alice floor: $130K, Bob ceiling: $145K → ZOPA exists
    await room.connect(alice).submitReservation(130000);
    await room.connect(bob).submitReservation(145000);

    expect(await room.resolved()).to.be.true;

    // Midpoint should be (130000 + 145000) / 2 = 137500
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 137500n);
  });

  it("returns zero when no ZOPA (minA > maxB)", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    // Alice floor: $160K, Bob ceiling: $140K → no ZOPA
    await room.connect(alice).submitReservation(160000);
    await room.connect(bob).submitReservation(140000);

    expect(await room.resolved()).to.be.true;

    // No deal → result should be 0
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 0n);
  });

  // ── Events ──────────────────────────────────────────────────

  it("emits PartySubmitted event on each submission", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    await expect(room.connect(alice).submitReservation(130000))
      .to.emit(room, "PartySubmitted")
      .withArgs(alice.address);

    await expect(room.connect(bob).submitReservation(145000))
      .to.emit(room, "PartySubmitted")
      .withArgs(bob.address);
  });

  // ── Post-Resolution Guard ───────────────────────────────────

  it("rejects submission after resolution", async function () {
    const { room, alice, bob } = await loadFixture(deployRoomFixture);

    await room.connect(alice).submitReservation(130000);
    await room.connect(bob).submitReservation(145000);
    expect(await room.resolved()).to.be.true;

    // Try submitting again — should fail because already resolved
    // Use a new fixture to get fresh addresses, but here we just test the guard
    await expect(
      room.connect(alice).submitReservation(130000)
    ).to.be.revertedWith("Already resolved");
  });
});

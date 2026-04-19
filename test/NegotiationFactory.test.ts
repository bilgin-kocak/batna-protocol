import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// keccak256 of a UTF-8 string — matches frontend contextHash convention
const H = (s: string): string =>
  hre.ethers.keccak256(hre.ethers.toUtf8Bytes(s));

describe("NegotiationFactory", function () {
  async function deployFactoryFixture() {
    const [owner, alice, bob, charlie] = await hre.ethers.getSigners();
    await hre.cofhe.createClientWithBatteries(owner);

    const Factory = await hre.ethers.getContractFactory("NegotiationFactory");
    const factory = await Factory.deploy();

    return { factory, owner, alice, bob, charlie };
  }

  // Helpers for shorter test bodies
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const NO_DEADLINE = 0;
  const TYPE_SALARY = 1; // NegotiationType.SALARY

  it("creates a room and tracks it", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    await factory
      .connect(alice)
      .createRoom(bob.address, H("Salary negotiation"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(1);
  });

  it("emits RoomCreated event with contextHash (not plaintext)", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const expectedHash = H("M&A deal");
    const tx = factory
      .connect(alice)
      .createRoom(bob.address, expectedHash, 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    await expect(tx)
      .to.emit(factory, "RoomCreated")
      .withArgs(
        () => true, // room address (dynamic)
        alice.address,
        bob.address,
        expectedHash
      );
  });

  it("created room has correct parties and contextHash", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const expectedHash = H("VC term sheet");
    const tx = await factory
      .connect(alice)
      .createRoom(bob.address, expectedHash, 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await tx.wait();

    const rooms = await factory.getRooms();
    const roomAddress = rooms[0];

    const room = await hre.ethers.getContractAt("NegotiationRoom", roomAddress);

    expect(await room.partyA()).to.equal(alice.address);
    expect(await room.partyB()).to.equal(bob.address);
    expect(await room.contextHash()).to.equal(expectedHash);
  });

  it("can create multiple rooms", async function () {
    const { factory, alice, bob, charlie } = await loadFixture(
      deployFactoryFixture
    );

    await factory.connect(alice).createRoom(bob.address, H("Deal 1"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(bob).createRoom(charlie.address, H("Deal 2"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(charlie).createRoom(alice.address, H("Deal 3"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(3);

    expect(await factory.getRoomCount()).to.equal(3);
  });

  it("tracks rooms by party", async function () {
    const { factory, alice, bob, charlie } = await loadFixture(
      deployFactoryFixture
    );

    await factory.connect(alice).createRoom(bob.address, H("Deal 1"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(alice).createRoom(charlie.address, H("Deal 2"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(bob).createRoom(charlie.address, H("Deal 3"), 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    const aliceRooms = await factory.getRoomsByParty(alice.address);
    expect(aliceRooms.length).to.equal(2);

    const bobRooms = await factory.getRoomsByParty(bob.address);
    expect(bobRooms.length).to.equal(2); // bob is partyB in deal 1, partyA in deal 3

    const charlieRooms = await factory.getRoomsByParty(charlie.address);
    expect(charlieRooms.length).to.equal(2); // charlie is partyB in deals 2 and 3
  });

  // ── Wave 2: Deadline + NegotiationType passthrough ───────────

  it("created room stores deadline and negotiationType from factory args", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const futureDeadline = Math.floor(Date.now() / 1000) + 3600; // 1h from now
    const TYPE_OTC = 2;

    await factory
      .connect(alice)
      .createRoom(bob.address, H("OTC ETH/USDC swap"), 50, ZERO_ADDR, futureDeadline, TYPE_OTC);

    const rooms = await factory.getRooms();
    const room = await hre.ethers.getContractAt("NegotiationRoom", rooms[0]);

    expect(await room.deadline()).to.equal(futureDeadline);
    expect(await room.negotiationType()).to.equal(TYPE_OTC);
  });
});

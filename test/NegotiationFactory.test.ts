import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

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

    await factory.connect(alice).createRoom(bob.address, "Salary negotiation", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(1);
  });

  it("emits RoomCreated event with correct args", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const tx = factory.connect(alice).createRoom(bob.address, "M&A deal", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    await expect(tx)
      .to.emit(factory, "RoomCreated")
      .withArgs(
        () => true, // room address (dynamic, just check it exists)
        alice.address,
        bob.address,
        "M&A deal"
      );
  });

  it("created room has correct parties and context", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const tx = await factory
      .connect(alice)
      .createRoom(bob.address, "VC term sheet", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    const receipt = await tx.wait();

    const rooms = await factory.getRooms();
    const roomAddress = rooms[0];

    const room = await hre.ethers.getContractAt("NegotiationRoom", roomAddress);

    expect(await room.partyA()).to.equal(alice.address);
    expect(await room.partyB()).to.equal(bob.address);
    expect(await room.context()).to.equal("VC term sheet");
  });

  it("can create multiple rooms", async function () {
    const { factory, alice, bob, charlie } = await loadFixture(
      deployFactoryFixture
    );

    await factory.connect(alice).createRoom(bob.address, "Deal 1", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(bob).createRoom(charlie.address, "Deal 2", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(charlie).createRoom(alice.address, "Deal 3", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(3);

    expect(await factory.getRoomCount()).to.equal(3);
  });

  it("tracks rooms by party", async function () {
    const { factory, alice, bob, charlie } = await loadFixture(
      deployFactoryFixture
    );

    await factory.connect(alice).createRoom(bob.address, "Deal 1", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(alice).createRoom(charlie.address, "Deal 2", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);
    await factory.connect(bob).createRoom(charlie.address, "Deal 3", 50, ZERO_ADDR, NO_DEADLINE, TYPE_SALARY);

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
      .createRoom(bob.address, "OTC ETH/USDC swap", 50, ZERO_ADDR, futureDeadline, TYPE_OTC);

    const rooms = await factory.getRooms();
    const room = await hre.ethers.getContractAt("NegotiationRoom", rooms[0]);

    expect(await room.deadline()).to.equal(futureDeadline);
    expect(await room.negotiationType()).to.equal(TYPE_OTC);
  });
});

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

  it("creates a room and tracks it", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    await factory.connect(alice).createRoom(bob.address, "Salary negotiation", 50, "0x0000000000000000000000000000000000000000");

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(1);
  });

  it("emits RoomCreated event with correct args", async function () {
    const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

    const tx = factory.connect(alice).createRoom(bob.address, "M&A deal", 50, "0x0000000000000000000000000000000000000000");

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
      .createRoom(bob.address, "VC term sheet", 50, "0x0000000000000000000000000000000000000000");
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

    await factory.connect(alice).createRoom(bob.address, "Deal 1", 50, "0x0000000000000000000000000000000000000000");
    await factory.connect(bob).createRoom(charlie.address, "Deal 2", 50, "0x0000000000000000000000000000000000000000");
    await factory.connect(charlie).createRoom(alice.address, "Deal 3", 50, "0x0000000000000000000000000000000000000000");

    const rooms = await factory.getRooms();
    expect(rooms.length).to.equal(3);

    expect(await factory.getRoomCount()).to.equal(3);
  });

  it("tracks rooms by party", async function () {
    const { factory, alice, bob, charlie } = await loadFixture(
      deployFactoryFixture
    );

    await factory.connect(alice).createRoom(bob.address, "Deal 1", 50, "0x0000000000000000000000000000000000000000");
    await factory.connect(alice).createRoom(charlie.address, "Deal 2", 50, "0x0000000000000000000000000000000000000000");
    await factory.connect(bob).createRoom(charlie.address, "Deal 3", 50, "0x0000000000000000000000000000000000000000");

    const aliceRooms = await factory.getRoomsByParty(alice.address);
    expect(aliceRooms.length).to.equal(2);

    const bobRooms = await factory.getRoomsByParty(bob.address);
    expect(bobRooms.length).to.equal(2); // bob is partyB in deal 1, partyA in deal 3

    const charlieRooms = await factory.getRoomsByParty(charlie.address);
    expect(charlieRooms.length).to.equal(2); // charlie is partyB in deals 2 and 3
  });
});

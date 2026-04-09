import { expect } from "chai";
import hre from "hardhat";
import { mock_expectPlaintext } from "@cofhe/hardhat-plugin";
import { encryptSubmit } from "../../agent";

/**
 * Integration test for the agent's encryptSubmit helper.
 *
 * Uses the same CoFHE mock pattern as the contract tests so we exercise the
 * full path: encrypt via SDK -> submit via the contract -> verify the room
 * resolves with the expected midpoint.
 */
describe("agent/encryptSubmit", function () {
  async function deployRoom() {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(owner);

    const Room = await hre.ethers.getContractFactory("NegotiationRoom");
    const room = await Room.deploy(
      alice.address,
      bob.address,
      "Agent SDK e2e test",
      50,
      "0x0000000000000000000000000000000000000000",
      0,
      1
    );
    return { room, alice, bob, client };
  }

  it("submits via submitReservation when no agentAddress provided", async function () {
    const { room, alice, client } = await deployRoom();
    await hre.cofhe.connectWithHardhatSigner(client, alice);

    const result = await encryptSubmit({
      room: room as any,
      signer: alice,
      derivedPrice: 130000n,
      cofheClient: client as any,
    });

    expect(result.txHash).to.be.a("string");
    expect(await room.aSubmitted()).to.be.true;
  });

  it("submits via submitReservationAsAgent when agentAddress provided", async function () {
    const { room, alice, client } = await deployRoom();
    await hre.cofhe.connectWithHardhatSigner(client, alice);

    const [, , , , agentSigner] = await hre.ethers.getSigners();

    const result = await encryptSubmit({
      room: room as any,
      signer: alice,
      derivedPrice: 130000n,
      cofheClient: client as any,
      agentAddress: agentSigner.address,
    });

    expect(result.txHash).to.be.a("string");
    expect(await room.aSubmitted()).to.be.true;

    // Verify the AgentSubmission event fired with the agent address
    const events = await room.queryFilter(room.filters.AgentSubmission());
    expect(events.length).to.equal(1);
    expect(events[0].args!.party).to.equal(alice.address);
    expect(events[0].args!.agent).to.equal(agentSigner.address);
  });

  it("end-to-end: both parties submit via encryptSubmit and the room resolves to the midpoint", async function () {
    const { room, alice, bob, client } = await deployRoom();

    await hre.cofhe.connectWithHardhatSigner(client, alice);
    await encryptSubmit({
      room: room as any,
      signer: alice,
      derivedPrice: 130000n,
      cofheClient: client as any,
    });

    await hre.cofhe.connectWithHardhatSigner(client, bob);
    await encryptSubmit({
      room: room as any,
      signer: bob,
      derivedPrice: 145000n,
      cofheClient: client as any,
    });

    expect(await room.resolved()).to.be.true;
    const encResult = await room.getEncryptedResult();
    await mock_expectPlaintext(alice.provider, encResult, 137500n);
  });

  it("rejects negative derivedPrice", async function () {
    const { room, alice, client } = await deployRoom();

    let threw = false;
    try {
      await encryptSubmit({
        room: room as any,
        signer: alice,
        derivedPrice: -1n,
        cofheClient: client as any,
      });
    } catch (err) {
      threw = true;
      expect((err as Error).message).to.match(/derivedPrice must be >= 0/);
    }
    expect(threw).to.be.true;
  });
});

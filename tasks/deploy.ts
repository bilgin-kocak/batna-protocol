import { task } from "hardhat/config";

task("deploy-factory", "Deploy NegotiationFactory to the network").setAction(
  async (_args, hre) => {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const Factory = await hre.ethers.getContractFactory("NegotiationFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    const address = await factory.getAddress();
    console.log("NegotiationFactory deployed to:", address);

    return address;
  }
);

// NegotiationType enum order in NegotiationRoom.sol
const NEGOTIATION_TYPES: Record<string, number> = {
  generic: 0,
  salary: 1,
  otc: 2,
  ma: 3,
};

task("create-room", "Create a negotiation room via the factory")
  .addParam("factory", "Factory contract address")
  .addParam("partyb", "Counterparty address")
  .addParam("context", "Negotiation context description")
  .addOptionalParam("weight", "Settlement weight for party A (0-100, default 50)", "50")
  .addOptionalParam("auditor", "Auditor address that can decrypt result only (default: none)", "0x0000000000000000000000000000000000000000")
  .addOptionalParam("deadline", "Unix timestamp after which submissions revert (default: 0 = no deadline)", "0")
  .addOptionalParam("type", "Negotiation type: generic | salary | otc | ma (default: generic)", "generic")
  .setAction(async ({ factory: factoryAddr, partyb, context, weight, auditor, deadline, type }, hre) => {
    const [signer] = await hre.ethers.getSigners();

    const typeValue = NEGOTIATION_TYPES[type.toLowerCase()];
    if (typeValue === undefined) {
      throw new Error(`Unknown --type "${type}". Use one of: ${Object.keys(NEGOTIATION_TYPES).join(", ")}`);
    }

    const factory = await hre.ethers.getContractAt("NegotiationFactory", factoryAddr, signer);

    // Context plaintext never goes on-chain — only its keccak256 hash.
    // Log the preimage client-side so it can be stored off-chain.
    const contextHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(context));
    console.log("Context plaintext (store off-chain):", context);
    console.log("Context hash (on-chain):            ", contextHash);

    const tx = await factory.createRoom(
      partyb,
      contextHash,
      parseInt(weight),
      auditor,
      BigInt(deadline),
      typeValue
    );
    const receipt = await tx.wait();

    console.log("Room created in tx:", receipt?.hash);

    const rooms = await factory.getRooms();
    const roomAddress = rooms[rooms.length - 1];
    console.log("Room address:", roomAddress);

    return roomAddress;
  });

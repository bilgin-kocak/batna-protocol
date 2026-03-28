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

task("create-room", "Create a negotiation room via the factory")
  .addParam("factory", "Factory contract address")
  .addParam("partyb", "Counterparty address")
  .addParam("context", "Negotiation context description")
  .addOptionalParam("weight", "Settlement weight for party A (0-100, default 50)", "50")
  .setAction(async ({ factory: factoryAddr, partyb, context, weight }, hre) => {
    const [signer] = await hre.ethers.getSigners();

    const factory = await hre.ethers.getContractAt("NegotiationFactory", factoryAddr, signer);

    const tx = await factory.createRoom(partyb, context, parseInt(weight));
    const receipt = await tx.wait();

    console.log("Room created in tx:", receipt?.hash);

    const rooms = await factory.getRooms();
    const roomAddress = rooms[rooms.length - 1];
    console.log("Room address:", roomAddress);

    return roomAddress;
  });

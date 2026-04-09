import { task } from "hardhat/config";
import {
  derivePrice,
  encryptSubmit,
  getTemplate,
  NegotiationType,
  type AgentRole,
} from "../agent";

const TYPE_MAP: Record<string, NegotiationType> = {
  generic: NegotiationType.GENERIC,
  salary: NegotiationType.SALARY,
  otc: NegotiationType.OTC,
  ma: NegotiationType.MA,
};

function parseType(name: string): NegotiationType {
  const value = TYPE_MAP[name.toLowerCase()];
  if (value === undefined) {
    throw new Error(
      `Unknown --type "${name}". Use one of: ${Object.keys(TYPE_MAP).join(", ")}`
    );
  }
  return value;
}

task(
  "agent-negotiate",
  "Run an autonomous BATNA agent: derive a reservation price from context, encrypt it, and submit on-chain"
)
  .addParam("factory", "NegotiationFactory contract address")
  .addParam("role", "Which side this agent acts as: partyA | partyB")
  .addParam("type", "Negotiation type: salary | otc | ma")
  .addParam("context", "Free-form context (job description, deal memo, etc.)")
  .addOptionalParam(
    "room",
    "Existing room address. If omitted, creates a new room (requires --counterparty).",
    ""
  )
  .addOptionalParam(
    "counterparty",
    "Counterparty address. Required when creating a new room.",
    ""
  )
  .addOptionalParam("weight", "Settlement weight for partyA (0-100)", "50")
  .addOptionalParam("currency", "Currency label passed to the LLM prompt", "USD")
  .addOptionalParam("model", "Anthropic model id", "claude-opus-4-6")
  .setAction(async (args, hre) => {
    const role = args.role as AgentRole;
    if (role !== "partyA" && role !== "partyB") {
      throw new Error(`--role must be partyA or partyB, got "${role}"`);
    }

    const negotiationType = parseType(args.type);
    const template = getTemplate(negotiationType);

    const [signer] = await hre.ethers.getSigners();
    console.log(`\n[BATNA Agent] role=${role}  type=${args.type}  signer=${signer.address}`);

    // 1. Derive reservation price via Claude
    console.log("\n[1/3] Deriving reservation price via Claude...");
    const derived = await derivePrice({
      template,
      role,
      context: args.context,
      currency: args.currency,
      model: args.model,
    });
    console.log(`        prompt length:  ${derived.prompt.length} chars`);
    console.log(`        attempts:       ${derived.attempts}`);
    console.log(`        raw response:   "${derived.rawResponse.trim()}"`);
    console.log(`        derived price:  ${derived.price.toString()} (${args.currency})`);

    // 2. Resolve / create room
    let roomAddress = args.room;
    const factory = await hre.ethers.getContractAt(
      "NegotiationFactory",
      args.factory,
      signer
    );

    if (!roomAddress) {
      if (!args.counterparty) {
        throw new Error("Either --room or --counterparty must be provided");
      }
      console.log("\n[2/3] No --room provided. Creating a new room via factory...");
      const tx = await factory.createRoom(
        args.counterparty,
        args.context.slice(0, 200), // truncate context to keep storage cheap
        parseInt(args.weight),
        "0x0000000000000000000000000000000000000000",
        0,
        negotiationType
      );
      const receipt = await tx.wait();
      const rooms = await factory.getRooms();
      roomAddress = rooms[rooms.length - 1];
      console.log(`        createRoom tx:  ${receipt?.hash}`);
      console.log(`        room address:   ${roomAddress}`);
    } else {
      console.log(`\n[2/3] Using existing room ${roomAddress}`);
    }

    // 3. Encrypt + submit (via submitReservationAsAgent — agent provenance on-chain)
    console.log("\n[3/3] Encrypting price via CoFHE SDK and submitting on-chain...");
    const room = await hre.ethers.getContractAt(
      "NegotiationRoom",
      roomAddress,
      signer
    );

    // Build CoFHE client matching the network the task is running against
    const cofheClient = await hre.cofhe.createClientWithBatteries(signer);
    await hre.cofhe.connectWithHardhatSigner(cofheClient, signer);

    const result = await encryptSubmit({
      room: room as any,
      signer,
      derivedPrice: derived.price,
      cofheClient: cofheClient as any,
      agentAddress: signer.address,
    });

    console.log(`        submit tx:      ${result.txHash}`);

    // Final state
    const aSubmitted = await room.aSubmitted();
    const bSubmitted = await room.bSubmitted();
    const resolved = await room.resolved();
    console.log("\n[BATNA Agent] room state:");
    console.log(`        aSubmitted: ${aSubmitted}`);
    console.log(`        bSubmitted: ${bSubmitted}`);
    console.log(`        resolved:   ${resolved}`);

    if (resolved) {
      console.log("\n        Both sides submitted. Result is encrypted on-chain.");
      console.log("        Use the CoFHE SDK decryptForTx flow to threshold-decrypt + publishResults.");
    } else {
      console.log("\n        Waiting for the counterparty to submit.");
    }

    return { roomAddress, txHash: result.txHash, derivedPrice: derived.price.toString() };
  });

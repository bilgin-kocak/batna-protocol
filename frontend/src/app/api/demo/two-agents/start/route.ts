import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  derivePrice,
  encryptSubmit,
  getTemplate,
  NegotiationType,
} from "@batna/agent";
import {
  newSession,
  updateSession,
  getDemoWallets,
  createConnectedCofheClient,
  FACTORY_ABI,
  ROOM_ABI,
  FACTORY_ADDRESS,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StartRequest {
  negotiationType: number;
  contextA: string;
  contextB: string;
  weightA?: number;
  currency?: string;
}

function isValidType(value: unknown): value is NegotiationType {
  return (
    typeof value === "number" &&
    value >= NegotiationType.GENERIC &&
    value <= NegotiationType.MA
  );
}

export async function POST(req: NextRequest) {
  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidType(body.negotiationType)) {
    return NextResponse.json(
      { error: "negotiationType must be 0..3" },
      { status: 400 }
    );
  }
  if (!body.contextA || !body.contextB) {
    return NextResponse.json(
      { error: "contextA and contextB are required" },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  let template;
  try {
    template = getTemplate(body.negotiationType);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const session = newSession();

  // Kick off the battle in the background. The browser polls /status for progress.
  void runBattle(session.id, body, template).catch((err) => {
    updateSession(session.id, {
      state: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ sessionId: session.id });
}

async function runBattle(
  sessionId: string,
  body: StartRequest,
  template: ReturnType<typeof getTemplate>
) {
  let walletA: ethers.Wallet;
  let walletB: ethers.Wallet;
  try {
    const wallets = getDemoWallets();
    walletA = wallets.walletA;
    walletB = wallets.walletB;
  } catch (err) {
    updateSession(sessionId, {
      state: "error",
      error: (err as Error).message,
    });
    return;
  }

  // Phase A: derive both prices in parallel
  updateSession(sessionId, { state: "deriving_a" });
  const [derivedA, derivedB] = await Promise.all([
    derivePrice({
      template,
      role: "partyA",
      context: body.contextA,
      currency: body.currency,
    }),
    derivePrice({
      template,
      role: "partyB",
      context: body.contextB,
      currency: body.currency,
    }),
  ]);
  updateSession(sessionId, {
    state: "deriving_b",
    derivedA: derivedA.price.toString(),
    derivedB: derivedB.price.toString(),
    rawResponseA: derivedA.rawResponse,
    rawResponseB: derivedB.rawResponse,
  });

  // Phase B: walletA creates a fresh room with walletB as counterparty
  updateSession(sessionId, { state: "creating_room" });
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI as any, walletA);
  const createTx = await factory.createRoom(
    walletB.address,
    body.contextA.slice(0, 200),
    body.weightA ?? 50,
    "0x0000000000000000000000000000000000000000",
    BigInt(0),
    body.negotiationType
  );
  await createTx.wait();
  const rooms: string[] = await factory.getRooms();
  const roomAddress = rooms[rooms.length - 1];
  updateSession(sessionId, { roomAddress });

  // Phase C: encrypt + submit for A
  updateSession(sessionId, { state: "encrypting_a" });
  const cofheA = await createConnectedCofheClient(walletA.privateKey);
  const roomFromA = new ethers.Contract(roomAddress, ROOM_ABI as any, walletA);
  const resultA = await encryptSubmit({
    room: roomFromA as any,
    signer: walletA,
    derivedPrice: derivedA.price,
    cofheClient: cofheA as any,
    agentAddress: walletA.address,
  });
  updateSession(sessionId, {
    state: "submitted_a",
    txHashA: resultA.txHash,
  });

  // Phase D: encrypt + submit for B (auto-resolves on the second submit)
  updateSession(sessionId, { state: "encrypting_b" });
  const cofheB = await createConnectedCofheClient(walletB.privateKey);
  const roomFromB = new ethers.Contract(roomAddress, ROOM_ABI as any, walletB);
  const resultB = await encryptSubmit({
    room: roomFromB as any,
    signer: walletB,
    derivedPrice: derivedB.price,
    cofheClient: cofheB as any,
    agentAddress: walletB.address,
  });
  updateSession(sessionId, {
    state: "resolved",
    txHashB: resultB.txHash,
  });
}

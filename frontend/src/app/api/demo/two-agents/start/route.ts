import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { keccak256, toBytes } from "viem";
import {
  derivePrice,
  encryptSubmit,
  getTemplate,
  NegotiationType,
} from "@batna/agent";
import {
  getDemoWallets,
  createConnectedCofheClient,
  FACTORY_ABI,
  ROOM_ABI,
  FACTORY_ADDRESS,
} from "../_lib";
import type { BattleState } from "../_sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bump from the 10s default so the whole battle can run inside one Lambda.
export const maxDuration = 60;

interface StartRequest {
  negotiationType: number;
  contextA: string;
  contextB: string;
  weightA?: number;
  currency?: string;
}

interface BattleEvent {
  state: BattleState;
  roomAddress?: string;
  txHashA?: string;
  txHashB?: string;
  derivedA?: string;
  derivedB?: string;
  error?: string;
}

function isValidType(value: unknown): value is NegotiationType {
  return (
    typeof value === "number" &&
    value >= NegotiationType.GENERIC &&
    value <= NegotiationType.MA
  );
}

/**
 * Streams the full Two-Agent Battle as an NDJSON response.
 *
 * Each line is a complete JSON object describing the latest state. The client
 * reads the stream with fetch+ReadableStream and updates the UI on each line.
 *
 * This keeps the entire battle inside ONE Lambda invocation — no cross-request
 * state (which wouldn't persist on Vercel), no polling, no external KV.
 */
export async function POST(req: NextRequest) {
  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isValidType(body.negotiationType)) {
    return json({ error: "negotiationType must be 0..3" }, 400);
  }
  if (!body.contextA || !body.contextB) {
    return json({ error: "contextA and contextB are required" }, 400);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "Server missing ANTHROPIC_API_KEY" }, 500);
  }

  let template;
  try {
    template = getTemplate(body.negotiationType);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: BattleEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const { walletA, walletB } = getDemoWallets();
        const weightA = body.weightA ?? 50;

        write({ state: "initializing" });

        // Phase 1 — derive both reservation prices in parallel
        write({ state: "deriving_a" });
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

        write({
          state: "deriving_b",
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });

        // Phase 2 — deploy the room
        write({
          state: "creating_room",
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });
        const factory = new ethers.Contract(
          FACTORY_ADDRESS,
          FACTORY_ABI as any,
          walletA
        );
        // Hash the party-A context — plaintext stays off-chain
        const roomContextHash = keccak256(toBytes(body.contextA));
        const createTx = await factory.createRoom(
          walletB.address,
          roomContextHash,
          weightA,
          "0x0000000000000000000000000000000000000000",
          BigInt(0),
          body.negotiationType
        );
        await createTx.wait();
        const rooms: string[] = await factory.getRooms();
        const roomAddress = rooms[rooms.length - 1];

        // Phase 3 — encrypt + submit party A
        write({
          state: "encrypting_a",
          roomAddress,
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });
        const cofheA = await createConnectedCofheClient(walletA.privateKey);
        const roomFromA = new ethers.Contract(roomAddress, ROOM_ABI as any, walletA);
        const resultA = await encryptSubmit({
          room: roomFromA as any,
          signer: walletA,
          derivedPrice: derivedA.price,
          cofheClient: cofheA as any,
          agentAddress: walletA.address,
          provenance: {
            templateId: body.negotiationType,
            contextHash: keccak256(toBytes(body.contextA)),
            modelHash: keccak256(toBytes("claude-opus-4-6")),
            promptVersionHash: keccak256(
              toBytes(`${template.name}-partyA-v1`)
            ),
          },
        });

        write({
          state: "submitted_a",
          roomAddress,
          txHashA: resultA.txHash,
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });

        // Phase 4 — encrypt + submit party B (the room auto-resolves here)
        write({
          state: "encrypting_b",
          roomAddress,
          txHashA: resultA.txHash,
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });
        const cofheB = await createConnectedCofheClient(walletB.privateKey);
        const roomFromB = new ethers.Contract(roomAddress, ROOM_ABI as any, walletB);
        const resultB = await encryptSubmit({
          room: roomFromB as any,
          signer: walletB,
          derivedPrice: derivedB.price,
          cofheClient: cofheB as any,
          agentAddress: walletB.address,
          provenance: {
            templateId: body.negotiationType,
            contextHash: keccak256(toBytes(body.contextB)),
            modelHash: keccak256(toBytes("claude-opus-4-6")),
            promptVersionHash: keccak256(
              toBytes(`${template.name}-partyB-v1`)
            ),
          },
        });

        write({
          state: "resolved",
          roomAddress,
          txHashA: resultA.txHash,
          txHashB: resultB.txHash,
          derivedA: derivedA.price.toString(),
          derivedB: derivedB.price.toString(),
        });

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(JSON.stringify({ state: "error", error: msg }) + "\n")
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

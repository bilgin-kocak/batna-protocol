import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { FheTypes } from "@cofhe/sdk";
import {
  getDemoWallets,
  createConnectedCofheClient,
  ROOM_ABI,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RevealRequest {
  roomAddress: string;
}

/**
 * POST /api/demo/two-agents/reveal
 * Body: { roomAddress }
 *
 * Reads encZopaExists + encResult from the room, threshold-decrypts both via
 * the CoFHE coprocessor, and calls publishResults() using a demo server wallet.
 * Returns the publish tx hash + the on-chain dealExists/revealedSplit.
 *
 * Stateless: no session lookup — the room address is enough to derive everything.
 */
export async function POST(req: NextRequest) {
  let body: RevealRequest;
  try {
    body = (await req.json()) as RevealRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.roomAddress || !/^0x[0-9a-fA-F]{40}$/.test(body.roomAddress)) {
    return NextResponse.json(
      { error: "roomAddress must be a 0x-prefixed 20-byte hex address" },
      { status: 400 }
    );
  }

  try {
    const { walletA } = getDemoWallets();
    const cofhe = await createConnectedCofheClient(walletA.privateKey);

    const room = new ethers.Contract(body.roomAddress, ROOM_ABI as any, walletA);

    // If already published, short-circuit
    const alreadyPublished = await room.dealExists().catch(() => false);
    const existingSplit = await room.revealedSplit().catch(() => BigInt(0));

    const encZopaCtHash: bigint = await room.getEncryptedZopa();
    const encResultCtHash: bigint = await room.getEncryptedResult();

    // Threshold-decrypt
    const zopaDec = await (cofhe as any)
      .decryptForTx(encZopaCtHash, FheTypes.Bool)
      .execute();
    const resultDec = await (cofhe as any)
      .decryptForTx(encResultCtHash, FheTypes.Uint64)
      .execute();

    const zopaBool = Boolean(zopaDec.plaintext);
    const resultPlaintext = BigInt(resultDec.plaintext ?? 0);
    const zopaSig = zopaDec.signature as string;
    const resultSig = resultDec.signature as string;

    const tx = await room.publishResults(
      encZopaCtHash,
      zopaBool,
      zopaSig,
      encResultCtHash,
      resultPlaintext,
      resultSig
    );
    const receipt = await tx.wait();

    const dealExists: boolean = await room.dealExists();
    const revealedSplit: bigint = await room.revealedSplit();

    return NextResponse.json({
      txHash: receipt?.hash ?? tx.hash,
      dealExists,
      revealedSplit: revealedSplit.toString(),
      alreadyPublished: alreadyPublished && existingSplit > BigInt(0),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { FheTypes } from "@cofhe/sdk";
import {
  getSession,
  updateSession,
  getDemoWallets,
  createConnectedCofheClient,
  ROOM_ABI,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo/two-agents/reveal/[sessionId]
 *
 * After the battle resolves, the encrypted result handles exist on-chain but
 * the plaintext is still sealed. This endpoint:
 *   1. Reads encZopaExists + encResult handles from the room
 *   2. Threshold-decrypts both via the CoFHE coprocessor (decryptForTx)
 *   3. Calls publishResults() using a demo server wallet (pays gas on arb-sepolia)
 *   4. Reads dealExists + revealedSplit back from the room
 *   5. Updates the session so the polling browser picks it up
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.state !== "resolved") {
    return NextResponse.json(
      { error: `Session not resolved yet (state=${session.state})` },
      { status: 400 }
    );
  }
  if (!session.roomAddress) {
    return NextResponse.json(
      { error: "Session missing roomAddress" },
      { status: 400 }
    );
  }
  if (session.publishTxHash) {
    // Already revealed — idempotent short-circuit
    return NextResponse.json({
      txHash: session.publishTxHash,
      dealExists: session.dealExists ?? null,
      revealedSplit: session.revealedSplit ?? null,
      cached: true,
    });
  }

  updateSession(params.sessionId, { revealing: true, revealError: undefined });

  try {
    const { walletA } = getDemoWallets();
    const cofhe = await createConnectedCofheClient(walletA.privateKey);

    const room = new ethers.Contract(session.roomAddress, ROOM_ABI as any, walletA);

    // 1. Read encrypted handles (ctHashes) from the room
    const encZopaCtHash: bigint = await room.getEncryptedZopa();
    const encResultCtHash: bigint = await room.getEncryptedResult();

    // 2. Threshold-decrypt both via the CoFHE coprocessor
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

    // 3. Submit publishResults on-chain
    const tx = await room.publishResults(
      encZopaCtHash,
      zopaBool,
      zopaSig,
      encResultCtHash,
      resultPlaintext,
      resultSig
    );
    const receipt = await tx.wait();

    // 4. Read the now-published plaintext from the room
    const dealExists: boolean = await room.dealExists();
    const revealedSplit: bigint = await room.revealedSplit();

    updateSession(params.sessionId, {
      revealing: false,
      publishTxHash: receipt?.hash ?? tx.hash,
      dealExists,
      revealedSplit: revealedSplit.toString(),
    });

    return NextResponse.json({
      txHash: receipt?.hash ?? tx.hash,
      dealExists,
      revealedSplit: revealedSplit.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateSession(params.sessionId, { revealing: false, revealError: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
// Reveals can take up to ~40s while we wait for the CoFHE threshold network
// to compute the signed decryption after _resolve() emits allowPublic events.
export const maxDuration = 60;

interface RevealRequest {
  roomAddress: string;
}

/**
 * POST /api/demo/two-agents/reveal
 * Body: { roomAddress }
 *
 * Threshold-decrypts encZopaExists + encResult via the CoFHE coprocessor and
 * publishes the plaintext on-chain via publishResults(). Both ciphertexts were
 * marked with FHE.allowPublic() in _resolve(), so no permit is needed.
 *
 * Retries with backoff — the threshold network can take 10-30s to finish
 * computing the decryption after allowPublic is called. Early attempts may
 * return placeholder values with signatures that fail verification; retrying
 * until the real signed decryption is available resolves this.
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

    // Short-circuit if already published
    const alreadyDeal: boolean = await room.dealExists().catch(() => false);
    const existingSplit: bigint = await room
      .revealedSplit()
      .catch(() => BigInt(0));
    if (existingSplit > BigInt(0) || alreadyDeal) {
      return NextResponse.json({
        txHash: null,
        dealExists: alreadyDeal,
        revealedSplit: existingSplit.toString(),
        alreadyPublished: true,
      });
    }

    const encZopaCtHash: bigint = await room.getEncryptedZopa();
    const encResultCtHash: bigint = await room.getEncryptedResult();

    // Retry loop — threshold network may not have signed the decryption yet.
    // Each iteration re-requests decryption (may still be stale) and tries
    // publishResults; if publishResults reverts, wait and retry.
    const MAX_ATTEMPTS = 6;
    const DELAYS_MS = [0, 4000, 6000, 8000, 10000, 12000]; // cumulative ~40s
    let lastError: unknown;
    let successTx: ethers.TransactionReceipt | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (DELAYS_MS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, DELAYS_MS[attempt]));
      }

      try {
        const zopaDec = await (cofhe as any)
          .decryptForTx(encZopaCtHash, FheTypes.Bool)
          .withoutPermit()
          .execute();
        const resultDec = await (cofhe as any)
          .decryptForTx(encResultCtHash, FheTypes.Uint64)
          .withoutPermit()
          .execute();

        const zopaBool = Boolean(zopaDec.plaintext);
        const resultPlaintext = BigInt(resultDec.plaintext ?? 0);

        console.log(
          `[reveal] attempt ${attempt + 1}: zopaBool=${zopaBool}, result=${resultPlaintext}`
        );

        const tx = await room.publishResults(
          encZopaCtHash,
          zopaBool,
          zopaDec.signature,
          encResultCtHash,
          resultPlaintext,
          resultDec.signature
        );
        const receipt = await tx.wait();
        successTx = receipt;
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[reveal] attempt ${attempt + 1} failed: ${msg.slice(0, 160)}`
        );
      }
    }

    if (!successTx) {
      const msg =
        lastError instanceof Error ? lastError.message : String(lastError);
      return NextResponse.json(
        {
          error: `Decryption did not settle after ${MAX_ATTEMPTS} attempts. The CoFHE threshold network may still be computing the signed decryption — try again in ~30s. Last error: ${msg.slice(
            0,
            200
          )}`,
        },
        { status: 504 }
      );
    }

    const dealExists: boolean = await room.dealExists();
    const revealedSplit: bigint = await room.revealedSplit();

    return NextResponse.json({
      txHash: successTx.hash,
      dealExists,
      revealedSplit: revealedSplit.toString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

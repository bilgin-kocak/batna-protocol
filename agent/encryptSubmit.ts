import { Encryptable } from "@cofhe/sdk";
import type { Signer } from "ethers";

/**
 * Minimal duck-typed interface for the CoFHE SDK client. Avoids importing the
 * full type so this module stays usable from both Node (Hardhat / API routes)
 * and the browser (where the WASM client is created differently).
 */
export interface CofheClientLike {
  encryptInputs(items: ReturnType<typeof Encryptable.uint64>[]): {
    execute(): Promise<unknown[]>;
  };
}

/**
 * Minimal duck-typed interface for an ethers Contract that exposes the two
 * NegotiationRoom submission entry points.
 */
export interface NegotiationRoomLike {
  connect(signer: Signer): {
    submitReservation(encrypted: unknown): Promise<{
      wait(): Promise<{ hash: string } | null>;
    }>;
    submitReservationAsAgent(
      encrypted: unknown,
      agent: string
    ): Promise<{ wait(): Promise<{ hash: string } | null> }>;
  };
}

export interface EncryptSubmitArgs {
  /** ethers Contract bound to NegotiationRoom (typed loosely on purpose). */
  room: NegotiationRoomLike;
  /** Signer that owns partyA or partyB. */
  signer: Signer;
  /** Reservation price (already in the unit the contract expects, e.g. cents). */
  derivedPrice: bigint;
  /** CoFHE client created via createClientWithBatteries / createClient. */
  cofheClient: CofheClientLike;
  /**
   * If set, calls submitReservationAsAgent and emits an AgentSubmission event
   * with this address as the agent. If unset, calls plain submitReservation.
   */
  agentAddress?: string;
}

export interface EncryptSubmitResult {
  txHash: string;
  /** The encrypted handle that was passed to the contract. */
  encrypted: unknown;
}

/**
 * Encrypt a reservation price client-side via the CoFHE SDK and submit it to a
 * NegotiationRoom. Returns the tx hash and the encrypted handle.
 */
export async function encryptSubmit(args: EncryptSubmitArgs): Promise<EncryptSubmitResult> {
  if (args.derivedPrice < 0n) {
    throw new Error("encryptSubmit: derivedPrice must be >= 0");
  }

  const result = await args.cofheClient
    .encryptInputs([Encryptable.uint64(args.derivedPrice)])
    .execute();

  const encrypted = result[0];

  const room = args.room.connect(args.signer);

  const tx = args.agentAddress
    ? await room.submitReservationAsAgent(encrypted, args.agentAddress)
    : await room.submitReservation(encrypted);

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("encryptSubmit: tx receipt was null");
  }

  return { txHash: receipt.hash, encrypted };
}

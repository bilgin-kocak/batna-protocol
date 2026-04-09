"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCofheClient, useCofheConnection } from "@cofhe/react";
import { Encryptable, EncryptStep } from "@cofhe/sdk";
import { NEGOTIATION_ROOM_ABI, NEGOTIATION_TYPE } from "@/config/contracts";
import { deriveAgentPrice } from "@/lib/agentApi";

interface SoloAgentModeProps {
  roomAddress: `0x${string}`;
  isPartyA: boolean;
  isPartyB: boolean;
  negotiationType: number;
  /** Address of the agent (same signer — the connected wallet). */
  agentAddress?: `0x${string}`;
}

const TYPE_LABELS: Record<number, string> = {
  [NEGOTIATION_TYPE.GENERIC]: "Generic",
  [NEGOTIATION_TYPE.SALARY]: "Salary",
  [NEGOTIATION_TYPE.OTC]: "OTC",
  [NEGOTIATION_TYPE.MA]: "M&A",
};

export function SoloAgentMode({
  roomAddress,
  isPartyA,
  isPartyB,
  negotiationType,
  agentAddress,
}: SoloAgentModeProps) {
  const [context, setContext] = useState("");
  const [derivedPrice, setDerivedPrice] = useState<string | null>(null);
  const [derivationInFlight, setDerivationInFlight] = useState(false);
  const [encryptionStep, setEncryptionStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cofheClient = useCofheClient();
  const connection = useCofheConnection();
  const isCofheReady = connection?.connected ?? false;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const role: "partyA" | "partyB" | null = isPartyA ? "partyA" : isPartyB ? "partyB" : null;
  const typeLabel = TYPE_LABELS[negotiationType] || "Generic";

  const handleDerive = async () => {
    if (!context || !role) return;
    setError(null);
    setDerivationInFlight(true);
    try {
      const res = await deriveAgentPrice({
        negotiationType,
        role,
        context,
      });
      setDerivedPrice(res.price);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDerivationInFlight(false);
    }
  };

  const handleSubmit = async () => {
    if (!derivedPrice || !cofheClient || !role) return;
    setError(null);
    try {
      setEncryptionStep("Encrypting...");
      const [encrypted] = await cofheClient
        .encryptInputs([Encryptable.uint64(BigInt(derivedPrice))])
        .onStep((step: EncryptStep) => {
          const labels: Record<string, string> = {
            initTfhe: "Initializing FHE...",
            fetchKeys: "Fetching keys...",
            pack: "Packing ciphertext...",
            prove: "Generating proof...",
            verify: "Verifying...",
          };
          setEncryptionStep(labels[step] || "Encrypting...");
        })
        .execute();

      setEncryptionStep(null);

      if (agentAddress) {
        writeContract({
          address: roomAddress,
          abi: NEGOTIATION_ROOM_ABI,
          functionName: "submitReservationAsAgent",
          args: [
            {
              ctHash: encrypted.ctHash,
              securityZone: encrypted.securityZone,
              utype: encrypted.utype,
              signature: encrypted.signature as `0x${string}`,
            },
            agentAddress,
          ],
        });
      } else {
        writeContract({
          address: roomAddress,
          abi: NEGOTIATION_ROOM_ABI,
          functionName: "submitReservation",
          args: [
            {
              ctHash: encrypted.ctHash,
              securityZone: encrypted.securityZone,
              utype: encrypted.utype,
              signature: encrypted.signature as `0x${string}`,
            },
          ],
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setEncryptionStep(null);
    }
  };

  if (!role) {
    return (
      <div className="card-surface p-8 mt-4 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Solo Agent mode is only available to parties of this room.
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 mt-4">
      <div className="mb-4">
        <span
          className="label-tag"
          style={{ color: "var(--accent)" }}
        >
          Solo Agent — {typeLabel}
        </span>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Claude reads your context, derives a reservation price, and hands it
          back. You then encrypt + submit it yourself (agent never touches your wallet).
        </p>
      </div>

      <label className="label-tag block mb-2">
        {isPartyA ? "Your context (candidate side)" : "Your context (counterparty side)"}
      </label>
      <textarea
        className="input-surface w-full px-4 py-3 text-sm"
        rows={5}
        placeholder="Paste the job description, deal memo, or free-form context here..."
        value={context}
        onChange={(e) => setContext(e.target.value)}
        disabled={derivationInFlight || !!encryptionStep}
      />

      <div className="flex gap-3 mt-4">
        <button
          className="btn-primary flex-1"
          onClick={handleDerive}
          disabled={!context || derivationInFlight || isPending || isConfirming}
        >
          {derivationInFlight ? "Asking Claude..." : derivedPrice ? "Re-derive" : "Derive price"}
        </button>
        <button
          className="btn-primary flex-1"
          onClick={handleSubmit}
          disabled={
            !derivedPrice ||
            !!encryptionStep ||
            isPending ||
            isConfirming ||
            !isCofheReady
          }
        >
          {encryptionStep
            ? encryptionStep
            : isPending
            ? "Signing..."
            : isConfirming
            ? "Sealing..."
            : !isCofheReady
            ? "Initializing FHE..."
            : "Encrypt & Submit"}
        </button>
      </div>

      {derivedPrice && (
        <div
          className="mt-4 p-3 text-sm"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="label-tag mb-1">Claude&apos;s reservation price</div>
          <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
            ${Number(derivedPrice).toLocaleString()}
          </div>
          <p className="text-[0.65rem] mt-1" style={{ color: "var(--text-muted)" }}>
            Review it before you seal. Once encrypted, nobody — not even you — can change it.
          </p>
        </div>
      )}

      {error && (
        <div
          className="mt-3 p-3 text-xs"
          style={{
            background: "rgba(231, 76, 60, 0.08)",
            border: "1px solid rgba(231, 76, 60, 0.2)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

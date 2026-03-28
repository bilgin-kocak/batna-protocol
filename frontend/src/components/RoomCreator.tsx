"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FACTORY_ADDRESS, NEGOTIATION_FACTORY_ABI } from "@/config/contracts";

interface RoomCreatorProps {
  onRoomCreated?: (address: string) => void;
}

export function RoomCreator({ onRoomCreated }: RoomCreatorProps) {
  const { isConnected } = useAccount();
  const [partyB, setPartyB] = useState("");
  const [context, setContext] = useState("");
  const [weight, setWeight] = useState(50);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreate = () => {
    if (!partyB || !context) return;
    writeContract({
      address: FACTORY_ADDRESS,
      abi: NEGOTIATION_FACTORY_ABI,
      functionName: "createRoom",
      args: [partyB as `0x${string}`, context, weight],
    });
  };

  if (!isConnected) {
    return (
      <div className="card-surface p-8 text-center">
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Connect wallet to create a negotiation room
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 animate-fade-up">
      <div className="flex items-center gap-2 mb-6">
        <div
          className="w-1.5 h-1.5"
          style={{ background: "var(--accent)" }}
        />
        <h2 className="label-tag">New Negotiation Room</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label-tag block mb-2">Counterparty Address</label>
          <input
            type="text"
            className="input-surface w-full px-4 py-3 text-sm"
            placeholder="0x..."
            value={partyB}
            onChange={(e) => setPartyB(e.target.value)}
          />
        </div>

        <div>
          <label className="label-tag block mb-2">Negotiation Context</label>
          <input
            type="text"
            className="input-surface w-full px-4 py-3 text-sm"
            placeholder="e.g. Salary negotiation: Senior Engineer role"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <div>
          <label className="label-tag block mb-2">
            Settlement Weight — Party A: {weight}% / Party B: {100 - weight}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={weight}
            onChange={(e) => setWeight(parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            50 = equal midpoint. Higher values weight settlement toward Party A&apos;s position.
          </p>
        </div>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleCreate}
          disabled={isPending || isConfirming || !partyB || !context}
        >
          {isPending
            ? "Awaiting signature..."
            : isConfirming
            ? "Confirming..."
            : isSuccess
            ? "Room Created"
            : "Initialize Room"}
        </button>

        {isSuccess && hash && (
          <p className="text-xs mt-3" style={{ color: "var(--accent-dim)" }}>
            TX: {hash.slice(0, 10)}...{hash.slice(-8)}
          </p>
        )}
      </div>
    </div>
  );
}

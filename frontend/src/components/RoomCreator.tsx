"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  FACTORY_ADDRESS,
  NEGOTIATION_FACTORY_ABI,
  NEGOTIATION_TYPE,
} from "@/config/contracts";

interface RoomCreatorProps {
  onRoomCreated?: (address: string) => void;
}

const TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: NEGOTIATION_TYPE.GENERIC, label: "Generic" },
  { value: NEGOTIATION_TYPE.SALARY, label: "Salary" },
  { value: NEGOTIATION_TYPE.OTC, label: "OTC trade" },
  { value: NEGOTIATION_TYPE.MA, label: "M&A acquisition" },
];

export function RoomCreator({ onRoomCreated }: RoomCreatorProps) {
  const { isConnected } = useAccount();
  const [partyB, setPartyB] = useState("");
  const [context, setContext] = useState("");
  const [weight, setWeight] = useState(50);
  const [negotiationType, setNegotiationType] = useState<number>(
    NEGOTIATION_TYPE.SALARY
  );
  // hours from now (0 = no deadline)
  const [deadlineHours, setDeadlineHours] = useState<number>(0);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreate = () => {
    if (!partyB || !context) return;
    const deadline =
      deadlineHours > 0
        ? BigInt(Math.floor(Date.now() / 1000) + deadlineHours * 3600)
        : BigInt(0);
    writeContract({
      address: FACTORY_ADDRESS,
      abi: NEGOTIATION_FACTORY_ABI,
      functionName: "createRoom",
      args: [
        partyB as `0x${string}`,
        context,
        weight,
        "0x0000000000000000000000000000000000000000",
        deadline,
        negotiationType,
      ],
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
    <div className="card-surface card-bracket p-6 animate-fade-up">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-1.5 h-1.5"
          style={{ background: "var(--accent)" }}
        />
        <h2 className="label-tag">New Negotiation Room</h2>
      </div>
      <div
        className="font-display text-xl mb-5"
        style={{ color: "var(--text-primary)" }}
      >
        Create a <span className="italic" style={{ color: "var(--accent)" }}>sealed</span> deal
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
          <label className="label-tag block mb-2">Negotiation Type</label>
          <select
            className="input-surface w-full px-4 py-3 text-sm"
            value={negotiationType}
            onChange={(e) => setNegotiationType(parseInt(e.target.value))}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-tag block mb-2">
            Deadline {deadlineHours > 0 ? `— ${deadlineHours}h from now` : "— none"}
          </label>
          <input
            type="range"
            min="0"
            max="168"
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Submissions revert past the deadline. 0 = no deadline.
          </p>
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

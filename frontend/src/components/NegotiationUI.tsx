"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useCofheClient, useCofheConnection } from "@cofhe/react";
import { Encryptable, EncryptStep } from "@cofhe/sdk";
import { NEGOTIATION_ROOM_ABI } from "@/config/contracts";
import { ModeToggle, type NegotiationMode } from "./ModeToggle";
import { SoloAgentMode } from "./SoloAgentMode";

interface NegotiationUIProps {
  roomAddress: `0x${string}`;
}

export function NegotiationUI({ roomAddress }: NegotiationUIProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [encryptionStep, setEncryptionStep] = useState<string | null>(null);
  const [mode, setMode] = useState<NegotiationMode>("manual");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // ── CoFHE SDK ───────────────────────────────────────────
  const cofheClient = useCofheClient();
  const connection = useCofheConnection();
  const isCofheReady = connection?.connected ?? false;

  // ── Read contract state ───────────────────────────────

  const { data: partyA } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "partyA",
  });

  const { data: partyB } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "partyB",
  });

  const { data: contextHash } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "contextHash",
  });
  // Plaintext lives off-chain — check localStorage for the preimage this
  // browser cached when creating the room. Falls back to the hash otherwise.
  const context = (() => {
    if (!contextHash) return undefined;
    if (typeof window === "undefined") return undefined;
    const stored = localStorage.getItem(`batna:context:${contextHash}`);
    if (stored) return stored;
    const hash = contextHash as string;
    return `${hash.slice(0, 10)}…${hash.slice(-6)} (hash)`;
  })();

  const { data: aSubmitted } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "aSubmitted",
    query: { refetchInterval: 4000 },
  });

  const { data: bSubmitted } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "bSubmitted",
    query: { refetchInterval: 4000 },
  });

  const { data: resolved } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "resolved",
    query: { refetchInterval: 4000 },
  });

  const { data: dealExists } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "dealExists",
    query: { refetchInterval: 4000, enabled: !!resolved },
  });

  const { data: revealedSplit } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "revealedSplit",
    query: { refetchInterval: 4000, enabled: !!resolved },
  });

  const { data: negotiationTypeRaw } = useReadContract({
    address: roomAddress,
    abi: NEGOTIATION_ROOM_ABI,
    functionName: "negotiationType",
  });
  const negotiationType = Number(negotiationTypeRaw ?? 0);

  // ── Derived state ─────────────────────────────────────

  const isPartyA = address?.toLowerCase() === partyA?.toLowerCase();
  const isPartyB = address?.toLowerCase() === partyB?.toLowerCase();
  const isParty = isPartyA || isPartyB;
  const myRole = isPartyA ? "Party A (Floor)" : isPartyB ? "Party B (Ceiling)" : "Observer";
  const hasSubmitted = (isPartyA && aSubmitted) || (isPartyB && bSubmitted);
  const bothSubmitted = aSubmitted && bSubmitted;

  // ── Submit handler — encrypts client-side via CoFHE SDK ─

  const handleSubmit = async () => {
    if (!amount || !cofheClient) return;

    try {
      // 1. Encrypt the amount client-side — plaintext never leaves the browser
      setEncryptionStep("Encrypting...");
      const [encrypted] = await cofheClient
        .encryptInputs([Encryptable.uint64(BigInt(amount))])
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

      // 2. Submit the encrypted struct to the contract
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
    } catch (err) {
      console.error("Encryption failed:", err);
      setEncryptionStep(null);
    }
  };

  // ── Button label ────────────────────────────────────────

  const getButtonLabel = () => {
    if (encryptionStep) return encryptionStep;
    if (isPending) return "Signing...";
    if (isConfirming) return "Sealing...";
    if (!isCofheReady) return "Initializing FHE...";
    return "Encrypt & Submit";
  };

  // ── Render states ─────────────────────────────────────

  // State: Resolved — show result
  if (resolved && bothSubmitted) {
    return (
      <div className="animate-fade-up">
        <RoomHeader context={context} roomAddress={roomAddress} myRole={myRole} />
        <StatusBar aSubmitted={!!aSubmitted} bSubmitted={!!bSubmitted} resolved={!!resolved} />

        {dealExists ? (
          <div className="card-surface card-bracket p-10 mt-4 text-center animate-vault">
            <div
              className="inline-block px-3 py-1 text-[0.65rem] tracking-[0.15em] uppercase mb-4"
              style={{
                background: "rgba(46, 204, 113, 0.1)",
                color: "var(--success)",
                border: "1px solid rgba(46, 204, 113, 0.2)",
              }}
            >
              Vault closed · deal found
            </div>
            <div
              className="font-display text-5xl md:text-6xl glow-text mb-3"
              style={{ color: "var(--accent)", letterSpacing: "-0.02em" }}
            >
              ${revealedSplit ? Number(revealedSplit).toLocaleString() : "…"}
            </div>
            <p
              className="text-xs max-w-sm mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Fair split computed on ciphertexts. Neither party&apos;s reservation
              price was revealed — not to the contract, not to the other party,
              not to the network.
            </p>
          </div>
        ) : (
          <div className="card-surface card-bracket p-10 mt-4 text-center animate-vault">
            <div
              className="inline-block px-3 py-1 text-[0.65rem] tracking-[0.15em] uppercase mb-4"
              style={{
                background: "rgba(231, 76, 60, 0.1)",
                color: "var(--danger)",
                border: "1px solid rgba(231, 76, 60, 0.2)",
              }}
            >
              No ZOPA
            </div>
            <div
              className="font-display text-3xl mb-2"
              style={{ color: "var(--danger)" }}
            >
              No Deal
            </div>
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
              Reservation ranges did not overlap.
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Neither party learns how far apart the positions were.
            </p>
          </div>
        )}
      </div>
    );
  }

  // State: Submitted — waiting for counterparty
  if (hasSubmitted && !resolved) {
    return (
      <div className="animate-fade-up">
        <RoomHeader context={context} roomAddress={roomAddress} myRole={myRole} />
        <StatusBar aSubmitted={!!aSubmitted} bSubmitted={!!bSubmitted} resolved={!!resolved} />

        <div className="card-surface p-8 mt-4 text-center">
          <div className="animate-seal-pulse mb-4">
            <span className="text-3xl" style={{ color: "var(--accent)" }}>
              &#x1F512;
            </span>
          </div>
          <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
            Your reservation price is sealed on-chain.
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Encrypted client-side via CoFHE SDK. Waiting for counterparty...
          </p>
        </div>
      </div>
    );
  }

  // State: Input — submit reservation
  return (
    <div className="animate-fade-up">
      <RoomHeader context={context} roomAddress={roomAddress} myRole={myRole} />
      <StatusBar aSubmitted={!!aSubmitted} bSubmitted={!!bSubmitted} resolved={!!resolved} />

      {isParty && <ModeToggle value={mode} onChange={setMode} />}

      {isParty && mode === "solo-agent" ? (
        <SoloAgentMode
          roomAddress={roomAddress}
          isPartyA={isPartyA}
          isPartyB={isPartyB}
          negotiationType={negotiationType}
          agentAddress={address}
        />
      ) : isParty ? (
        <div className="card-surface card-bracket p-6">
          <label className="label-tag block mb-2">
            {isPartyA
              ? "Your minimum acceptable value"
              : "Your maximum offer value"}
          </label>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Encrypted client-side before submission. The plaintext never touches
            the blockchain or any server.
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                $
              </span>
              <input
                type="number"
                className="input-surface w-full pl-7 pr-4 py-3 text-sm"
                placeholder="e.g. 130000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button
              className="btn-primary whitespace-nowrap"
              onClick={handleSubmit}
              disabled={!!encryptionStep || isPending || isConfirming || !amount || !isCofheReady}
            >
              {getButtonLabel()}
            </button>
          </div>
          {encryptionStep && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--accent-dim)" }}>
                {encryptionStep}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="card-surface p-8 mt-4 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            You are observing this room. Only designated parties can submit.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function RoomHeader({
  context,
  roomAddress,
  myRole,
}: {
  context?: string;
  roomAddress: string;
  myRole: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5" style={{ background: "var(--accent)" }} />
        <h2 className="label-tag">Negotiation Room</h2>
      </div>
      <p
        className="font-display text-xl md:text-2xl mb-2 leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {context || <span style={{ color: "var(--text-muted)" }}>Loading…</span>}
      </p>
      <div
        className="flex items-center gap-4 text-[0.65rem] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span>
          {roomAddress.slice(0, 6)}…{roomAddress.slice(-4)}
        </span>
        <span style={{ color: "var(--accent-dim)" }}>{myRole}</span>
      </div>
    </div>
  );
}

function StatusBar({
  aSubmitted,
  bSubmitted,
  resolved,
}: {
  aSubmitted: boolean;
  bSubmitted: boolean;
  resolved: boolean;
}) {
  return (
    <div
      className="flex items-center gap-6 px-4 py-3 text-[0.65rem] tracking-[0.1em] uppercase"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
    >
      <StatusDot label="Party A" active={aSubmitted} />
      <StatusDot label="Party B" active={bSubmitted} />
      <div className="ml-auto">
        <StatusDot
          label={resolved ? "Resolved" : "Pending"}
          active={resolved}
        />
      </div>
    </div>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: active ? "var(--success)" : "var(--text-muted)",
          boxShadow: active ? "0 0 6px rgba(46, 204, 113, 0.4)" : "none",
        }}
      />
      <span style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

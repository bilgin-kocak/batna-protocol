"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { RoomCreator } from "@/components/RoomCreator";
import dynamic from "next/dynamic";

const NegotiationUI = dynamic(
  () => import("@/components/NegotiationUI").then((mod) => mod.NegotiationUI),
  { ssr: false, loading: () => <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading FHE module...</div> }
);
import {
  FACTORY_ADDRESS,
  NEGOTIATION_FACTORY_ABI,
} from "@/config/contracts";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeRoom, setActiveRoom] = useState<`0x${string}` | null>(null);

  const { data: myRooms } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NEGOTIATION_FACTORY_ABI,
    functionName: "getRoomsByParty",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  if (activeRoom) {
    return (
      <div>
        <button
          className="text-xs mb-6 flex items-center gap-1.5 transition-colors hover:opacity-80"
          style={{ color: "var(--accent-dim)" }}
          onClick={() => setActiveRoom(null)}
        >
          &larr; Back to rooms
        </button>
        <NegotiationUI roomAddress={activeRoom} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="animate-fade-up">
        <h2
          className="text-2xl font-bold tracking-tight mb-2 glow-text"
          style={{ color: "var(--accent)" }}
        >
          Encrypted Negotiation
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Submit your reservation price sealed with FHE encryption. The protocol
          finds whether a deal zone exists and computes the fair split — without
          either party revealing their position.
        </p>
      </div>

      {/* How it works */}
      <div
        className="animate-fade-up grid grid-cols-3 gap-3"
        style={{ animationDelay: "0.1s" }}
      >
        {[
          { step: "01", label: "Seal", desc: "Submit encrypted minimum / maximum" },
          { step: "02", label: "Compute", desc: "FHE compares on ciphertexts" },
          { step: "03", label: "Reveal", desc: "Only deal / no-deal + midpoint" },
        ].map((item) => (
          <div
            key={item.step}
            className="card-surface p-4"
          >
            <span
              className="text-[0.6rem] tracking-[0.2em]"
              style={{ color: "var(--accent-dim)" }}
            >
              {item.step}
            </span>
            <p className="text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>
              {item.label}
            </p>
            <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Create Room */}
      <div style={{ animationDelay: "0.2s" }} className="animate-fade-up">
        <RoomCreator />
      </div>

      {/* My Rooms */}
      {isConnected && myRooms && myRooms.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-1.5 h-1.5"
              style={{ background: "var(--accent)" }}
            />
            <h2 className="label-tag">Your Rooms</h2>
          </div>
          <div className="space-y-2">
            {(myRooms as `0x${string}`[]).map((room) => (
              <button
                key={room}
                className="card-surface w-full px-4 py-3 text-left flex items-center justify-between transition-colors hover:border-[var(--accent-dim)]"
                onClick={() => setActiveRoom(room)}
                style={{ cursor: "pointer" }}
              >
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                  {room.slice(0, 8)}...{room.slice(-6)}
                </span>
                <span
                  className="text-[0.6rem] tracking-[0.15em] uppercase"
                  style={{ color: "var(--accent-dim)" }}
                >
                  Enter &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Direct room entry */}
      <DirectRoomEntry onEnter={setActiveRoom} />
    </div>
  );
}

function DirectRoomEntry({
  onEnter,
}: {
  onEnter: (addr: `0x${string}`) => void;
}) {
  const [roomAddr, setRoomAddr] = useState("");

  return (
    <div className="animate-fade-up" style={{ animationDelay: "0.4s" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5" style={{ background: "var(--border)" }} />
        <h2 className="label-tag">Enter Existing Room</h2>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          className="input-surface flex-1 px-4 py-3 text-sm"
          placeholder="Room address (0x...)"
          value={roomAddr}
          onChange={(e) => setRoomAddr(e.target.value)}
        />
        <button
          className="btn-primary"
          onClick={() => {
            if (roomAddr.startsWith("0x")) {
              onEnter(roomAddr as `0x${string}`);
            }
          }}
          disabled={!roomAddr.startsWith("0x")}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

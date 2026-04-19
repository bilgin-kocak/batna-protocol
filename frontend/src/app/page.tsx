"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { RoomCreator } from "@/components/RoomCreator";
import dynamic from "next/dynamic";
import { TwoAgentBattle } from "@/components/TwoAgentBattle";
import { ZopaHero } from "@/components/ZopaHero";

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
    <div className="stagger-children space-y-8">
      {/* Hero — animated ZOPA diagram replaces the text-only intro */}
      <div style={{ ["--i" as any]: 0 } as React.CSSProperties} className="animate-fade-up">
        <ZopaHero />
      </div>

      {/* How it works — three-step ribbon */}
      <div
        className="animate-fade-up grid grid-cols-1 md:grid-cols-3 gap-3"
        style={{ ["--i" as any]: 1 } as React.CSSProperties}
      >
        {[
          { step: "01", label: "Seal", desc: "Submit encrypted minimum / maximum" },
          { step: "02", label: "Compute", desc: "FHE compares on ciphertexts" },
          { step: "03", label: "Reveal", desc: "Only deal / no-deal + midpoint" },
        ].map((item) => (
          <div
            key={item.step}
            className="card-surface card-bracket p-4"
          >
            <span
              className="text-[0.6rem] tracking-[0.2em]"
              style={{ color: "var(--accent-dim)" }}
            >
              {item.step}
            </span>
            <p
              className="font-display text-lg mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              {item.label}
            </p>
            <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Two-Agent Battle (headline demo) — wider container for the split-screen feel */}
      <div
        style={{ ["--i" as any]: 2 } as React.CSSProperties}
        className="animate-fade-up"
      >
        <TwoAgentBattle />
      </div>

      {/* Secondary sections constrained narrower */}
      <div className="max-w-2xl mx-auto space-y-8">
        <div
          style={{ ["--i" as any]: 3 } as React.CSSProperties}
          className="animate-fade-up"
        >
          <RoomCreator />
        </div>

        {isConnected && myRooms && myRooms.length > 0 && (
          <div
            className="animate-fade-up"
            style={{ ["--i" as any]: 4 } as React.CSSProperties}
          >
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
                  className="card-surface card-bracket w-full px-4 py-3 text-left flex items-center justify-between transition-colors hover:border-[var(--accent-dim)]"
                  onClick={() => setActiveRoom(room)}
                  style={{ cursor: "pointer" }}
                >
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
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

        <div
          className="animate-fade-up"
          style={{ ["--i" as any]: 5 } as React.CSSProperties}
        >
          <DirectRoomEntry onEnter={setActiveRoom} />
        </div>
      </div>
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

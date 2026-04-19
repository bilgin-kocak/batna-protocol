"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header
      className="flex items-center justify-between px-6 py-5 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-seal-pulse"
            style={{
              background: "var(--accent)",
              boxShadow: "0 0 10px var(--accent-glow)",
            }}
          />
          <div>
            <h1
              className="font-display text-lg leading-none"
              style={{ color: "var(--accent)", letterSpacing: "-0.01em" }}
            >
              BATNA <span style={{ color: "var(--text-primary)" }}>Protocol</span>
            </h1>
            <div
              className="text-[0.55rem] tracking-[0.18em] uppercase mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Fhenix CoFHE · Arbitrum Sepolia · Two-Agent Battle Live
            </div>
          </div>
        </div>
        <span
          className="hidden md:inline text-[0.55rem] tracking-[0.15em] uppercase px-2 py-1"
          style={{
            color: "var(--accent-dim)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          Wave 2 · Agent Layer
        </span>
      </div>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="address"
      />
    </header>
  );
}

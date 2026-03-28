"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        <h1
          className="text-sm font-semibold tracking-[0.2em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          BATNA Protocol
        </h1>
        <span
          className="text-[0.6rem] tracking-[0.1em] uppercase px-2 py-0.5 rounded-sm"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          Testnet
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

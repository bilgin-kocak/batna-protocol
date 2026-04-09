"use client";

import { useEffect, useState } from "react";
import {
  startTwoAgentBattle,
  getBattleStatus,
  type BattleSession,
  type BattleState,
} from "@/lib/agentApi";
import { NEGOTIATION_TYPE } from "@/config/contracts";

const SAMPLE_CONTEXTS = {
  [NEGOTIATION_TYPE.SALARY]: {
    a: "Senior backend engineer, 6 years experience (3 at FAANG), Bay Area. Currently earning $148K base + $40K equity. Has a competing offer at $165K base.",
    b: "We are a Series B startup in San Francisco. Our salary band for Senior Backend is $135K-$170K base. We are growing fast and the hiring bar is high — we want to land this candidate but have a tight runway.",
  },
  [NEGOTIATION_TYPE.OTC]: {
    a: "Seller has 2,500 ETH to offload. Spot is ~$2,450. Buyer is a regulated market-maker. Trade must settle within 24h. Acceptable slippage from spot mid: 50 bps.",
    b: "Buyer is a treasury desk acquiring 2,500 ETH for an upcoming product launch. Spot is ~$2,450. Willing to pay a small premium over mid for a confidential block trade to avoid moving public markets.",
  },
  [NEGOTIATION_TYPE.MA]: {
    a: "Seller's board: B2B SaaS, $42M ARR, 60% YoY growth, 110% NRR, profitable. Board has signaled they will not accept below 10x ARR. Three competing bidders rumored.",
    b: "Acquirer is a strategic buyer who can realize $80M of synergies over 3 years. Comparable transactions trade at 12-18x ARR. Willing to pay a strategic premium, but internal committee cap is $600M.",
  },
};

const STATE_STEPS: { state: BattleState; label: string }[] = [
  { state: "initializing", label: "Initializing" },
  { state: "deriving_a", label: "Claude deriving Party A's price" },
  { state: "deriving_b", label: "Claude deriving Party B's price" },
  { state: "creating_room", label: "Deploying room to Arbitrum Sepolia" },
  { state: "encrypting_a", label: "Encrypting + submitting Party A" },
  { state: "submitted_a", label: "Party A sealed on-chain" },
  { state: "encrypting_b", label: "Encrypting + submitting Party B" },
  { state: "resolved", label: "Auto-resolved on ciphertexts" },
];

function stepIndex(state: BattleState): number {
  const idx = STATE_STEPS.findIndex((s) => s.state === state);
  return idx >= 0 ? idx : 0;
}

export function TwoAgentBattle() {
  const [negotiationType, setNegotiationType] = useState<number>(NEGOTIATION_TYPE.SALARY);
  const [contextA, setContextA] = useState(SAMPLE_CONTEXTS[NEGOTIATION_TYPE.SALARY].a);
  const [contextB, setContextB] = useState(SAMPLE_CONTEXTS[NEGOTIATION_TYPE.SALARY].b);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<BattleSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Poll status while a session is active
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getBattleStatus(sessionId);
        if (!cancelled) setSession(s);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    void tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  const handleTypeChange = (t: number) => {
    setNegotiationType(t);
    const samples = SAMPLE_CONTEXTS[t as keyof typeof SAMPLE_CONTEXTS];
    if (samples) {
      setContextA(samples.a);
      setContextB(samples.b);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    setSession(null);
    try {
      const res = await startTwoAgentBattle({
        negotiationType,
        contextA,
        contextB,
      });
      setSessionId(res.sessionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const activeStep = session ? stepIndex(session.state) : -1;
  const isTerminal = session?.state === "resolved" || session?.state === "error";

  return (
    <div className="card-surface p-6 animate-fade-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5" style={{ background: "var(--accent)" }} />
        <h2 className="label-tag">Two-Agent Battle (Live Demo)</h2>
      </div>
      <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        Two AI agents read opposing context, derive their reservation prices via
        Claude, encrypt them client-side, and submit to Arbitrum Sepolia. You
        watch the ZOPA settle on ciphertexts in real time.
      </p>

      {!session && (
        <>
          <div className="flex gap-2 mb-4">
            {[
              { v: NEGOTIATION_TYPE.SALARY, label: "Salary" },
              { v: NEGOTIATION_TYPE.OTC, label: "OTC" },
              { v: NEGOTIATION_TYPE.MA, label: "M&A" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => handleTypeChange(opt.v)}
                className="flex-1 py-2 text-xs"
                style={{
                  background: negotiationType === opt.v ? "var(--bg-primary)" : "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: negotiationType === opt.v ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label-tag block mb-2">Party A context</label>
              <textarea
                rows={5}
                className="input-surface w-full px-3 py-2 text-xs"
                value={contextA}
                onChange={(e) => setContextA(e.target.value)}
              />
            </div>
            <div>
              <label className="label-tag block mb-2">Party B context</label>
              <textarea
                rows={5}
                className="input-surface w-full px-3 py-2 text-xs"
                value={contextB}
                onChange={(e) => setContextB(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleStart}
            disabled={starting || !contextA || !contextB}
          >
            {starting ? "Starting..." : "Start Battle"}
          </button>
        </>
      )}

      {session && (
        <div className="space-y-2">
          {STATE_STEPS.map((step, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <div
                key={step.state}
                className="flex items-center gap-3 py-1.5"
                style={{ opacity: done || active ? 1 : 0.35 }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: done
                      ? "var(--success)"
                      : active
                      ? "var(--accent)"
                      : "var(--text-muted)",
                    boxShadow: active ? "0 0 8px var(--accent)" : "none",
                  }}
                />
                <span
                  className="text-xs"
                  style={{
                    color: done || active ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}

          {session.state === "resolved" && (
            <div className="mt-4 p-4 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="label-tag mb-1" style={{ color: "var(--success)" }}>Resolved on ciphertexts</div>
              <p className="text-[0.65rem] mt-1" style={{ color: "var(--text-muted)" }}>
                Room: {session.roomAddress?.slice(0, 10)}...{session.roomAddress?.slice(-6)}
              </p>
              {session.derivedA && session.derivedB && (
                <p className="text-[0.65rem] mt-1" style={{ color: "var(--text-muted)" }}>
                  Party A derived {session.derivedA} · Party B derived {session.derivedB} · (plaintexts kept off-chain)
                </p>
              )}
            </div>
          )}

          {session.state === "error" && (
            <div
              className="mt-4 p-3 text-xs"
              style={{
                background: "rgba(231, 76, 60, 0.08)",
                border: "1px solid rgba(231, 76, 60, 0.2)",
                color: "var(--danger)",
              }}
            >
              {session.error || "Unknown error"}
            </div>
          )}

          {isTerminal && (
            <button
              className="btn-primary w-full mt-3"
              onClick={() => {
                setSession(null);
                setSessionId(null);
              }}
            >
              Run another battle
            </button>
          )}
        </div>
      )}

      {error && !session && (
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

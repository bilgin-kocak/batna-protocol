"use client";

import { useEffect, useRef, useState } from "react";
import {
  streamTwoAgentBattle,
  revealBattleOnChain,
  type BattleEvent,
  type BattleState,
} from "@/lib/agentApi";
import { NEGOTIATION_TYPE } from "@/config/contracts";

/**
 * Client-side view of the battle. Accumulates every BattleEvent from the
 * stream so the UI always has the most up-to-date roomAddress / tx hashes /
 * derived prices / reveal outcome.
 */
interface BattleView extends BattleEvent {
  // Populated AFTER a successful /reveal call — server doesn't emit these.
  publishTxHash?: string;
  revealedSplit?: string;
  dealExists?: boolean;
}

const SAMPLE_CONTEXTS = {
  [NEGOTIATION_TYPE.SALARY]: {
    a: "Senior backend engineer, 6 years experience (3 at FAANG), Bay Area. Currently earning $148K base + $40K equity. Has a competing offer at $165K base.",
    b: "We are a Series B startup in San Francisco. Our salary band for Senior Backend is $135K-$170K base. We are growing fast and the hiring bar is high — we want to land this candidate but have a tight runway.",
    roles: { a: "Candidate", b: "Employer" },
    unit: "USD",
  },
  [NEGOTIATION_TYPE.OTC]: {
    a: "Seller has 2,500 ETH to offload. Spot is ~$2,450. Buyer is a regulated market-maker. Trade must settle within 24h. Acceptable slippage from spot mid: 50 bps.",
    b: "Buyer is a treasury desk acquiring 2,500 ETH for an upcoming product launch. Spot is ~$2,450. Willing to pay a small premium over mid for a confidential block trade to avoid moving public markets.",
    roles: { a: "Seller", b: "Buyer" },
    unit: "USD cents per ETH",
  },
  [NEGOTIATION_TYPE.MA]: {
    a: "Seller's board: B2B SaaS, $42M ARR, 60% YoY growth, 110% NRR, profitable. Board has signaled they will not accept below 10x ARR. Three competing bidders rumored.",
    b: "Acquirer is a strategic buyer who can realize $80M of synergies over 3 years. Comparable transactions trade at 12-18x ARR. Willing to pay a strategic premium, but internal committee cap is $600M.",
    roles: { a: "Board", b: "Acquirer" },
    unit: "USD millions",
  },
};

const STATE_STEPS: { state: BattleState; label: string; sub?: string }[] = [
  { state: "initializing", label: "Session initialized", sub: "Allocating in-memory session + validating env" },
  { state: "deriving_a", label: "Claude · Party A", sub: "Reading context → deriving floor" },
  { state: "deriving_b", label: "Claude · Party B", sub: "Reading context → deriving ceiling" },
  { state: "creating_room", label: "Deploying room", sub: "factory.createRoom() → Arbitrum Sepolia" },
  { state: "encrypting_a", label: "Encrypting · Party A", sub: "Encryptable.uint64() → CoFHE Node SDK" },
  { state: "submitted_a", label: "Sealed on-chain · Party A", sub: "submitReservationAsAgent(ctHash, agent)" },
  { state: "encrypting_b", label: "Encrypting · Party B", sub: "Encryptable.uint64() → CoFHE Node SDK" },
  { state: "resolved", label: "Resolved on ciphertexts", sub: "FHE.lte + FHE.mul + FHE.div executed" },
];

function stepIndex(state: BattleState): number {
  const idx = STATE_STEPS.findIndex((s) => s.state === state);
  return idx >= 0 ? idx : 0;
}

/** Ticking counter — animates from 0 to target over ~700ms. */
function useCountUp(target: string | undefined, duration = 700): string {
  const [value, setValue] = useState("0");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const end = Number(target);
    if (!Number.isFinite(end)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = Math.floor(end * eased);
      setValue(v.toString());
      if (p < 1) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export function TwoAgentBattle() {
  const [negotiationType, setNegotiationType] = useState<number>(NEGOTIATION_TYPE.SALARY);
  const [contextA, setContextA] = useState(SAMPLE_CONTEXTS[NEGOTIATION_TYPE.SALARY].a);
  const [contextB, setContextB] = useState(SAMPLE_CONTEXTS[NEGOTIATION_TYPE.SALARY].b);
  const [view, setView] = useState<BattleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  // Timestamp (ms-since-start) for each state we've observed.
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const startTimeRef = useRef<number | null>(null);

  const preset = SAMPLE_CONTEXTS[negotiationType as keyof typeof SAMPLE_CONTEXTS];

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
    setRunning(true);
    setError(null);
    setView({ state: "initializing" });
    setTimestamps({ initializing: 0 });
    startTimeRef.current = performance.now();

    try {
      for await (const event of streamTwoAgentBattle({
        negotiationType,
        contextA,
        contextB,
      })) {
        setView((prev) => ({ ...(prev ?? {}), ...event }));
        setTimestamps((prev) => {
          if (prev[event.state] !== undefined) return prev;
          const t0 = startTimeRef.current ?? performance.now();
          return { ...prev, [event.state]: performance.now() - t0 };
        });
        if (event.state === "error" && event.error) {
          setError(event.error);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setView((prev) => ({ ...(prev ?? { state: "error" }), state: "error", error: msg }));
    } finally {
      setStarting(false);
      setRunning(false);
    }
  };

  const handleReset = () => {
    setView(null);
    setTimestamps({});
    startTimeRef.current = null;
    setError(null);
  };

  const activeStep = view ? stepIndex(view.state) : -1;
  const isTerminal = !running && (view?.state === "resolved" || view?.state === "error");

  return (
    <div
      className="card-surface card-bracket p-7 md:p-10 animate-fade-up"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(201,162,39,0.06) 0%, transparent 45%), var(--bg-card)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5" style={{ background: "var(--accent)" }} />
            <span className="label-tag" style={{ color: "var(--accent)" }}>
              Live Demo · Two-Agent Battle
            </span>
          </div>
          <h2
            className="font-display text-[1.9rem] md:text-[2.3rem] leading-[1.1]"
            style={{ color: "var(--text-primary)" }}
          >
            Two AI agents.
            <br />
            <span className="italic" style={{ color: "var(--accent)" }}>
              One encrypted deal.
            </span>
          </h2>
          <p
            className="text-[0.8rem] mt-3 max-w-lg leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Each agent reads its own context, derives a reservation price via{" "}
            <code
              className="px-1.5 py-0.5 text-[0.7rem]"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--accent)",
                border: "1px solid var(--border)",
              }}
            >
              claude-opus-4-6
            </code>
            , encrypts it via CoFHE SDK, and submits to the on-chain room. The
            FHE computation settles on ciphertexts — neither number ever leaks.
          </p>
        </div>
      </div>

      {!view ? (
        <>
          {/* Scenario selector */}
          <div className="mb-6">
            <div className="label-tag mb-2">Scenario</div>
            <div className="flex gap-2">
              {[
                { v: NEGOTIATION_TYPE.SALARY, label: "Salary", tag: "Candidate × Employer" },
                { v: NEGOTIATION_TYPE.OTC, label: "OTC", tag: "Seller × Buyer" },
                { v: NEGOTIATION_TYPE.MA, label: "M&A", tag: "Board × Acquirer" },
              ].map((opt) => {
                const active = negotiationType === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => handleTypeChange(opt.v)}
                    className="flex-1 py-3 px-3 text-left transition-colors"
                    style={{
                      background: active ? "var(--bg-primary)" : "var(--bg-secondary)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="font-display text-base"
                      style={{
                        color: active ? "var(--accent)" : "var(--text-primary)",
                      }}
                    >
                      {opt.label}
                    </div>
                    <div
                      className="text-[0.6rem] tracking-[0.1em] uppercase mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {opt.tag}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split-console context inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <AgentConsole
              label={`Agent A · ${preset?.roles.a ?? "Party A"}`}
              tag="FLOOR"
              value={contextA}
              onChange={setContextA}
            />
            <AgentConsole
              label={`Agent B · ${preset?.roles.b ?? "Party B"}`}
              tag="CEILING"
              value={contextB}
              onChange={setContextB}
            />
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleStart}
            disabled={starting || !contextA || !contextB}
            style={{ fontSize: "0.85rem", letterSpacing: "0.2em" }}
          >
            {starting ? "Engaging agents..." : "▸ Start Battle"}
          </button>
        </>
      ) : (
        <BattleTimeline
          view={view}
          setView={setView}
          activeStep={activeStep}
          timestamps={timestamps}
          preset={preset}
          isTerminal={isTerminal}
          onReset={handleReset}
        />
      )}

      {error && !view && (
        <div
          className="mt-4 p-3 text-xs"
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

// ── Sub-components ──────────────────────────────────────────────

function AgentConsole({
  label,
  tag,
  value,
  onChange,
}: {
  label: string;
  tag: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div
      className="card-bracket p-4"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-display text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
        <span
          className="text-[0.55rem] tracking-[0.15em] uppercase px-2 py-0.5"
          style={{
            background: "var(--bg-primary)",
            color: "var(--accent-dim)",
            border: "1px solid var(--border)",
          }}
        >
          {tag}
        </span>
      </div>
      <textarea
        rows={5}
        className="input-surface w-full px-3 py-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function BattleTimeline({
  view,
  setView,
  activeStep,
  timestamps,
  preset,
  isTerminal,
  onReset,
}: {
  view: BattleView;
  setView: React.Dispatch<React.SetStateAction<BattleView | null>>;
  activeStep: number;
  timestamps: Record<string, number>;
  preset: (typeof SAMPLE_CONTEXTS)[keyof typeof SAMPLE_CONTEXTS] | undefined;
  isTerminal: boolean;
  onReset: () => void;
}) {
  const sessionTag = view.roomAddress
    ? `${view.roomAddress.slice(0, 6)}…${view.roomAddress.slice(-4)}`
    : "starting…";
  return (
    <div>
      <div className="label-tag mb-4">Room · {sessionTag}</div>

      {/* Timeline */}
      <div className="relative pl-6 md:pl-8">
        {/* vertical rail */}
        <div
          className="absolute left-1.5 md:left-2.5 top-1 bottom-1 w-px"
          style={{ background: "var(--border)" }}
        />
        {STATE_STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          const dim = !done && !active;
          const ts = timestamps[step.state];
          return (
            <div key={step.state} className="relative mb-5">
              {/* dot */}
              <div
                className="absolute -left-[18px] md:-left-[22px] top-1 w-2 h-2 rounded-full"
                style={{
                  background: done
                    ? "var(--success)"
                    : active
                    ? "var(--accent)"
                    : "var(--bg-card)",
                  border: `2px solid ${
                    done
                      ? "var(--success)"
                      : active
                      ? "var(--accent)"
                      : "var(--border)"
                  }`,
                  boxShadow: active ? "0 0 12px var(--accent-glow)" : "none",
                  transition: "all 200ms",
                }}
              />
              <div style={{ opacity: dim ? 0.4 : 1 }}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  {ts !== undefined && (
                    <span
                      className="text-[0.6rem] tracking-[0.1em]"
                      style={{ color: "var(--text-muted)", minWidth: 48 }}
                    >
                      +{(ts / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span
                    className="font-display text-[0.95rem]"
                    style={{
                      color: done || active ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {step.label}
                  </span>
                  {active && <BlinkingDot />}
                </div>
                {step.sub && (
                  <div
                    className="text-[0.65rem] mt-0.5 font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {step.sub}
                  </div>
                )}
                {/* Contextual payloads per step */}
                <StepPayload step={step.state} view={view} preset={preset} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolved callout */}
      {view.state === "resolved" && (
        <ResolvedCallout view={view} setView={setView} preset={preset} />
      )}

      {view.state === "error" && (
        <div
          className="mt-4 p-3 text-xs font-mono"
          style={{
            background: "rgba(231, 76, 60, 0.08)",
            border: "1px solid rgba(231, 76, 60, 0.2)",
            color: "var(--danger)",
          }}
        >
          {view.error || "Unknown error"}
        </div>
      )}

      {isTerminal && (
        <button className="btn-primary w-full mt-5" onClick={onReset}>
          ▸ Run another battle
        </button>
      )}
    </div>
  );
}

function BlinkingDot() {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full caret-blink"
      style={{ background: "var(--accent)" }}
    />
  );
}

function StepPayload({
  step,
  view,
  preset,
}: {
  step: BattleState;
  view: BattleView;
  preset: (typeof SAMPLE_CONTEXTS)[keyof typeof SAMPLE_CONTEXTS] | undefined;
}) {
  // Only render a payload once we have the data for the step.
  if (step === "deriving_a" && view.derivedA) {
    return (
      <DerivedPriceRow
        role={preset?.roles.a ?? "Party A"}
        value={view.derivedA}
        unit={preset?.unit ?? "USD"}
      />
    );
  }
  if (step === "deriving_b" && view.derivedB) {
    return (
      <DerivedPriceRow
        role={preset?.roles.b ?? "Party B"}
        value={view.derivedB}
        unit={preset?.unit ?? "USD"}
      />
    );
  }
  if (step === "creating_room" && view.roomAddress) {
    return <HashRow label="room" hash={view.roomAddress} />;
  }
  if (step === "submitted_a" && view.txHashA) {
    return <HashRow label="tx" hash={view.txHashA} />;
  }
  if (step === "resolved" && view.txHashB) {
    return <HashRow label="tx" hash={view.txHashB} />;
  }
  return null;
}

function DerivedPriceRow({
  role,
  value,
  unit,
}: {
  role: string;
  value: string;
  unit: string;
}) {
  const counted = useCountUp(value);
  return (
    <div
      className="mt-2 inline-flex items-baseline gap-2 px-3 py-1.5"
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="text-[0.6rem] tracking-[0.1em] uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {role}
      </span>
      <span
        className="font-mono text-base tabular-nums"
        style={{ color: "var(--accent)", fontWeight: 600 }}
      >
        {Number(counted).toLocaleString()}
      </span>
      <span
        className="text-[0.6rem] tracking-[0.08em]"
        style={{ color: "var(--text-muted)" }}
      >
        {unit}
      </span>
    </div>
  );
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  const explorer =
    label === "tx"
      ? `https://sepolia.arbiscan.io/tx/${hash}`
      : `https://sepolia.arbiscan.io/address/${hash}`;
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span
        className="text-[0.55rem] tracking-[0.15em] uppercase px-1.5 py-0.5"
        style={{
          background: "var(--bg-primary)",
          color: "var(--accent-dim)",
          border: "1px solid var(--border)",
        }}
      >
        {label}
      </span>
      <a
        href={explorer}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[0.7rem] break-all underline-offset-2 hover:underline"
        style={{ color: "var(--accent)" }}
      >
        {hash}
      </a>
    </div>
  );
}

function ResolvedCallout({
  view,
  setView,
  preset,
}: {
  view: BattleView;
  setView: React.Dispatch<React.SetStateAction<BattleView | null>>;
  preset: (typeof SAMPLE_CONTEXTS)[keyof typeof SAMPLE_CONTEXTS] | undefined;
}) {
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const derivedA = view.derivedA ? Number(view.derivedA) : null;
  const derivedB = view.derivedB ? Number(view.derivedB) : null;
  const zopaExistsProjected =
    derivedA !== null && derivedB !== null && derivedA <= derivedB;
  const projectedMidpoint =
    zopaExistsProjected && derivedA !== null && derivedB !== null
      ? Math.floor((derivedA + derivedB) / 2)
      : null;

  const settled = !!view.publishTxHash;
  const onChainSplit = view.revealedSplit ? Number(view.revealedSplit) : null;
  const dealExists = settled ? !!view.dealExists : zopaExistsProjected;
  const displayedValue = settled ? onChainSplit : projectedMidpoint;

  const handleReveal = async () => {
    if (!view.roomAddress) return;
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await revealBattleOnChain(view.roomAddress);
      setView((prev) =>
        prev
          ? {
              ...prev,
              publishTxHash: res.txHash,
              dealExists: res.dealExists,
              revealedSplit: res.revealedSplit,
            }
          : prev
      );
    } catch (err) {
      setRevealError((err as Error).message);
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div
      className="mt-8 p-6 md:p-8 animate-vault card-bracket"
      style={{
        background:
          "linear-gradient(135deg, rgba(201,162,39,0.08) 0%, transparent 70%), var(--bg-secondary)",
        border: `1px solid ${settled ? "var(--accent)" : "var(--accent-dim)"}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: settled ? "var(--accent)" : "var(--success)",
            boxShadow: settled ? "0 0 8px var(--accent-glow)" : "none",
          }}
        />
        <span
          className="label-tag"
          style={{ color: settled ? "var(--accent)" : "var(--success)" }}
        >
          {settled
            ? "Settled on-chain · threshold-decrypted"
            : "Vault closed · resolved on ciphertexts"}
        </span>
      </div>

      {dealExists && displayedValue !== null ? (
        <>
          <div
            className="font-display text-[2.2rem] md:text-[2.8rem] leading-tight glow-text"
            style={{ color: "var(--accent)" }}
          >
            ${displayedValue.toLocaleString()}
          </div>
          <div
            className="text-[0.7rem] mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {settled ? (
              <>
                confirmed on-chain · emitted by{" "}
                <code style={{ color: "var(--accent-dim)" }}>DealFound</code>
              </>
            ) : (
              <>
                projected settlement · weight 50/50 · still sealed as{" "}
                <code style={{ color: "var(--accent-dim)" }}>euint64</code>
              </>
            )}
          </div>
        </>
      ) : (
        <div
          className="font-display text-xl"
          style={{ color: "var(--danger)" }}
        >
          No ZOPA · neither agent learns how far apart they were
        </div>
      )}

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6"
        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
      >
        <Stat
          label={`${preset?.roles.a ?? "Party A"} floor`}
          value={view.derivedA ? Number(view.derivedA).toLocaleString() : "—"}
          unit={preset?.unit ?? ""}
        />
        <Stat
          label={`${preset?.roles.b ?? "Party B"} ceiling`}
          value={view.derivedB ? Number(view.derivedB).toLocaleString() : "—"}
          unit={preset?.unit ?? ""}
        />
        <Stat
          label="ZOPA width"
          value={
            zopaExistsProjected && derivedA !== null && derivedB !== null
              ? (derivedB - derivedA).toLocaleString()
              : "0"
          }
          unit={preset?.unit ?? ""}
        />
      </div>

      {settled && view.publishTxHash ? (
        <div className="mt-5">
          <HashRow label="publishResults" hash={view.publishTxHash} />
          <div
            className="mt-3 text-[0.65rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Threshold-decrypted by the CoFHE coprocessor, verified by{" "}
            <code style={{ color: "var(--accent-dim)" }}>
              FHE.publishDecryptResult()
            </code>
            . The individual reservation prices ($
            {derivedA?.toLocaleString()} floor · ${derivedB?.toLocaleString()}{" "}
            ceiling) never touched the chain.
          </div>
        </div>
      ) : (
        <>
          <div
            className="mt-5 text-[0.65rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Plaintexts stayed off-chain. Only the encrypted midpoint + encrypted
            ZOPA bool were written. Click below to call{" "}
            <code style={{ color: "var(--accent-dim)" }}>publishResults()</code>{" "}
            and reveal the settlement on-chain.
          </div>
          <button
            className="btn-primary w-full mt-4"
            onClick={handleReveal}
            disabled={revealing || !zopaExistsProjected}
            style={{ letterSpacing: "0.2em" }}
          >
            {revealing
              ? "Threshold-decrypting..."
              : zopaExistsProjected
              ? "▸ Reveal on-chain"
              : "No ZOPA — nothing to reveal"}
          </button>
          {revealError && (
            <div
              className="mt-3 p-3 text-xs font-mono"
              style={{
                background: "rgba(231, 76, 60, 0.08)",
                border: "1px solid rgba(231, 76, 60, 0.2)",
                color: "var(--danger)",
              }}
            >
              {revealError}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div
      className="p-3"
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="label-tag mb-1">{label}</div>
      <div
        className="font-mono tabular-nums text-base"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      <div className="text-[0.6rem]" style={{ color: "var(--text-muted)" }}>
        {unit}
      </div>
    </div>
  );
}

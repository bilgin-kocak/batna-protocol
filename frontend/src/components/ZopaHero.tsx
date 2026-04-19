"use client";

/**
 * ZopaHero — animated hero visual.
 *
 * Two encrypted reservation ranges slide in from opposite edges. When they
 * overlap, the intersection (the ZOPA) emerges in gold. Infinite CSS loop —
 * no JS, no state, no bundle cost beyond the SVG.
 */
export function ZopaHero() {
  return (
    <section
      className="relative overflow-hidden card-bracket animate-fade-up"
      style={{
        background: "linear-gradient(180deg, rgba(201,162,39,0.02) 0%, transparent 60%), var(--bg-card)",
        border: "1px solid var(--border)",
        minHeight: 320,
      }}
    >
      {/* Diagonal corner axis labels */}
      <div
        className="absolute top-3 left-4 label-tag"
        style={{ color: "var(--accent-dim)", zIndex: 2 }}
      >
        BATNA / 001 · FHENIX COFHE
      </div>
      <div
        className="absolute top-3 right-4 label-tag caret-blink"
        style={{ color: "var(--accent)", zIndex: 2, borderRight: "6px solid" }}
      >
        LIVE&nbsp;
      </div>

      <div className="relative px-8 pt-14 pb-10 md:px-14 md:pt-16 md:pb-12">
        {/* Headline */}
        <h1
          className="font-display text-[2.4rem] md:text-[3.2rem] leading-[1.05] mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Whoever reveals
          <br />
          <span
            className="italic font-display"
            style={{ color: "var(--accent)" }}
          >
            first
          </span>{" "}
          loses.
        </h1>
        <p
          className="text-sm md:text-[0.95rem] max-w-xl mt-4 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Two parties submit encrypted reservation prices. FHE finds the zone
          of possible agreement <em className="font-display not-italic" style={{ color: "var(--accent)" }}>on the ciphertexts</em>.
          Only the settlement is revealed. Neither number ever leaks.
        </p>

        {/* ZOPA diagram */}
        <div className="mt-10">
          <ZopaDiagram />
        </div>
      </div>
    </section>
  );
}

function ZopaDiagram() {
  // Layout:
  //   ── number axis (180 ─ 120) from left to right, 800 viewBox ──
  //   row A (floor):    [===== 130k reserved ======]->
  //   row B (ceiling):                  <-[===== reserved 145k =====]
  //   zopa glow:                            [ ZOPA ]  ← emerges where they overlap
  //
  // Units chosen so A slides right, B slides left, and the overlap sits center.
  return (
    <svg
      viewBox="0 0 800 160"
      width="100%"
      className="block"
      style={{ maxHeight: 220 }}
      aria-hidden
    >
      {/* axis */}
      <line x1="40" y1="130" x2="760" y2="130" stroke="var(--border)" strokeWidth="1" />
      {[120, 130, 140, 150, 160, 170].map((v, i) => (
        <g key={v}>
          <line
            x1={40 + i * (720 / 5)}
            y1="126"
            x2={40 + i * (720 / 5)}
            y2="134"
            stroke="var(--text-muted)"
            strokeWidth="1"
          />
          <text
            x={40 + i * (720 / 5)}
            y="148"
            fontSize="10"
            fill="var(--text-muted)"
            textAnchor="middle"
            fontFamily="var(--font-geist-mono), monospace"
          >
            ${v}K
          </text>
        </g>
      ))}

      {/* Party A range (floor → upper) — slides in from left */}
      <g className="animate-slide-a" style={{ transformOrigin: "0 0" }}>
        <rect
          x="40"
          y="40"
          width="320"
          height="16"
          fill="url(#gradA)"
          stroke="var(--accent-dim)"
          strokeWidth="1"
          rx="1"
        />
        <text
          x="48"
          y="30"
          fontSize="11"
          fill="var(--text-secondary)"
          fontFamily="var(--font-geist-mono), monospace"
        >
          Party A floor →
        </text>
        <text
          x="48"
          y="52"
          fontSize="10"
          fill="var(--bg-primary)"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="600"
        >
          encrypted · euint64
        </text>
      </g>

      {/* Party B range (ceiling → lower) — slides in from right */}
      <g className="animate-slide-b" style={{ transformOrigin: "800px 0" }}>
        <rect
          x="320"
          y="78"
          width="440"
          height="16"
          fill="url(#gradB)"
          stroke="var(--accent-dim)"
          strokeWidth="1"
          rx="1"
        />
        <text
          x="752"
          y="70"
          fontSize="11"
          fill="var(--text-secondary)"
          fontFamily="var(--font-geist-mono), monospace"
          textAnchor="end"
        >
          ← Party B ceiling
        </text>
        <text
          x="752"
          y="90"
          fontSize="10"
          fill="var(--bg-primary)"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="600"
          textAnchor="end"
        >
          encrypted · euint64
        </text>
      </g>

      {/* ZOPA overlap — emerges after both ranges settle */}
      <g className="animate-zopa-glow">
        <rect
          x="320"
          y="40"
          width="40"
          height="54"
          fill="var(--accent)"
          opacity="0.22"
        />
        <rect
          x="320"
          y="40"
          width="40"
          height="54"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <text
          x="340"
          y="108"
          fontSize="10"
          fill="var(--accent)"
          textAnchor="middle"
          fontFamily="var(--font-display), Georgia, serif"
          fontStyle="italic"
          fontWeight="600"
        >
          ZOPA
        </text>
      </g>

      <defs>
        <linearGradient id="gradA" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent-dim)" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="gradB" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent-dim)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

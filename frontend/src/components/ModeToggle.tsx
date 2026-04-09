"use client";

export type NegotiationMode = "manual" | "solo-agent";

interface ModeToggleProps {
  value: NegotiationMode;
  onChange: (mode: NegotiationMode) => void;
}

const MODES: { id: NegotiationMode; label: string; description: string }[] = [
  {
    id: "manual",
    label: "Manual",
    description: "Type your own reservation price",
  },
  {
    id: "solo-agent",
    label: "Solo Agent",
    description: "Claude derives the price from context",
  },
];

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      className="flex gap-0 mb-4"
      style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}
    >
      {MODES.map((mode, i) => {
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className="flex-1 px-4 py-3 text-left transition-colors"
            style={{
              background: active ? "var(--bg-primary)" : "transparent",
              borderLeft: i > 0 ? "1px solid var(--border)" : "none",
              cursor: "pointer",
            }}
          >
            <div
              className="label-tag mb-0.5"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {mode.label}
            </div>
            <div className="text-[0.65rem]" style={{ color: "var(--text-muted)" }}>
              {mode.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}

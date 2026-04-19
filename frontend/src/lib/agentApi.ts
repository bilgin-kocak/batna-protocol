/**
 * Typed client for the BATNA agent API routes.
 */

export interface DeriveResponse {
  price: string;
  attempts: number;
  rawResponse: string;
  template: string;
}

export async function deriveAgentPrice(args: {
  negotiationType: number;
  role: "partyA" | "partyB";
  context: string;
  currency?: string;
}): Promise<DeriveResponse> {
  const res = await fetch("/api/agent/derive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `derive failed (HTTP ${res.status})`);
  }

  return (await res.json()) as DeriveResponse;
}

export type BattleState =
  | "initializing"
  | "deriving_a"
  | "deriving_b"
  | "creating_room"
  | "encrypting_a"
  | "encrypting_b"
  | "submitted_a"
  | "submitted_b"
  | "resolved"
  | "error";

/**
 * A single frame of battle progress emitted by the streaming /start endpoint.
 * All optional fields accumulate — each event is a full snapshot of current state.
 */
export interface BattleEvent {
  state: BattleState;
  roomAddress?: string;
  txHashA?: string;
  txHashB?: string;
  derivedA?: string;
  derivedB?: string;
  error?: string;
}

/**
 * Starts a two-agent battle and returns an async iterator of progress events.
 *
 * Uses NDJSON streaming: each newline-separated JSON line is one BattleEvent.
 * The server keeps the Lambda alive until the stream closes, so all phases
 * happen inside a single request — no session store, no polling.
 */
export async function* streamTwoAgentBattle(args: {
  negotiationType: number;
  contextA: string;
  contextB: string;
  weightA?: number;
  currency?: string;
}): AsyncGenerator<BattleEvent, void, void> {
  const res = await fetch("/api/demo/two-agents/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `start failed (HTTP ${res.status})`);
  }
  if (!res.body) {
    throw new Error("Response has no body — streaming unsupported in this browser");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines; keep the last (potentially partial) line in the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as BattleEvent;
        } catch {
          // skip malformed lines defensively
        }
      }
    }
    // flush final buffered chunk
    const tail = buffer.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as BattleEvent;
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface RevealResponse {
  txHash: string;
  dealExists: boolean;
  revealedSplit: string;
  alreadyPublished?: boolean;
}

export async function revealBattleOnChain(roomAddress: string): Promise<RevealResponse> {
  const res = await fetch(`/api/demo/two-agents/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `reveal failed (HTTP ${res.status})`);
  }
  return (await res.json()) as RevealResponse;
}

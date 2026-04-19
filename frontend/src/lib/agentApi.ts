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

export interface BattleSession {
  id: string;
  createdAt: number;
  state: BattleState;
  roomAddress?: string;
  txHashA?: string;
  txHashB?: string;
  derivedA?: string;
  derivedB?: string;
  rawResponseA?: string;
  rawResponseB?: string;
  error?: string;
  // Populated by the reveal endpoint
  revealing?: boolean;
  revealError?: string;
  publishTxHash?: string;
  revealedSplit?: string;
  dealExists?: boolean;
}

export async function startTwoAgentBattle(args: {
  negotiationType: number;
  contextA: string;
  contextB: string;
  weightA?: number;
  currency?: string;
}): Promise<{ sessionId: string }> {
  const res = await fetch("/api/demo/two-agents/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `start failed (HTTP ${res.status})`);
  }

  return (await res.json()) as { sessionId: string };
}

export async function getBattleStatus(sessionId: string): Promise<BattleSession> {
  const res = await fetch(`/api/demo/two-agents/status/${sessionId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `status failed (HTTP ${res.status})`);
  }

  return (await res.json()) as BattleSession;
}

export interface RevealResponse {
  txHash: string;
  dealExists: boolean | null;
  revealedSplit: string | null;
  cached?: boolean;
}

export async function revealBattleOnChain(sessionId: string): Promise<RevealResponse> {
  const res = await fetch(`/api/demo/two-agents/reveal/${sessionId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `reveal failed (HTTP ${res.status})`);
  }
  return (await res.json()) as RevealResponse;
}

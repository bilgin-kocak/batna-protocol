/**
 * Lightweight session store shared between start + status routes.
 *
 * Kept in its own file (no CoFHE / ethers imports) so the status route stays
 * tiny and doesn't drag the WASM-heavy CoFHE Node SDK into its bundle.
 */

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

  // Populated once the session-holder hits "Reveal on-chain" and the server
  // threshold-decrypts + calls publishResults(). Until then dealExists +
  // revealedSplit are still sealed as euint64/ebool on-chain.
  revealing?: boolean;
  revealError?: string;
  publishTxHash?: string;
  revealedSplit?: string;
  dealExists?: boolean;
}

// Single in-memory map shared by start + status routes (server-only).
const SESSIONS: Map<string, BattleSession> =
  ((globalThis as unknown) as { __BATNA_BATTLE_SESSIONS__?: Map<string, BattleSession> })
    .__BATNA_BATTLE_SESSIONS__ || new Map<string, BattleSession>();
((globalThis as unknown) as { __BATNA_BATTLE_SESSIONS__?: Map<string, BattleSession> })
  .__BATNA_BATTLE_SESSIONS__ = SESSIONS;

export function newSession(): BattleSession {
  const id = `batna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: BattleSession = {
    id,
    createdAt: Date.now(),
    state: "initializing",
  };
  SESSIONS.set(id, session);
  return session;
}

export function updateSession(id: string, patch: Partial<BattleSession>): BattleSession | undefined {
  const existing = SESSIONS.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  SESSIONS.set(id, updated);
  return updated;
}

export function getSession(id: string): BattleSession | undefined {
  return SESSIONS.get(id);
}

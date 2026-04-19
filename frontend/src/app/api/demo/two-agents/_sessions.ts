/**
 * Battle state type definitions shared between the streaming /start route
 * and any tooling that consumes BattleEvent.
 *
 * NOTE: the old in-memory session store (globalThis Map) was removed because
 * it doesn't work on Vercel (each request may hit a fresh Lambda). The battle
 * now streams end-to-end inside a single request.
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

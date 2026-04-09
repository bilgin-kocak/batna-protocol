/**
 * BATNA Agent — shared types
 *
 * Mirrors the on-chain NegotiationType enum in NegotiationRoom.sol so the agent
 * module is self-contained and can be used from Hardhat tasks, Next.js API
 * routes, or future SDK consumers without depending on typechain output.
 */

export enum NegotiationType {
  GENERIC = 0,
  SALARY = 1,
  OTC = 2,
  MA = 3,
}

export type AgentRole = "partyA" | "partyB";

export interface PromptInput {
  /** Which side of the deal the agent is acting for. */
  role: AgentRole;
  /** Free-form context the human provided (job description, deal memo, etc.). */
  context: string;
  /** Currency / unit label for the response. Defaults to "USD". */
  currency?: string;
}

/**
 * A negotiation template knows how to translate free-form context into an
 * encrypted reservation price.
 */
export interface Template {
  /** Matches the on-chain NegotiationType enum value. */
  id: NegotiationType;
  /** Short human label, e.g., "Salary". */
  name: string;
  /** One-line description of when this template applies. */
  description: string;
  /** Builds the Claude prompt from a PromptInput. */
  buildPrompt(input: PromptInput): string;
  /** Extracts a non-negative integer reservation price from Claude's text. */
  parseResponse(text: string): bigint;
  /** Canonical example used for the demo + the unit tests. */
  example: PromptInput;
}

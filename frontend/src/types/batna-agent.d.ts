/**
 * Type declarations for the BATNA agent SDK.
 *
 * The actual implementation lives in `../agent/` at the repo root and is
 * resolved at runtime via the webpack alias in `next.config.mjs`. This file
 * lets TypeScript see the public surface without needing to type-check the
 * agent source files (which depend on packages whose only install lives in
 * `frontend/node_modules`).
 */
declare module "@batna/agent" {
  export enum NegotiationType {
    GENERIC = 0,
    SALARY = 1,
    OTC = 2,
    MA = 3,
  }

  export type AgentRole = "partyA" | "partyB";

  export interface PromptInput {
    role: AgentRole;
    context: string;
    currency?: string;
  }

  export interface Template {
    id: NegotiationType;
    name: string;
    description: string;
    buildPrompt(input: PromptInput): string;
    parseResponse(text: string): bigint;
    example: PromptInput;
  }

  export interface AnthropicLike {
    messages: {
      create(args: {
        model: string;
        max_tokens: number;
        messages: { role: "user" | "assistant"; content: string }[];
      }): Promise<{
        content: Array<{ type: string; text?: string }>;
      }>;
    };
  }

  export interface DerivePriceArgs {
    template: Template;
    role: AgentRole;
    context: string;
    currency?: string;
    client?: AnthropicLike;
    model?: string;
  }

  export interface DerivePriceResult {
    price: bigint;
    prompt: string;
    rawResponse: string;
    attempts: number;
  }

  export function derivePrice(args: DerivePriceArgs): Promise<DerivePriceResult>;

  export interface CofheClientLike {
    encryptInputs(items: unknown[]): { execute(): Promise<unknown[]> };
  }

  export interface NegotiationRoomLike {
    connect(signer: unknown): {
      submitReservation(encrypted: unknown): Promise<{
        wait(): Promise<{ hash: string } | null>;
      }>;
      submitReservationAsAgent(
        encrypted: unknown,
        agent: string
      ): Promise<{ wait(): Promise<{ hash: string } | null> }>;
    };
  }

  export interface EncryptSubmitArgs {
    room: NegotiationRoomLike;
    signer: unknown;
    derivedPrice: bigint;
    cofheClient: CofheClientLike;
    agentAddress?: string;
  }

  export interface EncryptSubmitResult {
    txHash: string;
    encrypted: unknown;
  }

  export function encryptSubmit(args: EncryptSubmitArgs): Promise<EncryptSubmitResult>;

  export const salaryTemplate: Template;
  export const otcTemplate: Template;
  export const maTemplate: Template;

  export const TEMPLATE_REGISTRY: Record<NegotiationType, Template | undefined>;
  export function getTemplate(type: NegotiationType): Template;

  export function parseFirstInteger(text: string): bigint;
}

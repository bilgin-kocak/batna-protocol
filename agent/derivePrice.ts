import type { AgentRole, Template } from "./types";

/**
 * Minimal interface that the Anthropic SDK satisfies. Defining it here lets
 * tests inject a deterministic mock without dragging the real SDK into CI.
 */
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
  /** Inject a mock for tests. Defaults to a real Anthropic client. */
  client?: AnthropicLike;
  /** Defaults to claude-opus-4-6 (the most capable Claude model). */
  model?: string;
}

export interface DerivePriceResult {
  price: bigint;
  prompt: string;
  rawResponse: string;
  attempts: number;
}

const DEFAULT_MODEL = "claude-opus-4-6";

let cachedDefaultClient: AnthropicLike | null = null;

/**
 * Lazily constructs a real Anthropic client. Pulled out of the hot path so
 * tests that always inject a mock never touch process.env.
 */
function getDefaultClient(): AnthropicLike {
  if (cachedDefaultClient) return cachedDefaultClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "derivePrice: ANTHROPIC_API_KEY not set. Inject a `client` for tests or set the env var."
    );
  }

  // Lazy import so tests don't need the SDK loaded
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Anthropic = require("@anthropic-ai/sdk");
  cachedDefaultClient = new Anthropic.default({ apiKey });
  return cachedDefaultClient!;
}

/**
 * Calls Claude with the template's prompt and parses the result back into a
 * bigint reservation price. Retries once on parse failure, then throws.
 */
export async function derivePrice(args: DerivePriceArgs): Promise<DerivePriceResult> {
  const client = args.client ?? getDefaultClient();
  const model = args.model ?? DEFAULT_MODEL;

  const prompt = args.template.buildPrompt({
    role: args.role,
    context: args.context,
    currency: args.currency,
  });

  let lastError: unknown;
  let lastRaw = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 50,
        messages: [{ role: "user", content: prompt }],
      });

      const text = extractText(response);
      lastRaw = text;
      const price = args.template.parseResponse(text);

      return {
        price,
        prompt,
        rawResponse: text,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `derivePrice: failed after 2 attempts. last raw="${lastRaw}". last error=${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  if (!response?.content?.length) {
    throw new Error("derivePrice: empty response.content");
  }
  const block = response.content.find((b) => b.type === "text" && typeof b.text === "string");
  if (!block || !block.text) {
    throw new Error("derivePrice: no text block in response");
  }
  return block.text;
}

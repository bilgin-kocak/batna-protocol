import { expect } from "chai";
import {
  derivePrice,
  salaryTemplate,
  otcTemplate,
  type AnthropicLike,
} from "../../agent";

/**
 * Build a deterministic mock Anthropic client.
 *
 * `responses` is replayed in order; if exhausted, throws (so we can assert
 * exactly how many calls happened).
 */
function mockAnthropic(responses: string[]): {
  client: AnthropicLike;
  callCount: () => number;
  lastPrompt: () => string | undefined;
} {
  let calls = 0;
  let lastPrompt: string | undefined;
  const client: AnthropicLike = {
    messages: {
      async create({ messages }) {
        if (calls >= responses.length) {
          throw new Error(`mockAnthropic: out of responses (call #${calls + 1})`);
        }
        lastPrompt = messages[0].content;
        const text = responses[calls];
        calls++;
        return { content: [{ type: "text", text }] };
      },
    },
  };
  return {
    client,
    callCount: () => calls,
    lastPrompt: () => lastPrompt,
  };
}

describe("agent/derivePrice", function () {
  it("returns parsed bigint when Anthropic returns a valid number", async function () {
    const { client, callCount } = mockAnthropic(["142000"]);

    const result = await derivePrice({
      template: salaryTemplate,
      role: "partyA",
      context: "Senior engineer in NYC",
      client,
    });

    expect(result.price).to.equal(142000n);
    expect(result.attempts).to.equal(1);
    expect(callCount()).to.equal(1);
  });

  it("strips commas / currency symbols via the template parser", async function () {
    const { client } = mockAnthropic(["$142,000"]);

    const result = await derivePrice({
      template: salaryTemplate,
      role: "partyA",
      context: "x",
      client,
    });

    expect(result.price).to.equal(142000n);
  });

  it("retries once when first response is unparsable, then succeeds", async function () {
    const { client, callCount } = mockAnthropic(["nope, no idea", "137500"]);

    const result = await derivePrice({
      template: salaryTemplate,
      role: "partyA",
      context: "x",
      client,
    });

    expect(result.price).to.equal(137500n);
    expect(result.attempts).to.equal(2);
    expect(callCount()).to.equal(2);
  });

  it("throws after 2 failed attempts", async function () {
    const { client, callCount } = mockAnthropic(["garbage one", "garbage two"]);

    let threw = false;
    try {
      await derivePrice({
        template: salaryTemplate,
        role: "partyA",
        context: "x",
        client,
      });
    } catch (err) {
      threw = true;
      expect((err as Error).message).to.match(/failed after 2 attempts/);
    }
    expect(threw).to.be.true;
    expect(callCount()).to.equal(2);
  });

  it("passes the template-built prompt verbatim to Anthropic", async function () {
    const { client, lastPrompt } = mockAnthropic(["100"]);

    await derivePrice({
      template: otcTemplate,
      role: "partyB",
      context: "Buyer wants 5,000 ETH for treasury hedge",
      currency: "USD cents per ETH",
      client,
    });

    expect(lastPrompt()).to.include("Buyer wants 5,000 ETH for treasury hedge");
    expect(lastPrompt()).to.match(/BUYER/);
    expect(lastPrompt()).to.match(/CENTS/i);
  });
});

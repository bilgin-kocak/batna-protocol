import { NegotiationType, type Template } from "../types";
import { parseFirstInteger } from "../parseInteger";

/**
 * OTC trade template.
 *
 * partyA = seller (submits MINIMUM unit price they will accept)
 * partyB = buyer  (submits MAXIMUM unit price they will pay)
 *
 * The reservation prices are quoted in basis units (e.g. cents per token, or
 * USD per ETH × 100 to keep euint64-precision without floats).
 */
export const otcTemplate: Template = {
  id: NegotiationType.OTC,
  name: "OTC",
  description:
    "Over-the-counter token trade: seller floor vs buyer ceiling on unit price.",

  buildPrompt({ role, context, currency = "USD" }) {
    const sideInstruction =
      role === "partyA"
        ? "You are advising the SELLER. Derive the MINIMUM unit price (in cents, integer) they will accept (their reservation floor)."
        : "You are advising the BUYER. Derive the MAXIMUM unit price (in cents, integer) they will pay (their reservation ceiling).";

    return [
      "You are an institutional OTC desk strategist.",
      sideInstruction,
      "Account for current spot, implied volatility, slippage on the equivalent on-chain trade, counterparty risk, and the deal size in the context.",
      "Quote the reservation price in INTEGER " + currency + " CENTS per unit (multiply dollars by 100 — this is so the contract can use euint64 without floats).",
      "Respond with ONLY a single integer (no commas, no symbols, no prose). Example: 245750",
      "",
      "CONTEXT:",
      context,
    ].join("\n");
  },

  parseResponse(text) {
    return parseFirstInteger(text);
  },

  example: {
    role: "partyA",
    context:
      "Seller has 2,500 ETH to offload. Spot is ~$2,450. Buyer is a regulated market-maker. Trade must settle within 24h. Acceptable slippage from spot mid: 50 bps.",
    currency: "USD cents per ETH",
  },
};

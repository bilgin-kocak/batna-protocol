import { NegotiationType, type Template } from "../types";
import { parseFirstInteger } from "../parseInteger";

/**
 * M&A acquisition price template.
 *
 * partyA = seller's board (submits MINIMUM acquisition price they will accept)
 * partyB = acquirer       (submits MAXIMUM acquisition price they will pay)
 *
 * Prices are denominated in millions of USD (integer) so they fit cleanly in
 * euint64 — see the prompt instruction.
 */
export const maTemplate: Template = {
  id: NegotiationType.MA,
  name: "M&A",
  description:
    "Acquisition price negotiation: seller board floor vs acquirer ceiling.",

  buildPrompt({ role, context, currency = "USD" }) {
    const sideInstruction =
      role === "partyA"
        ? "You are advising the SELLER'S BOARD. Derive the MINIMUM acquisition price (in MILLIONS of " + currency + ", integer) they will accept."
        : "You are advising the ACQUIRER. Derive the MAXIMUM acquisition price (in MILLIONS of " + currency + ", integer) they are willing to pay.";

    return [
      "You are an experienced M&A banker advising on a confidential acquisition price.",
      sideInstruction,
      "Use revenue, growth rate, comparable transactions, strategic premium, synergies, and the deal context to anchor your number.",
      "Quote the price in INTEGER MILLIONS of " + currency + " (a $250M deal = 250). This keeps the value inside euint64 with no floats.",
      "Respond with ONLY a single integer (no commas, no symbols, no prose). Example: 480",
      "",
      "CONTEXT:",
      context,
    ].join("\n");
  },

  parseResponse(text) {
    return parseFirstInteger(text);
  },

  example: {
    role: "partyB",
    context:
      "Target: B2B SaaS, $42M ARR, 60% YoY growth, 110% NRR, profitable. Comparable acquisitions trading at 12-18x ARR. Strategic acquirer can realize $80M of synergies over 3 years.",
    currency: "USD",
  },
};

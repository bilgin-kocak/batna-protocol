import { NegotiationType, type Template } from "../types";
import { parseFirstInteger } from "../parseInteger";

/**
 * Salary negotiation template.
 *
 * partyA = candidate (submits MINIMUM acceptable annual base)
 * partyB = employer  (submits MAXIMUM willing-to-pay annual base)
 */
export const salaryTemplate: Template = {
  id: NegotiationType.SALARY,
  name: "Salary",
  description:
    "Bilateral salary negotiation: candidate's reservation floor vs employer's willing ceiling.",

  buildPrompt({ role, context, currency = "USD" }) {
    const sideInstruction =
      role === "partyA"
        ? "You are advising the CANDIDATE. Derive the MINIMUM annual base salary they should accept (the absolute floor below which they walk)."
        : "You are advising the EMPLOYER. Derive the MAXIMUM annual base salary they are willing to pay (the absolute ceiling above which they walk).";

    return [
      "You are an expert compensation negotiator.",
      sideInstruction,
      "Use market data, role seniority, location, and the context provided.",
      "Respond with ONLY a single integer in " + currency + " (no commas, no symbols, no prose). Example: 142000",
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
      "Senior backend engineer, 6 years experience (3 at FAANG), Bay Area, currently earning $148K base + $40K equity. Has a competing offer at $165K base.",
    currency: "USD",
  },
};

/**
 * Parse the first non-negative integer out of a Claude response.
 *
 * Tolerates currency symbols, thousands separators, decimal points (truncates),
 * and prose like "I would set the floor at $130,000."
 *
 * Throws if no integer can be extracted.
 */
export function parseFirstInteger(text: string): bigint {
  if (!text) {
    throw new Error("parseFirstInteger: empty input");
  }

  // Strip common currency symbols and thousand separators that confuse \d+
  const normalized = text
    .replace(/[$€£¥₹]/g, "")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/(\d),(\d)/g, "$1$2"); // run twice for "1,000,000"

  const match = normalized.match(/(\d+)(?:\.\d+)?/);
  if (!match) {
    throw new Error(`parseFirstInteger: no number found in "${text}"`);
  }

  const value = BigInt(match[1]);
  if (value < 0n) {
    throw new Error(`parseFirstInteger: negative value "${match[1]}"`);
  }
  return value;
}

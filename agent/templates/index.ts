import { NegotiationType, type Template } from "../types";
import { salaryTemplate } from "./salary";
import { otcTemplate } from "./otc";
import { maTemplate } from "./ma";

export { salaryTemplate, otcTemplate, maTemplate };

/**
 * Registry of all available templates, keyed by NegotiationType enum value.
 * Adding a new template = drop a file + add it here.
 */
export const TEMPLATE_REGISTRY: Record<NegotiationType, Template | undefined> = {
  [NegotiationType.GENERIC]: undefined, // GENERIC has no canonical template
  [NegotiationType.SALARY]: salaryTemplate,
  [NegotiationType.OTC]: otcTemplate,
  [NegotiationType.MA]: maTemplate,
};

export function getTemplate(type: NegotiationType): Template {
  const template = TEMPLATE_REGISTRY[type];
  if (!template) {
    throw new Error(
      `No template registered for NegotiationType=${type}. Use SALARY, OTC, or MA.`
    );
  }
  return template;
}

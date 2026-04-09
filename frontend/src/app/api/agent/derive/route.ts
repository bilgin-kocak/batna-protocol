import { NextRequest, NextResponse } from "next/server";
import {
  derivePrice,
  getTemplate,
  NegotiationType,
  type AgentRole,
} from "@batna/agent";

// Use Node runtime so we can require @anthropic-ai/sdk
export const runtime = "nodejs";
// Disable static optimization — every call hits Claude
export const dynamic = "force-dynamic";

interface DeriveRequest {
  negotiationType: number;
  role: AgentRole;
  context: string;
  currency?: string;
}

function isValidRole(role: unknown): role is AgentRole {
  return role === "partyA" || role === "partyB";
}

function isValidNegotiationType(value: unknown): value is NegotiationType {
  return (
    typeof value === "number" &&
    value >= NegotiationType.GENERIC &&
    value <= NegotiationType.MA
  );
}

export async function POST(req: NextRequest) {
  let body: DeriveRequest;
  try {
    body = (await req.json()) as DeriveRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRole(body.role)) {
    return NextResponse.json(
      { error: "role must be 'partyA' or 'partyB'" },
      { status: 400 }
    );
  }

  if (!isValidNegotiationType(body.negotiationType)) {
    return NextResponse.json(
      { error: "negotiationType must be 0..3 (GENERIC|SALARY|OTC|MA)" },
      { status: 400 }
    );
  }

  if (!body.context || typeof body.context !== "string" || body.context.length > 4000) {
    return NextResponse.json(
      { error: "context must be a non-empty string under 4000 chars" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  let template;
  try {
    template = getTemplate(body.negotiationType);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  try {
    const result = await derivePrice({
      template,
      role: body.role,
      context: body.context,
      currency: body.currency,
    });

    return NextResponse.json({
      price: result.price.toString(),
      attempts: result.attempts,
      rawResponse: result.rawResponse,
      template: template.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

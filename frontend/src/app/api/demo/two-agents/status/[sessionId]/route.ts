import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../_sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: `Session ${params.sessionId} not found` },
      { status: 404 }
    );
  }
  return NextResponse.json(session);
}

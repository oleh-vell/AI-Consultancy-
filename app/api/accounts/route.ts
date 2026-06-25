import type { NextRequest } from "next/server";
import { getAccounts, promoteLead } from "@/lib/repo";
import type { DiscoveryAnswer, TranscriptLine } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/accounts — every promoted account, newest first. */
export async function GET() {
  try {
    return Response.json({ accounts: await getAccounts() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts  body: { leadId, answers, duration, summary?, transcript? }
 * Promotes a lead: persists the account with its deck, plus the verbatim call
 * transcript when supplied (otherwise a templated one is generated).
 * Returns { accountId }.
 */
export async function POST(request: NextRequest) {
  let body: {
    leadId?: string;
    answers?: DiscoveryAnswer[];
    duration?: string;
    summary?: string;
    transcript?: TranscriptLine[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.leadId || !Array.isArray(body.answers) || !body.duration) {
    return Response.json(
      { error: "leadId, answers[] and duration are required" },
      { status: 400 }
    );
  }

  try {
    const accountId = await promoteLead({
      leadId: body.leadId,
      answers: body.answers,
      duration: body.duration,
      summary: body.summary,
      transcript: Array.isArray(body.transcript) ? body.transcript : undefined,
    });
    return Response.json({ accountId }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Promotion failed" },
      { status: 500 }
    );
  }
}

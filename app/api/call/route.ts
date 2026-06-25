import type { NextRequest } from "next/server";
import {
  startOutboundCall,
  ElevenLabsConfigError,
} from "../../../lib/elevenlabs";

/**
 * POST /api/call
 * Body: { toNumber?, lead?: { company, industry, contact, ... } }
 *
 * Fires the ElevenLabs outbound call. The lead's fields are passed through as
 * dynamic_variables so the agent greets them by name / references their industry.
 * Returns { conversationId } — save it on the lead and poll /api/conversations/:id.
 */
export async function POST(request: NextRequest) {
  let body: {
    toNumber?: string;
    lead?: Record<string, string | undefined>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const toNumber = body.toNumber || process.env.DEMO_TO_NUMBER;
  if (!toNumber) {
    return Response.json(
      { error: "No toNumber provided and DEMO_TO_NUMBER is not set" },
      { status: 400 }
    );
  }

  const lead = body.lead ?? {};
  const dynamicVariables: Record<string, string> = {};
  if (lead.company) dynamicVariables.lead_name = lead.company;
  if (lead.industry) dynamicVariables.lead_industry = lead.industry;
  if (lead.contact) dynamicVariables.lead_contact = lead.contact;
  if (lead.role) dynamicVariables.lead_role = lead.role;

  try {
    const result = await startOutboundCall({
      toNumber,
      dynamicVariables:
        Object.keys(dynamicVariables).length > 0 ? dynamicVariables : undefined,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ElevenLabsConfigError) {
      return Response.json({ error: err.message, config: true }, { status: 503 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Call failed" },
      { status: 502 }
    );
  }
}

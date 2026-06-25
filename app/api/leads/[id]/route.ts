import type { NextRequest } from "next/server";
import { deleteLead, setLeadStatus } from "@/lib/repo";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: LeadStatus[] = ["queued", "calling", "completed", "promoted"];

/** PATCH /api/leads/:id  body: { status } — move a lead through its lifecycle. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/leads/[id]">
) {
  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status || !STATUSES.includes(body.status as LeadStatus)) {
    return Response.json(
      { error: `status must be one of ${STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const lead = await setLeadStatus(id, body.status as LeadStatus);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    return Response.json({ lead });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

/** DELETE /api/leads/:id — remove one lead from the queue. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/leads/[id]">
) {
  const { id } = await ctx.params;

  try {
    const deleted = await deleteLead(id);
    if (!deleted) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}

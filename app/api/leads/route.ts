import { getLeads } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET /api/leads — the lead queue, in call order. */
export async function GET() {
  try {
    return Response.json({ leads: await getLeads() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load leads" },
      { status: 500 }
    );
  }
}

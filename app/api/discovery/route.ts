import { getDiscovery } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET /api/discovery — the discovery script the agent runs on the call. */
export async function GET() {
  try {
    return Response.json({ discovery: await getDiscovery() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load discovery" },
      { status: 500 }
    );
  }
}

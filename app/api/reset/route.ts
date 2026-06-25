import { resetDemo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** POST /api/reset — clear accounts, return every lead to the queue. */
export async function POST() {
  try {
    await resetDemo();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}

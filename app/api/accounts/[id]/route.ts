import type { NextRequest } from "next/server";
import { getAccount } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET /api/accounts/:id — a single account with transcript, deck and invoice. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">
) {
  const { id } = await ctx.params;
  try {
    const account = await getAccount(id);
    if (!account)
      return Response.json({ error: "Account not found" }, { status: 404 });
    return Response.json({ account });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load account" },
      { status: 500 }
    );
  }
}

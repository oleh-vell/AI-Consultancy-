import type { NextRequest } from "next/server";
import { generateInvoice } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** POST /api/accounts/:id/invoice — generate (or regenerate) the invoice. */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]/invoice">
) {
  const { id } = await ctx.params;
  try {
    const invoice = await generateInvoice(id);
    return Response.json({ invoice }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invoice failed" },
      { status: 500 }
    );
  }
}

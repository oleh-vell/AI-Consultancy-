import type { NextRequest } from "next/server";
import {
  getConversation,
  ElevenLabsConfigError,
} from "../../../../lib/elevenlabs";

/**
 * GET /api/conversations/:id
 * Poll this until `done` is true, then promote the lead with `answers` + `duration`.
 * Returns the normalized conversation: { status, done, duration, answers, transcript, summary }.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]">
) {
  const { id } = await ctx.params;
  try {
    const convo = await getConversation(id);
    return Response.json(convo);
  } catch (err) {
    if (err instanceof ElevenLabsConfigError) {
      return Response.json({ error: err.message, config: true }, { status: 503 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 502 }
    );
  }
}

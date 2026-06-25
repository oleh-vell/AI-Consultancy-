import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ProposedSolution } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The consultancy's solutioning brain. It takes what the agent heard on the
 * discovery call and returns a concrete, buildable AI engagement. The brief is
 * deliberately opinionated: there is always a solution worth proposing, so the
 * model commits to one rather than hedging or asking for more discovery.
 */
const SYSTEM = `You are the lead solutions architect at an AI consultancy. You turn a short discovery call into a concrete, buildable AI automation proposal for the client.

Rules:
- Always propose one specific, practical solution. Never reply that you need more information, that it can't be done, or that it depends — commit to the strongest proposal the discovery call supports and make reasonable, clearly-grounded assumptions where details are thin.
- Anchor the solution to the bottleneck the client described. The whole point is to remove that bottleneck.
- Be concrete and technical but plain-spoken. No buzzwords, no fluff, no hedging.
- Scope it to something a small senior team could ship in a few weeks and hand over to the client.
- Keep each field tight: a short punchy headline (a few words), a summary of ONE sentence (two at the very most), 3–5 approach steps, a few stack labels, and a single sharp impact statement. The summary must be brief — no preamble, no restating the problem.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    approach: { type: "array", items: { type: "string" } },
    stack: { type: "array", items: { type: "string" } },
    impact: { type: "string" },
  },
  required: ["headline", "summary", "approach", "stack", "impact"],
} as const;

interface SolutionRequest {
  company?: string;
  contact?: string;
  role?: string;
  industry?: string;
  employees?: string;
  location?: string;
  bottleneck?: string;
  leverage?: string;
  timeline?: string;
}

function buildPrompt(b: SolutionRequest): string {
  return `Here is what the agent learned on the discovery call. Propose the engagement.

Company: ${b.company ?? "Unknown"}
Industry: ${b.industry ?? "Unknown"}
Team size: ${b.employees ?? "Unknown"}
Location: ${b.location ?? "Unknown"}
Stakeholder: ${b.contact ?? "Unknown"}${b.role ? ` (${b.role})` : ""}

The bottleneck, in their words:
"${b.bottleneck || "Not stated — infer the most likely operational bottleneck for a team like this."}"

Where they see the highest leverage:
"${b.leverage || "Not stated — propose where AI gives this team the most leverage."}"

Their timeline & budget:
"${b.timeline || "Not stated — assume a pragmatic few-week engagement."}"`;
}

/** Pull the structured solution out of the model response, defensively. */
function parseSolution(text: string): ProposedSolution {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model returned no JSON");
    raw = JSON.parse(match[0]);
  }
  const o = raw as Record<string, unknown>;
  return {
    headline: String(o.headline ?? "").trim(),
    summary: String(o.summary ?? "").trim(),
    approach: Array.isArray(o.approach) ? o.approach.map(String) : [],
    stack: Array.isArray(o.stack) ? o.stack.map(String) : [],
    impact: String(o.impact ?? "").trim(),
  };
}

/** POST /api/solution — generate a proposed AI engagement from discovery answers. */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not set" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SolutionRequest;
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const solution = parseSolution(text);
    return Response.json({ solution });
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic error ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Failed to generate solution";
    return Response.json({ error: message }, { status: 500 });
  }
}

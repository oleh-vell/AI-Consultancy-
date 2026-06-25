import { addLeads, deleteAllLeads, getLeads } from "@/lib/repo";
import type { Lead } from "@/lib/types";

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

type SerpResult = {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  emails?: string[];
  type?: string;
  types?: string[];
  data_id?: string;
  place_id?: string;
};

const STOP_WORDS = new Set([
  "find",
  "leads",
  "lead",
  "companies",
  "company",
  "businesses",
  "business",
  "potential",
  "matching",
  "that",
  "who",
  "with",
  "for",
  "the",
  "and",
]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function tinyHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function initials(company: string) {
  const words = company.match(/[A-Za-z0-9]+/g) ?? [];
  return (words[0]?.[0] ?? "L") + (words[1]?.[0] ?? words[0]?.[1] ?? "D");
}

function hueFor(value: string) {
  return Number.parseInt(tinyHash(value), 36) % 360;
}

function callSlot(index: number) {
  const minutes = 9 * 60 + index * 10;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}

function guessFallbackQueries(mandate: string) {
  const normalized = mandate.replace(/\s+/g, " ").trim();
  const inMatch = normalized.match(/\b(?:in|near|around)\s+([^,.;]+)/i);
  const region = inMatch?.[1]?.trim();
  const keywords = normalized
    .replace(/\b(?:in|near|around)\s+[^,.;]+/i, "")
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(" ");

  const core = [keywords || normalized, region].filter(Boolean).join(" in ");
  return Array.from(
    new Set([
      normalized,
      core,
      `${keywords || normalized} businesses ${region ? `in ${region}` : ""}`.trim(),
    ])
  ).slice(0, 3);
}

async function mistralQueries(mandate: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || "mistral-small-latest",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Return only a JSON array of 3 concise Google Maps search queries for finding lead companies. Include location words if present. No prose.",
        },
        { role: "user", content: mandate },
      ],
    }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim())
      .slice(0, 5);
  } catch {
    return null;
  }
}

function parseMaxLeads(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function validEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function contactFrom(result: SerpResult) {
  const email = validEmail(result.email) || validEmail(result.emails?.[0]);
  return email ? { contact: email, role: "Email" } : { contact: "", role: "" };
}

async function searchMaps(query: string): Promise<SerpResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) throw new Error("Missing SERPAPI_API_KEY in .env.local");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error || `SerpApi failed (${res.status})`);
  }

  return Array.isArray(json.local_results) ? json.local_results : [];
}

function toLead(result: SerpResult, index: number): Lead | null {
  const company = cleanText(result.title);
  const phone = cleanText(result.phone);
  if (!company || !phone) return null;

  const location = cleanText(result.address, "Region unknown");
  const industry = cleanText(result.type || result.types?.[0], "Maps lead");
  const idSeed = result.place_id || result.data_id || `${company}:${phone}:${location}`;
  const contact = contactFrom(result);

  return {
    id: `ld_${slug(company) || "lead"}_${tinyHash(idSeed)}`,
    company,
    contact: contact.contact,
    role: contact.role,
    location,
    industry,
    employees: "Unknown",
    phone,
    callAt: callSlot(index),
    initials: initials(company).toUpperCase(),
    hue: hueFor(company),
    logo: null,
    status: "queued",
  };
}

function uniqueLeads(results: SerpResult[], maxLeads?: number) {
  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (let i = 0; i < results.length; i++) {
    const lead = toLead(results[i], i);
    if (!lead) continue;
    const key = `${lead.company.toLowerCase()}|${lead.phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push({ ...lead, callAt: callSlot(leads.length) });
    if (maxLeads && leads.length >= maxLeads) break;
  }
  return leads;
}

/** POST /api/leads — preview from mandate, or insert selected preview leads. */
export async function POST(request: Request) {
  let body: { mandate?: string; maxLeads?: unknown; leads?: Lead[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (Array.isArray(body.leads)) {
    try {
      const inserted = await addLeads(body.leads);
      return Response.json({ leads: inserted, found: body.leads.length });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Lead import failed" },
        { status: 500 }
      );
    }
  }

  const mandate = body.mandate?.trim();
  if (!mandate) {
    return Response.json({ error: "mandate is required" }, { status: 400 });
  }

  try {
    const queries = (await mistralQueries(mandate)) ?? guessFallbackQueries(mandate);
    const results = (await Promise.all(queries.map(searchMaps))).flat();
    const leads = uniqueLeads(results, parseMaxLeads(body.maxLeads));

    return Response.json({ leads, queries, found: leads.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Lead generation failed" },
      { status: 500 }
    );
  }
}

/** DELETE /api/leads — clear the lead queue. Accounts cascade by DB design. */
export async function DELETE() {
  try {
    const deleted = await deleteAllLeads();
    return Response.json({ deleted });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}

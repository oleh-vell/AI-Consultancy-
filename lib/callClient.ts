/**
 * Browser-side helper for driving an ElevenLabs outbound call from the UI.
 *
 * Designed to drop into the existing store with zero changes to its shape:
 *   const { answers, duration } = await runCall(lead, { onStatus });
 *   promoteLead(lead, answers, duration);
 *
 * It owns the network + polling; the store keeps owning state.
 */

import type { Lead, DiscoveryAnswer, TranscriptLine } from "./types";

export interface CallPhaseEvent {
  /** Mirrors the lead lifecycle so the UI can flip status: queued → calling → completed. */
  phase: "dialing" | "calling" | "completed";
  /** Raw ElevenLabs status, when known. */
  status?: string;
}

export interface CallOutcome {
  conversationId: string;
  answers: DiscoveryAnswer[];
  transcript: TranscriptLine[];
  duration: string;
  summary?: string;
}

export class CallConfigError extends Error {}

/**
 * Start the outbound call. Returns the conversation_id to poll.
 *
 * `toNumber` is intentionally NOT defaulted to `lead.phone` — the seed leads carry
 * fake display numbers. Omit it and the server dials `DEMO_TO_NUMBER` (your phone).
 * Pass an explicit number only if you really want to dial it.
 */
export async function startCall(
  lead: Pick<Lead, "company" | "industry" | "contact" | "role">,
  toNumber?: string
): Promise<string> {
  const res = await fetch("/api/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(toNumber ? { toNumber } : {}),
      lead: {
        company: lead.company,
        industry: lead.industry,
        contact: lead.contact,
        role: lead.role,
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.config) throw new CallConfigError(json.error);
    throw new Error(json.error || `Call failed (${res.status})`);
  }
  return json.conversationId as string;
}

export interface ConversationSnapshot {
  status: string;
  done: boolean;
  /** Call is over — successfully OR via failure/hangup. */
  ended: boolean;
  /** Call ended without a usable result (no answer, dropped, early hangup). */
  failed: boolean;
  duration: string;
  answers: DiscoveryAnswer[];
  transcript: TranscriptLine[];
  summary?: string;
}

/** Single poll of a conversation — use to stream the transcript as it fills in. */
export async function fetchConversation(
  conversationId: string
): Promise<ConversationSnapshot> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.config) throw new CallConfigError(json.error);
    throw new Error(json.error || `Lookup failed (${res.status})`);
  }
  return {
    status: json.status,
    done: !!json.done,
    ended: !!json.ended,
    failed: !!json.failed,
    duration: json.duration ?? "—",
    answers: json.answers ?? [],
    transcript: json.transcript ?? [],
    summary: json.summary,
  };
}

interface PollOptions {
  /** Stop after this long (ms). Default 4 minutes — the script is capped at ~2. */
  timeoutMs?: number;
  /** Gap between polls (ms). Default 3s. */
  intervalMs?: number;
  onStatus?: (status: string) => void;
}

/** Poll a conversation until it's done (or times out). */
export async function pollConversation(
  conversationId: string,
  opts: PollOptions = {}
): Promise<CallOutcome> {
  const timeoutMs = opts.timeoutMs ?? 4 * 60_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const start = Date.now();

  while (true) {
    const res = await fetch(
      `/api/conversations/${encodeURIComponent(conversationId)}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      opts.onStatus?.(json.status);
      if (json.done) {
        return {
          conversationId,
          answers: json.answers ?? [],
          transcript: json.transcript ?? [],
          duration: json.duration ?? "—",
          summary: json.summary,
        };
      }
    } else if (json.config) {
      throw new CallConfigError(json.error);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for the call to complete");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * One-shot convenience: dial, wait for the caller to finish, return the outcome.
 * `onPhase` lets the UI move the lead through queued → calling → completed.
 */
export async function runCall(
  lead: Pick<Lead, "company" | "industry" | "contact" | "role">,
  opts: { onPhase?: (e: CallPhaseEvent) => void; toNumber?: string } = {}
): Promise<CallOutcome> {
  opts.onPhase?.({ phase: "dialing" });
  const conversationId = await startCall(lead, opts.toNumber);
  opts.onPhase?.({ phase: "calling" });
  const outcome = await pollConversation(conversationId, {
    onStatus: (status) => opts.onPhase?.({ phase: "calling", status }),
  });
  opts.onPhase?.({ phase: "completed" });
  return outcome;
}

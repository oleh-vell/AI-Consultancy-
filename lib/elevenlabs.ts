/**
 * Server-only ElevenLabs Conversational AI wrapper.
 *
 * The whole outbound-call surface is two HTTP calls:
 *   1. POST /v1/convai/twilio/outbound-call   -> starts the call, returns conversation_id
 *   2. GET  /v1/convai/conversations/:id      -> poll until status is "done", returns transcript
 *
 * This module is imported only by route handlers (app/api/**), never by client code,
 * so the xi-api-key stays on the server.
 */

import { getDiscovery } from "./repo";
import type {
  DiscoveryAnswer,
  DiscoveryQuestion,
  TranscriptLine,
} from "./types";

const BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ElevenLabsConfigError("ELEVENLABS_API_KEY is not set");
  return key;
}

export class ElevenLabsConfigError extends Error {}

export interface OutboundCallResult {
  conversationId: string;
  callSid: string;
}

/** Kick off the outbound call. Returns the conversation_id used to poll the transcript. */
export async function startOutboundCall(opts: {
  toNumber: string;
  dynamicVariables?: Record<string, string>;
}): Promise<OutboundCallResult> {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
  if (!agentId) throw new ElevenLabsConfigError("ELEVENLABS_AGENT_ID is not set");
  if (!phoneNumberId)
    throw new ElevenLabsConfigError("ELEVENLABS_AGENT_PHONE_NUMBER_ID is not set");

  const res = await fetch(`${BASE}/convai/twilio/outbound-call`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: opts.toNumber,
      ...(opts.dynamicVariables
        ? {
            conversation_initiation_client_data: {
              dynamic_variables: opts.dynamicVariables,
            },
          }
        : {}),
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(
      `ElevenLabs outbound-call failed (${res.status}): ${
        json.message || JSON.stringify(json) || res.statusText
      }`
    );
  }
  return {
    conversationId: json.conversation_id,
    callSid: json.callSid,
  };
}

/* ---- Get Conversation + normalization ----------------------------------- */

type ElevenRole = "agent" | "user";

interface ElevenTranscriptTurn {
  role: ElevenRole;
  message: string | null;
  time_in_call_secs?: number;
}

interface ElevenConversation {
  conversation_id: string;
  status: string; // "initiated" | "in-progress" | "processing" | "done" | "failed"
  transcript?: ElevenTranscriptTurn[];
  metadata?: { call_duration_secs?: number };
  analysis?: {
    data_collection_results?: Record<string, { value?: string | null }>;
    transcript_summary?: string;
  };
}

/** Normalized shape the frontend store can consume directly. */
export interface NormalizedConversation {
  conversationId: string;
  /** Raw ElevenLabs status. */
  status: string;
  /** True once the transcript is final and ready to promote. */
  done: boolean;
  /** True once the call is over — whether it succeeded OR failed/was hung up. */
  ended: boolean;
  /** True when the call ended in a failure state (no answer, dropped, hangup). */
  failed: boolean;
  /** "2m 47s" — derived from call_duration_secs. */
  duration: string;
  /** Mapped to DISCOVERY tags (bottleneck / leverage / timeline). */
  answers: DiscoveryAnswer[];
  /** Full transcript in the app's speaker shape. */
  transcript: TranscriptLine[];
  summary?: string;
}

export async function getConversation(
  conversationId: string
): Promise<NormalizedConversation> {
  const res = await fetch(
    `${BASE}/convai/conversations/${encodeURIComponent(conversationId)}`,
    { headers: { "xi-api-key": apiKey() }, cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs get-conversation failed (${res.status}): ${text || res.statusText}`
    );
  }
  const data: ElevenConversation = await res.json();
  const questions = await getDiscovery();
  return normalize(data, questions);
}

// Status reached once post-call processing finished and the transcript is final.
const DONE_STATUSES = new Set(["done", "completed", "processed", "ended"]);
// Terminal failure states: the call is over but produced no usable result —
// the callee didn't answer, the line dropped, or they hung up before it settled.
const FAILED_STATUSES = new Set([
  "failed",
  "error",
  "canceled",
  "cancelled",
  "no_answer",
  "no-answer",
  "busy",
  "expired",
  "timeout",
  "aborted",
]);

export function normalize(
  data: ElevenConversation,
  questions: DiscoveryQuestion[]
): NormalizedConversation {
  const turns = (data.transcript ?? []).filter(
    (t) => typeof t.message === "string" && t.message!.trim().length > 0
  );

  const transcript: TranscriptLine[] = turns.map((t) => ({
    speaker: t.role === "agent" ? "agent" : "client",
    text: t.message!.trim(),
  }));

  const status = (data.status || "").toLowerCase();
  const done = DONE_STATUSES.has(status);
  const failed = FAILED_STATUSES.has(status);

  return {
    conversationId: data.conversation_id,
    status: data.status,
    done,
    ended: done || failed,
    failed,
    duration: formatDuration(data.metadata?.call_duration_secs),
    answers: extractAnswers(
      turns,
      questions,
      data.analysis?.data_collection_results
    ),
    transcript,
    summary: data.analysis?.transcript_summary,
  };
}

/**
 * Map what the caller said onto the three discovery tags.
 *
 * Preferred path: the agent has data-collection fields configured whose keys
 * match the DISCOVERY tags. Fallback: take the caller's substantive turns in
 * order (skipping short confirmations like "yes, go ahead") and line them up
 * with the questions — the agent asks them in a fixed order.
 */
function extractAnswers(
  turns: ElevenTranscriptTurn[],
  questions: DiscoveryQuestion[],
  collected?: Record<string, { value?: string | null }>
): DiscoveryAnswer[] {
  // Caller's substantive turns in order — skip short confirmations ("yes", "sure go ahead").
  const clientTurns = turns
    .filter((t) => t.role === "user")
    .map((t) => t.message!.trim())
    .filter((m) => m.split(/\s+/).length >= 3);

  return questions.map((q, i) => {
    const fromCollection = collected?.[q.tag]?.value || collected?.[q.id]?.value;
    return {
      q: q.prompt,
      a: (fromCollection?.trim() || clientTurns[i] || "").trim(),
      tag: q.tag,
    };
  });
}

function formatDuration(secs?: number): string {
  if (!secs || secs < 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

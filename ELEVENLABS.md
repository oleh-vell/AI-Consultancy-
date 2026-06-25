# ElevenLabs Integration — wiring notes

The integration is **additive**: it adds API routes + one client helper and touches
none of the store/page/component files. The data it returns matches the shapes the
store already consumes (`DiscoveryAnswer[]`, duration string), so wiring it into the
"Call now" button is a few lines.

## What was added

| File | Role |
|------|------|
| `lib/elevenlabs.ts` | Server-only ElevenLabs wrapper (start call + get/normalize transcript) |
| `app/api/call/route.ts` | `POST /api/call` → starts the outbound call, returns `conversationId` |
| `app/api/conversations/[id]/route.ts` | `GET /api/conversations/:id` → poll until `done` |
| `lib/callClient.ts` | Browser helper: `runCall(lead)` / `startCall` / `pollConversation` |
| `.env.local.example` | Required keys |

## Setup (one-time, dashboard)

Fill `.env.local`:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_AGENT_PHONE_NUMBER_ID=...
DEMO_TO_NUMBER=+44...        # optional fallback if a lead has no phone
```

Agent system prompt uses `{{lead_name}}` and `{{lead_industry}}` placeholders — the
route fills them from the lead row. The 3-question script should map to the
`bottleneck → leverage → timeline` tags in `lib/data.ts` (`DISCOVERY`).

## Wiring "Call now" into the store

`runCall` returns `{ answers, duration, transcript, summary }` — `answers` is already
`DiscoveryAnswer[]` keyed to the DISCOVERY tags, so the existing `promoteLead` and its
`buildDeck` / `buildTranscript` work unchanged.

```ts
import { runCall, CallConfigError } from "@/lib/callClient";

async function onCallNow(lead: Lead) {
  setLeadStatus(lead.id, "calling");
  try {
    const { answers, duration } = await runCall(lead, {
      onPhase: (e) => {
        if (e.phase === "calling") setLeadStatus(lead.id, "calling");
        if (e.phase === "completed") setLeadStatus(lead.id, "completed");
      },
    });
    const accountId = promoteLead(lead, answers, duration);
    // route to /accounts/:id
  } catch (err) {
    if (err instanceof CallConfigError) {
      // keys not set — fall back to the mock flow (DISCOVERY suggestions) for the demo
    }
    setLeadStatus(lead.id, "queued");
  }
}
```

If you'd rather keep the deck/transcript exactly as the agent produced them (instead of
the templated `buildTranscript`/`buildDeck`), the helper also returns the live
`transcript` and a `summary` — wire those in if/when the store grows a setter for them.

## No keys yet? Nothing breaks

With empty env vars the routes return `503 { config: true }` and `runCall` throws
`CallConfigError`. Catch it and fall back to the existing mock promote flow, so the demo
still works without the phone. Add keys → it goes live with no code change.

# AI FDE company of London


## The One-Liner

An AI consulting agency that runs itself: it calls leads, runs discovery, builds the pitch deck, and bills the client — all without a human in the loop. The human just watches it work.

## The Narrative (what judges see, ~90 seconds)

1. **Leads page** — a CRM table of prospects, each with a scheduled "Call at" time. The agency would dial these on its own; you hit **Call now** to fast-forward.
2. **The call** — your phone rings. The AI agent runs a short discovery: asks 2–3 questions about the company and its needs. You answer.
3. **Promotion** — the lead's status moves live: `Queued → Calling… → Completed → Promoted to Account`.
4. **Accounts page** — the lead is now a full account, enriched by *what you just said on the call*:
    - **Activity** — the call logged, with transcript.
    - **Pitch Deck** — a deck generated from the conversation, referencing specifics the caller mentioned.
    - **Bill** — "Generate Invoice" produces the invoice (optional Stripe link) and closes the loop.

## Why It Wins

- **The phone ringing is the proof.** Hands off the laptop, and the company still does work. That's "runs on its own," felt rather than claimed.
- **The thread of continuity.** What the judge says on the call shows up in the deck. That single detail separates "real autonomous system" from "two disconnected pages."
- **It mirrors a real CRM** (Leads → Accounts), so it reads as a company, not a toy.

## Scope (what we build, in order)

| # | Piece | Why it's here | Risk |
| --- | --- | --- | --- |
| 1 | ElevenLabs agent + phone number + 1 test call | The hero moment; highest variance, so de-risk first | High |
| 2 | Leads page + **Call now** → fires outbound call | Trigger | Low |
| 3 | Post-call webhook → writes transcript to account | The continuity thread | Med |
| 4 | Accounts page: Activity / Deck / Bill tabs | The payoff | Low |
| 5 | Deck + invoice generation (Claude + HTML) | The deliverables | Low |

## Architecture

```
[Leads page] --Call now--> backend POST /call (ElevenLabs outbound)
                                  |
                          phone rings → agent asks 2-3 Qs → you answer
                                  |
                  ElevenLabs post-call webhook --> backend /webhook
                                  |
                  extract {company, need, budget} → write to Account
                                  |
[Accounts page] polls /accounts/:id → Activity · Deck · Bill
```

Backend endpoints: `POST /call`, `POST /webhook/elevenlabs`, `GET /accounts/:id`.

## De-Risking Rules

- **Agent asks max 2–3 questions** — short call can't wander or stall on stage.
- **Account page polls** for the webhook so it updates the instant the call ends, but falls back to lead data if the webhook lags — never a blank screen.
- **Pre-seed 1–2 accounts** so the Accounts page looks populated even before the live call lands.

## Two Open Decisions

1. **Webhook public URL** — ngrok tunnel, or deploy on Render/Replit/Vercel?
2. **Deck source** — generate *live from the call transcript* (more impressive, riskier) or from lead data the moment the call ends (safer, still looks live)?

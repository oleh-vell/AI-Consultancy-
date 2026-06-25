import type {
  Lead,
  DiscoveryAnswer,
  Slide,
  Invoice,
  InvoiceLineTemplate,
  TranscriptLine,
  Account,
} from "./types";

/* ---------------------------------------------------------------
   Pure content generators. These hold the *shape* of the deck,
   transcript, and invoice — the template logic — but no seed data.
   Every value they need (leads, answers, billable scope) is passed
   in, having been loaded from Postgres. Imported only by the server
   repository, never by client components.
   --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Transcript — assembled from the lead + the caller's answers.
   Each answer already carries its question prompt (`q`).
   --------------------------------------------------------------- */
export function buildTranscript(
  lead: Pick<Lead, "company" | "contact">,
  answers: DiscoveryAnswer[]
): TranscriptLine[] {
  const first = lead.contact.split(" ")[0];
  const lines: TranscriptLine[] = [
    {
      speaker: "agent",
      text: `Hello ${first}, this is the AI Consultancy of London calling — thanks for taking a moment. I'd like to understand where ${lead.company} is losing time, then put a tailored plan in front of you. Sound good?`,
    },
    { speaker: "client", text: "Yes, go ahead." },
  ];
  answers.forEach((ans) => {
    lines.push({ speaker: "agent", text: ans.q });
    lines.push({ speaker: "client", text: ans.a });
  });
  lines.push({
    speaker: "agent",
    text: `That's everything I need. I'm drafting your engagement plan now and promoting ${lead.company} to an active account — you'll see the deck and a proposed scope within the minute. Thank you, ${first}.`,
  });
  return lines;
}

/* ---------------------------------------------------------------
   Deck generator — references the specifics the caller mentioned.
   --------------------------------------------------------------- */
export function buildDeck(
  lead: Pick<Lead, "company" | "contact" | "role" | "location" | "industry" | "employees">,
  answers: DiscoveryAnswer[]
): Slide[] {
  const byTag = Object.fromEntries(answers.map((a) => [a.tag, a]));
  const bottleneck = byTag["bottleneck"]?.a ?? "";
  const leverage = byTag["leverage"]?.a ?? "";
  const timeline = byTag["timeline"]?.a ?? "";

  return [
    {
      kind: "cover",
      eyebrow: "Engagement proposal",
      title: `${lead.company} × AI Consultancy of London`,
      body: `Prepared for ${lead.contact}, ${lead.role} — ${lead.location}. Drafted live from today's discovery call.`,
    },
    {
      kind: "situation",
      eyebrow: "What you told us",
      title: "The bottleneck, in your words",
      quote: bottleneck,
      body: `For a ${lead.employees}-person ${lead.industry.toLowerCase()} operation, this is the constraint that compounds — every other initiative waits behind it.`,
    },
    {
      kind: "leverage",
      eyebrow: "Where the leverage is",
      title: "One change, outsized return",
      quote: leverage,
      bullets: [
        "We isolate the highest-frequency manual step you named",
        "We instrument it end-to-end before touching a line of code",
        "We automate the decision, not just the data entry",
      ],
    },
    {
      kind: "approach",
      eyebrow: "How we work",
      title: "A three-week path to live",
      bullets: [
        "Week 1 — Discovery & mapping: shadow the workflow, quantify the cost",
        "Week 2 — Build: an agent that drafts, you approve, it learns",
        "Week 3 — Deploy & handover: live in production, your team in control",
      ],
    },
    {
      kind: "engagement",
      eyebrow: "Timeline & terms",
      title: "Matched to your constraints",
      quote: timeline,
      body: `We've scoped this engagement to land inside the window and budget you described — fixed fee, no open-ended retainer, full IP transfer on completion.`,
    },
    {
      kind: "investment",
      eyebrow: "Investment",
      title: "What it costs to close the gap",
      bullets: [
        "Discovery & process mapping — fixed",
        "Agent build & integration — fixed",
        "Deployment, training & 30-day support — included",
      ],
      body: "Full breakdown on the attached invoice. One number, payable on milestones.",
    },
  ];
}

/* ---------------------------------------------------------------
   Invoice generator — closes the loop. Line items come from the
   invoice_line_templates table; London → 20% VAT.
   --------------------------------------------------------------- */
export function buildInvoice(
  account: Pick<Account, "id" | "company">,
  templates: InvoiceLineTemplate[],
  issued: string,
  due: string
): Invoice {
  const lines = templates.map((t) => ({
    label: t.label,
    detail: t.detail.replace(/\{company\}/g, account.company),
    amount: t.amount,
  }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const vat = Math.round(subtotal * 0.2);
  const seq = account.id.replace(/\D/g, "").slice(-3) || "001";
  return {
    number: `ACL-2026-${seq.padStart(3, "0")}`,
    issued,
    due,
    lines,
    subtotal,
    vat,
    total: subtotal + vat,
    currency: "£",
  };
}

export const money = (n: number, currency = "£") =>
  currency + n.toLocaleString("en-GB");

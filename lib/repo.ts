import "server-only";
import { query, withTransaction } from "./db";
import { buildTranscript, buildDeck, buildInvoice } from "./data";
import type {
  Lead,
  LeadStatus,
  Account,
  DiscoveryAnswer,
  DiscoveryQuestion,
  Slide,
  TranscriptLine,
  Invoice,
  InvoiceLineTemplate,
} from "./types";

/* ---------------------------------------------------------------
   Leads
   --------------------------------------------------------------- */
interface LeadRow {
  id: string;
  company: string;
  contact: string;
  role: string;
  location: string;
  industry: string;
  employees: string;
  phone: string;
  call_at: string;
  initials: string;
  hue: number;
  logo: string | null;
  status: LeadStatus;
}

const toLead = (r: LeadRow): Lead => ({
  id: r.id,
  company: r.company,
  contact: r.contact,
  role: r.role,
  location: r.location,
  industry: r.industry,
  employees: r.employees,
  phone: r.phone,
  callAt: r.call_at,
  initials: r.initials,
  hue: r.hue,
  logo: r.logo,
  status: r.status,
});

export async function getLeads(): Promise<Lead[]> {
  const rows = await query<LeadRow>(
    "SELECT * FROM leads ORDER BY call_at, created_at"
  );
  return rows.map(toLead);
}

export async function getLead(id: string): Promise<Lead | null> {
  const rows = await query<LeadRow>("SELECT * FROM leads WHERE id = $1", [id]);
  return rows[0] ? toLead(rows[0]) : null;
}

export async function setLeadStatus(
  id: string,
  status: LeadStatus
): Promise<Lead | null> {
  const rows = await query<LeadRow>(
    "UPDATE leads SET status = $2 WHERE id = $1 RETURNING *",
    [id, status]
  );
  return rows[0] ? toLead(rows[0]) : null;
}

/* ---------------------------------------------------------------
   Discovery script
   --------------------------------------------------------------- */
export async function getDiscovery(): Promise<DiscoveryQuestion[]> {
  return query<DiscoveryQuestion>(
    "SELECT id, prompt, placeholder, tag, suggestion FROM discovery_questions ORDER BY ord"
  );
}

/* ---------------------------------------------------------------
   Accounts — assembled from accounts + child tables.
   --------------------------------------------------------------- */
interface AccountRow {
  id: string;
  lead_id: string;
  company: string;
  contact: string;
  role: string;
  location: string;
  industry: string;
  employees: string;
  initials: string;
  hue: number;
  logo: string | null;
  call_duration: string;
  summary: string | null;
  promoted_at: Date;
}

async function assemble(rows: AccountRow[]): Promise<Account[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const answers = await query<{
    account_id: string;
    q: string;
    a: string;
    tag: string;
  }>(
    "SELECT account_id, q, a, tag FROM account_answers WHERE account_id = ANY($1) ORDER BY account_id, ord",
    [ids]
  );
  const transcript = await query<{
    account_id: string;
    speaker: "agent" | "client";
    text: string;
  }>(
    "SELECT account_id, speaker, text FROM transcript_lines WHERE account_id = ANY($1) ORDER BY account_id, ord",
    [ids]
  );
  const slides = await query<{
    account_id: string;
    kind: Slide["kind"];
    eyebrow: string;
    title: string;
    body: string | null;
    bullets: string[] | null;
    quote: string | null;
  }>(
    "SELECT account_id, kind, eyebrow, title, body, bullets, quote FROM deck_slides WHERE account_id = ANY($1) ORDER BY account_id, ord",
    [ids]
  );
  const invoices = await query<{
    id: number;
    account_id: string;
    number: string;
    issued: string;
    due: string;
    subtotal: number;
    vat: number;
    total: number;
    currency: string;
  }>("SELECT * FROM invoices WHERE account_id = ANY($1)", [ids]);
  const invoiceLines = invoices.length
    ? await query<{
        invoice_id: number;
        label: string;
        detail: string;
        amount: number;
      }>(
        "SELECT invoice_id, label, detail, amount FROM invoice_lines WHERE invoice_id = ANY($1) ORDER BY invoice_id, ord",
        [invoices.map((i) => i.id)]
      )
    : [];

  const groupBy = <T, K>(items: T[], key: (t: T) => K) => {
    const m = new Map<K, T[]>();
    for (const it of items) {
      const k = key(it);
      (m.get(k) ?? m.set(k, []).get(k)!).push(it);
    }
    return m;
  };

  const answersByAcct = groupBy(answers, (a) => a.account_id);
  const transcriptByAcct = groupBy(transcript, (t) => t.account_id);
  const slidesByAcct = groupBy(slides, (s) => s.account_id);
  const linesByInvoice = groupBy(invoiceLines, (l) => l.invoice_id);
  const invoiceByAcct = new Map(invoices.map((i) => [i.account_id, i]));

  return rows.map((r): Account => {
    const inv = invoiceByAcct.get(r.id);
    const invoice: Invoice | null = inv
      ? {
          number: inv.number,
          issued: inv.issued,
          due: inv.due,
          lines: (linesByInvoice.get(inv.id) ?? []).map((l) => ({
            label: l.label,
            detail: l.detail,
            amount: l.amount,
          })),
          subtotal: inv.subtotal,
          vat: inv.vat,
          total: inv.total,
          currency: inv.currency,
        }
      : null;

    return {
      id: r.id,
      leadId: r.lead_id,
      company: r.company,
      contact: r.contact,
      role: r.role,
      location: r.location,
      industry: r.industry,
      employees: r.employees,
      initials: r.initials,
      hue: r.hue,
      logo: r.logo,
      promotedAt: r.promoted_at.getTime(),
      callDuration: r.call_duration,
      answers: (answersByAcct.get(r.id) ?? []).map(
        (a): DiscoveryAnswer => ({ q: a.q, a: a.a, tag: a.tag })
      ),
      transcript: (transcriptByAcct.get(r.id) ?? []).map(
        (t): TranscriptLine => ({ speaker: t.speaker, text: t.text })
      ),
      deck: (slidesByAcct.get(r.id) ?? []).map(
        (s): Slide => ({
          kind: s.kind,
          eyebrow: s.eyebrow,
          title: s.title,
          body: s.body ?? undefined,
          bullets: s.bullets ?? undefined,
          quote: s.quote ?? undefined,
        })
      ),
      invoice,
    };
  });
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await query<AccountRow>(
    "SELECT * FROM accounts ORDER BY promoted_at DESC"
  );
  return assemble(rows);
}

export async function getAccount(id: string): Promise<Account | null> {
  const rows = await query<AccountRow>("SELECT * FROM accounts WHERE id = $1", [
    id,
  ]);
  const [account] = await assemble(rows);
  return account ?? null;
}

/* ---------------------------------------------------------------
   Promote a lead → account. Loads the lead from the DB (the client
   only sends the id + answers), generates the transcript and deck,
   and writes everything in one transaction.
   --------------------------------------------------------------- */
export async function promoteLead(input: {
  leadId: string;
  answers: DiscoveryAnswer[];
  duration: string;
  summary?: string;
  /** Verbatim transcript from a live call. Falls back to the template if omitted. */
  transcript?: TranscriptLine[];
}): Promise<string> {
  const lead = await getLead(input.leadId);
  if (!lead) throw new Error(`Lead not found: ${input.leadId}`);

  const accountId = `ac_${lead.id.replace(/^ld_/, "")}`;
  const transcript =
    input.transcript && input.transcript.length > 0
      ? input.transcript
      : buildTranscript(lead, input.answers);
  const deck = buildDeck(lead, input.answers);

  await withTransaction(async (c) => {
    // Re-promoting replaces the prior account (children cascade).
    await c.query("DELETE FROM accounts WHERE id = $1", [accountId]);

    await c.query(
      `INSERT INTO accounts
         (id, lead_id, company, contact, role, location, industry, employees,
          initials, hue, logo, call_duration, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        accountId,
        lead.id,
        lead.company,
        lead.contact,
        lead.role,
        lead.location,
        lead.industry,
        lead.employees,
        lead.initials,
        lead.hue,
        lead.logo ?? null,
        input.duration,
        input.summary ?? null,
      ]
    );

    for (let i = 0; i < input.answers.length; i++) {
      const a = input.answers[i];
      await c.query(
        "INSERT INTO account_answers (account_id, ord, q, a, tag) VALUES ($1,$2,$3,$4,$5)",
        [accountId, i, a.q, a.a, a.tag]
      );
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      await c.query(
        "INSERT INTO transcript_lines (account_id, ord, speaker, text) VALUES ($1,$2,$3,$4)",
        [accountId, i, t.speaker, t.text]
      );
    }

    for (let i = 0; i < deck.length; i++) {
      const s = deck[i];
      await c.query(
        `INSERT INTO deck_slides
           (account_id, ord, kind, eyebrow, title, body, bullets, quote)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [
          accountId,
          i,
          s.kind,
          s.eyebrow,
          s.title,
          s.body ?? null,
          s.bullets ? JSON.stringify(s.bullets) : null,
          s.quote ?? null,
        ]
      );
    }

    await c.query("UPDATE leads SET status = 'promoted' WHERE id = $1", [
      lead.id,
    ]);
  });

  return accountId;
}

/* ---------------------------------------------------------------
   Invoice generation — pulls billable scope from templates.
   --------------------------------------------------------------- */
export async function generateInvoice(accountId: string): Promise<Invoice> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Account not found: ${accountId}`);

  const templates = await query<InvoiceLineTemplate>(
    "SELECT id, label, detail, amount FROM invoice_line_templates ORDER BY ord"
  );
  const invoice = buildInvoice(
    account,
    templates,
    "25 Jun 2026",
    "09 Jul 2026"
  );

  await withTransaction(async (c) => {
    await c.query("DELETE FROM invoices WHERE account_id = $1", [accountId]);
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO invoices
         (account_id, number, issued, due, subtotal, vat, total, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        accountId,
        invoice.number,
        invoice.issued,
        invoice.due,
        invoice.subtotal,
        invoice.vat,
        invoice.total,
        invoice.currency,
      ]
    );
    const invoiceId = rows[0].id;
    for (let i = 0; i < invoice.lines.length; i++) {
      const l = invoice.lines[i];
      await c.query(
        "INSERT INTO invoice_lines (invoice_id, ord, label, detail, amount) VALUES ($1,$2,$3,$4,$5)",
        [invoiceId, i, l.label, l.detail, l.amount]
      );
    }
  });

  return invoice;
}

/* ---------------------------------------------------------------
   Reset the demo — clear accounts, return every lead to the queue.
   Seed leads / discovery script stay intact.
   --------------------------------------------------------------- */
export async function resetDemo(): Promise<void> {
  await withTransaction(async (c) => {
    await c.query("DELETE FROM accounts"); // cascades to children + invoices
    await c.query("UPDATE leads SET status = 'queued'");
  });
}

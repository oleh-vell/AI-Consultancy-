export type LeadStatus = "queued" | "calling" | "completed" | "promoted";

export interface Lead {
  id: string;
  company: string;
  contact: string;
  role: string;
  location: string;
  industry: string;
  employees: string;
  phone: string;
  callAt: string;        // "14:20"
  initials: string;
  hue: number;           // avatar tint
  logo?: string | null;  // optional brand logo URL; null → initials
  status: LeadStatus;
}

export interface DiscoveryQuestion {
  id: string;
  prompt: string;
  placeholder: string;
  tag: string;
  /** suggested answer offered as a one-tap chip during the demo */
  suggestion: string;
}

export interface DiscoveryAnswer {
  q: string;
  a: string;
  /** short label echoed in the deck / activity */
  tag: string;
}

export interface InvoiceLineTemplate {
  id: string;
  label: string;
  detail: string;
  amount: number;
}

export interface TranscriptLine {
  speaker: "agent" | "client";
  text: string;
}

export interface Slide {
  kind: "cover" | "situation" | "leverage" | "approach" | "engagement" | "investment";
  eyebrow: string;
  title: string;
  body?: string;
  bullets?: string[];
  quote?: string;
}

export interface InvoiceLine {
  label: string;
  detail: string;
  amount: number;
}

export interface Invoice {
  number: string;
  issued: string;
  due: string;
  lines: InvoiceLine[];
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
}

/** AI-generated engagement proposal, derived from the discovery answers. */
export interface ProposedSolution {
  /** One-line name for the proposed build, e.g. "Automated claims triage agent". */
  headline: string;
  /** 2–3 sentence plain-English description of what we'd build. */
  summary: string;
  /** The concrete steps / components, 3–5 items. */
  approach: string[];
  /** Suggested implementation stack, a few short labels. */
  stack: string[];
  /** The business impact, one sentence tied to the bottleneck. */
  impact: string;
}

export interface Account {
  id: string;
  leadId: string;
  company: string;
  contact: string;
  role: string;
  location: string;
  industry: string;
  employees: string;
  initials: string;
  hue: number;
  logo?: string | null;      // optional brand logo URL; null → initials
  promotedAt: number;        // timestamp
  callDuration: string;      // "2m 47s"
  answers: DiscoveryAnswer[];
  transcript: TranscriptLine[];
  deck: Slide[];
  invoice: Invoice | null;
}

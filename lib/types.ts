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

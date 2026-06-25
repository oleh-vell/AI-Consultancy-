"use client";

import { create } from "zustand";
import type {
  Lead,
  LeadStatus,
  Account,
  DiscoveryAnswer,
  DiscoveryQuestion,
  TranscriptLine,
} from "./types";

/**
 * Client store backed by the API (Postgres). It holds a local cache of what
 * the server returned; every mutation calls the API, then refreshes the cache.
 * No seed data lives here — `load()` hydrates from the database.
 */
interface State {
  leads: Lead[];
  accounts: Account[];
  discovery: DiscoveryQuestion[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  setLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  promoteLead: (
    leadId: string,
    answers: DiscoveryAnswer[],
    duration: string,
    /** Verbatim live-call transcript; omitted for the simulated flow. */
    transcript?: TranscriptLine[]
  ) => Promise<string>;
  generateInvoice: (accountId: string) => Promise<void>;
  previewLeads: (
    mandate: string,
    maxLeads?: number
  ) => Promise<{ leads: Lead[]; queries: string[]; found: number }>;
  addGeneratedLeads: (leads: Lead[]) => Promise<{ count: number }>;
  reset: () => Promise<void>;
}

async function getJSON(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function sendJSON(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const useStore = create<State>((set, get) => ({
  leads: [],
  accounts: [],
  discovery: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [leads, accounts, discovery] = await Promise.all([
        getJSON("/api/leads"),
        getJSON("/api/accounts"),
        getJSON("/api/discovery"),
      ]);
      set({
        leads: leads.leads,
        accounts: accounts.accounts,
        discovery: discovery.discovery,
        loaded: true,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load",
      });
    }
  },

  setLeadStatus: async (id, status) => {
    // Optimistic — the call modal flips status the moment the user answers.
    const prev = get().leads;
    set({ leads: prev.map((l) => (l.id === id ? { ...l, status } : l)) });
    try {
      await sendJSON(`/api/leads/${id}`, "PATCH", { status });
    } catch (err) {
      set({ leads: prev, error: err instanceof Error ? err.message : null });
    }
  },

  promoteLead: async (leadId, answers, duration, transcript) => {
    const { accountId } = await sendJSON("/api/accounts", "POST", {
      leadId,
      answers,
      duration,
      ...(transcript && transcript.length ? { transcript } : {}),
    });
    // Refresh both lists: the lead is now promoted, the account exists.
    const [leads, accounts] = await Promise.all([
      getJSON("/api/leads"),
      getJSON("/api/accounts"),
    ]);
    set({ leads: leads.leads, accounts: accounts.accounts });
    return accountId as string;
  },

  generateInvoice: async (accountId) => {
    const { invoice } = await sendJSON(
      `/api/accounts/${accountId}/invoice`,
      "POST"
    );
    set((s) => ({
      accounts: s.accounts.map((a) =>
        a.id === accountId ? { ...a, invoice } : a
      ),
    }));
  },

  previewLeads: async (mandate, maxLeads) => {
    const json = await sendJSON("/api/leads", "POST", {
      mandate,
      ...(maxLeads ? { maxLeads } : {}),
    });
    return {
      leads: Array.isArray(json.leads) ? json.leads : [],
      queries: Array.isArray(json.queries) ? json.queries : [],
      found: typeof json.found === "number" ? json.found : 0,
    };
  },

  addGeneratedLeads: async (selected) => {
    const json = await sendJSON("/api/leads", "POST", { leads: selected });
    const leads = await getJSON("/api/leads");
    set({ leads: leads.leads });
    return { count: Array.isArray(json.leads) ? json.leads.length : 0 };
  },

  reset: async () => {
    await sendJSON("/api/reset", "POST");
    await get().load();
  },
}));

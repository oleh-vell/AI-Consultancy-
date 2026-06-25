"use client";

import { useEffect, useState } from "react";
import type { Account, ProposedSolution } from "./types";

/**
 * Generates (and caches) the AI-proposed engagement for an account. Both the
 * Activity tab and the Solution tab consume this — the module-level cache means
 * the model is called once per account, not once per tab.
 */
const cache = new Map<string, ProposedSolution>();
const inflight = new Map<string, Promise<ProposedSolution>>();

function answer(account: Account, tag: string): string {
  return account.answers.find((a) => a.tag === tag)?.a ?? "";
}

async function request(account: Account): Promise<ProposedSolution> {
  const res = await fetch("/api/solution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company: account.company,
      contact: account.contact,
      role: account.role,
      industry: account.industry,
      employees: account.employees,
      location: account.location,
      bottleneck: answer(account, "bottleneck"),
      leverage: answer(account, "leverage"),
      timeline: answer(account, "timeline"),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json.solution as ProposedSolution;
}

export function useSolution(account: Account) {
  const [solution, setSolution] = useState<ProposedSolution | null>(
    () => cache.get(account.id) ?? null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = cache.get(account.id);
    if (cached) {
      setSolution(cached);
      setError(null);
      return;
    }

    let active = true;
    setSolution(null);
    setError(null);

    let run = inflight.get(account.id);
    if (!run) {
      run = request(account);
      inflight.set(account.id, run);
      run.finally(() => inflight.delete(account.id));
    }

    run
      .then((s) => {
        cache.set(account.id, s);
        if (active) setSolution(s);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to generate");
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  return { solution, loading: !solution && !error, error };
}

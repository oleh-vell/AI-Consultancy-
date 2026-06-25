"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/ui";
import { Activity } from "@/components/Activity";
import { Deck } from "@/components/Deck";
import { Bill } from "@/components/Bill";
import styles from "./account.module.css";

type Tab = "activity" | "deck" | "bill";

export default function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const loaded = useStore((s) => s.loaded);
  const load = useStore((s) => s.load);
  const [tab, setTab] = useState<Tab>("activity");

  // Direct navigation / hard refresh: make sure the store is hydrated.
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!account) {
    if (!loaded) {
      return (
        <div className={styles.missing}>
          <p>Loading account…</p>
        </div>
      );
    }
    return (
      <div className={styles.missing}>
        <h1>Account not found</h1>
        <p>This account may have been reset. Promote a lead to recreate it.</p>
        <Link href="/leads" className={styles.backLink}>← Back to Leads</Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; meta: string }[] = [
    { id: "activity", label: "Activity", meta: `${account.transcript.length} events` },
    { id: "deck", label: "Pitch Deck", meta: `${account.deck.length} slides` },
    { id: "bill", label: "Bill", meta: account.invoice ? "Issued" : "Draft" },
  ];

  return (
    <div className={styles.page}>
      <Link href="/accounts" className={styles.crumb}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Accounts
      </Link>

      <header className={styles.head}>
        <Avatar initials={account.initials} hue={account.hue} size={56} />
        <div className={styles.headText}>
          <div className={styles.titleRow}>
            <h1 className={styles.company}>{account.company}</h1>
            <span className={styles.activeTag}>
              <span className={styles.activeDot} />
              Active account
            </span>
          </div>
          <p className={styles.facts}>
            {account.contact} · {account.role}
            <span className={styles.sep}>—</span>
            {account.industry} · {account.employees} staff · {account.location}
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className={styles.tabMeta}>{t.meta}</span>
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {tab === "activity" && <Activity account={account} />}
        {tab === "deck" && <Deck account={account} />}
        {tab === "bill" && <Bill account={account} />}
      </div>
    </div>
  );
}

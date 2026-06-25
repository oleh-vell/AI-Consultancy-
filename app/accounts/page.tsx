"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/ui";
import { money } from "@/lib/data";
import styles from "./accounts.module.css";

export default function AccountsPage() {
  const accounts = useStore((s) => s.accounts);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Accounts"
        subtitle="Every promoted lead lands here as a live account — enriched by what was said on the call."
      />

      {accounts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark} aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 19c0-3.5 3.2-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>No accounts yet</h2>
          <p className={styles.emptyBody}>
            When the agent finishes a discovery call, the lead is promoted to an
            account here — with the transcript, a generated pitch deck, and a
            ready-to-send invoice.
          </p>
          <Link href="/leads" className={styles.emptyCta}>
            Go to Leads
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h9M8.5 4 12.5 8 8.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.id}>
              <Link href={`/accounts/${a.id}`} className={styles.row}>
                <Avatar initials={a.initials} hue={a.hue} size={46} />
                <div className={styles.identity}>
                  <span className={styles.company}>{a.company}</span>
                  <span className={styles.contact}>
                    {a.contact} · {a.role}
                  </span>
                </div>

                <div className={styles.tags}>
                  {a.answers.slice(0, 2).map((ans) => (
                    <span key={ans.tag} className={styles.tag}>
                      {ans.tag}
                    </span>
                  ))}
                </div>

                <div className={styles.artifacts}>
                  <span className={styles.artItem}>
                    <Dot on /> Deck drafted
                  </span>
                  <span className={styles.artItem}>
                    {a.invoice ? (
                      <>
                        <Dot on /> Invoiced{" "}
                        <strong className="tnum">
                          {money(a.invoice.total)}
                        </strong>
                      </>
                    ) : (
                      <>
                        <Dot /> Invoice pending
                      </>
                    )}
                  </span>
                </div>

                <span className={styles.open}>
                  Open
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h9M8.5 4 12.5 8 8.5 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Dot({ on }: { on?: boolean }) {
  return <span className={`${styles.dot} ${on ? styles.dotOn : ""}`} />;
}

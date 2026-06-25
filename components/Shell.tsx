"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Wordmark } from "./Wordmark";
import styles from "./Shell.module.css";

function LeadsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 7h13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10.5h2M6 12.2h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function AccountsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6.2" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 15c0-2.7 2.5-4.6 5.5-4.6s5.5 1.9 5.5 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const leads = useStore((s) => s.leads);
  const accounts = useStore((s) => s.accounts);
  const reset = useStore((s) => s.reset);
  const load = useStore((s) => s.load);

  // Hydrate the store from the database once, on first mount.
  useEffect(() => {
    load();
  }, [load]);

  const queued = leads.filter((l) => l.status !== "promoted").length;

  const nav = [
    { href: "/leads", label: "Leads", icon: <LeadsIcon />, count: queued },
    { href: "/accounts", label: "Accounts", icon: <AccountsIcon />, count: accounts.length },
  ];

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Wordmark />
        </div>

        <nav className={styles.nav}>
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.count > 0 && (
                  <span className={`${styles.navCount} tnum`}>{item.count}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.agent}>
          <div className={styles.agentHead}>
            <span className={styles.pulse} aria-hidden="true" />
            <span>Autonomous agent</span>
          </div>
          <p className={styles.agentBody}>
            Dialing the queue on schedule. No human in the loop — you're just
            watching it work.
          </p>
        </div>

        <div className={styles.foot}>
          <div className={styles.user}>
            <span className={styles.userAvatar}>OV</span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>Observer</span>
              <span className={styles.userRole}>read-only</span>
            </span>
          </div>
          <button
            className={styles.reset}
            onClick={() => reset()}
            title="Reset the demo"
          >
            Reset
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

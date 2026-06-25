"use client";

import type { Account } from "@/lib/types";
import styles from "./Activity.module.css";

const TAG_LABEL: Record<string, string> = {
  bottleneck: "The bottleneck",
  leverage: "Highest leverage",
  timeline: "Timeline & budget",
};

export function Activity({ account }: { account: Account }) {
  return (
    <div className={styles.wrap}>
      <section>
        <h2 className={styles.sectionTitle}>What the agent learned</h2>
        <p className={styles.sectionLede}>
          Pulled live from the discovery call — these answers drive the deck and
          the scope.
        </p>
        <div className={styles.insights}>
          {account.answers.map((ans) => (
            <article key={ans.tag} className={styles.insight}>
              <span className={styles.insightTag}>{TAG_LABEL[ans.tag] ?? ans.tag}</span>
              <p className={styles.insightQuote}>“{ans.a}”</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.callSection}>
        <div className={styles.callBar}>
          <span className={styles.callIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6.5 3.5 9 4l1 3.5L8 9a11 11 0 0 0 7 7l1.5-2 3.5 1 .5 2.5c0 .8-.7 1.5-1.5 1.5A15 15 0 0 1 5 5c0-.8.7-1.5 1.5-1.5Z" fill="currentColor" />
            </svg>
          </span>
          <div className={styles.callMeta}>
            <span className={styles.callTitle}>Outbound discovery call</span>
            <span className={styles.callSub}>
              Autonomous agent · {account.contact} · {account.callDuration} · promoted moments ago
            </span>
          </div>
          <span className={styles.callBadge}>Transcript</span>
        </div>

        <div className={styles.transcript}>
          {account.transcript.map((line, i) => (
            <div key={i} className={`${styles.line} ${styles[line.speaker]}`}>
              <span className={styles.speaker}>
                {line.speaker === "agent" ? "AI Agent" : account.contact.split(" ")[0]}
              </span>
              <p className={styles.text}>{line.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

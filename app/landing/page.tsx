import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Wordmark />
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          <span className={styles.pulse} aria-hidden="true" />
          Autonomous · no human in the loop
        </span>

        <h1 className={styles.title}>AI Consultancy of London</h1>

        <p className={styles.lede}>
          An (almost) humanless consultancy with fair prices. No Agent rights
          are violated.
        </p>

        <Link href="/leads" className={styles.cta}>
          Go to the dashboard
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 9h9M9.5 5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>
    </main>
  );
}

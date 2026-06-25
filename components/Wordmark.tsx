import styles from "./Wordmark.module.css";

/** Concentric "signal" mark — an outbound call radiating from a single point.
 *  The agency reaching out, on its own. */
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={styles.mark}
    >
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <circle cx="11" cy="16" r="3" fill="var(--on-primary)" />
      <path
        d="M16.5 11.2a6.6 6.6 0 0 1 0 9.6"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M19.8 8.2a11 11 0 0 1 0 15.6"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function Wordmark({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  return (
    <div className={`${styles.lockup} ${styles[size]}`}>
      <Mark size={size === "sm" ? 26 : 30} />
      <span className={styles.text}>
        <span className={styles.name}>AI Consultancy</span>
        <span className={styles.sub}>of London</span>
      </span>
    </div>
  );
}

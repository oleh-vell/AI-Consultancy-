import type { LeadStatus } from "@/lib/types";
import styles from "./ui.module.css";

/* ---- Avatar ---- */
export function Avatar({
  initials,
  hue,
  logo,
  size = 36,
}: {
  initials: string;
  hue: number;
  logo?: string | null;
  size?: number;
}) {
  return (
    <span
      className={styles.avatar}
      style={
        {
          width: size,
          height: size,
          fontSize: size * 0.36,
          "--ah": hue,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {/* Initials sit underneath; a logo (when present) overlays them, and
          shows through automatically if the image fails to load. */}
      {initials}
      {logo ? <img src={logo} alt="" className={styles.avatarLogo} /> : null}
    </span>
  );
}

/* ---- Status pill (lead lifecycle) ---- */
const STATUS_LABEL: Record<LeadStatus, string> = {
  queued: "Queued",
  calling: "Calling…",
  completed: "Completed",
  promoted: "Promoted",
};

export function StatusPill({
  status,
  size = "md",
}: {
  status: LeadStatus;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`${styles.pill} ${styles[size]}`}
      data-status={status}
    >
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---- Button ---- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md";
  iconLeft?: React.ReactNode;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  iconLeft,
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${styles["btn-" + size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        iconLeft && <span className={styles.btnIcon}>{iconLeft}</span>
      )}
      {children}
    </button>
  );
}

/* ---- Page header ---- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSub}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}

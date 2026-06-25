"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/data";
import { Button } from "./ui";
import type { Account } from "@/lib/types";
import styles from "./Bill.module.css";

export function Bill({ account }: { account: Account }) {
  const generateInvoice = useStore((s) => s.generateInvoice);
  const [generating, setGenerating] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);

  const invoice = account.invoice;

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => generateInvoice(account.id), 1100);
  };

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
    }, 1400);
  };

  if (!invoice) {
    return (
      <div className={styles.prompt}>
        <div className={styles.promptIcon}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9 8h6M9 11.5h6M9 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className={styles.promptTitle}>Close the loop</h2>
        <p className={styles.promptBody}>
          The engagement is scoped from the call. Generate the invoice to bill{" "}
          {account.company} — fixed fee, milestone terms, 20% VAT applied.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={handleGenerate}
          loading={generating}
        >
          {generating ? "Drafting invoice…" : "Generate invoice"}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.billWrap}>
      <div className={styles.actions}>
        <div className={styles.issued}>
          Invoice <strong>{invoice.number}</strong> · issued {invoice.issued}
        </div>
        <div className={styles.actionBtns}>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            Download PDF
          </Button>
          {!paid && (
            <Button variant="primary" size="sm" onClick={handlePay} loading={paying}>
              {paying ? "Processing…" : "Pay with Stripe"}
            </Button>
          )}
        </div>
      </div>

      <article className={styles.invoice} data-paid={paid}>
        {paid && <span className={styles.paidStamp}>Paid</span>}

        <header className={styles.invHead}>
          <div>
            <div className={styles.invFrom}>AI Consultancy of London</div>
            <div className={styles.invFromMeta}>
              71 Queen Victoria Street, London EC4V 4AY
              <br />
              VAT GB 438 1102 77 · hello@aiconsultancy.london
            </div>
          </div>
          <div className={styles.invNo}>
            <span className={styles.invNoLabel}>Invoice</span>
            <span className={`${styles.invNoVal} tnum`}>{invoice.number}</span>
          </div>
        </header>

        <div className={styles.invParties}>
          <div>
            <span className={styles.partyLabel}>Billed to</span>
            <span className={styles.partyName}>{account.company}</span>
            <span className={styles.partyMeta}>
              {account.contact}, {account.role}
              <br />
              {account.location}
            </span>
          </div>
          <div className={styles.invDates}>
            <Row label="Issued" value={invoice.issued} />
            <Row label="Due" value={invoice.due} />
            <Row label="Terms" value="On milestones" />
          </div>
        </div>

        <table className={styles.lines}>
          <thead>
            <tr>
              <th>Engagement item</th>
              <th className={styles.amtCol}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.label}>
                <td>
                  <span className={styles.lineLabel}>{l.label}</span>
                  <span className={styles.lineDetail}>{l.detail}</span>
                </td>
                <td className={`${styles.amtCol} ${styles.amt} tnum`}>
                  {money(l.amount, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.totals}>
          <Total label="Subtotal" value={money(invoice.subtotal, invoice.currency)} />
          <Total label="VAT (20%)" value={money(invoice.vat, invoice.currency)} />
          <Total
            label="Total due"
            value={money(invoice.total, invoice.currency)}
            grand
          />
        </div>

        <footer className={styles.invFoot}>
          <span>
            Generated autonomously from the discovery call with {account.contact}.
          </span>
          <span className={styles.stripeNote}>
            <StripeGlyph /> Secured by Stripe
          </span>
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.dateRow}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function Total({
  label,
  value,
  grand,
}: {
  label: string;
  value: string;
  grand?: boolean;
}) {
  return (
    <div className={`${styles.totalRow} ${grand ? styles.grand : ""}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function StripeGlyph() {
  return (
    <svg width="34" height="15" viewBox="0 0 34 15" fill="none" aria-hidden="true">
      <text
        x="0"
        y="12"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="700"
        fill="var(--primary-ink)"
      >
        stripe
      </text>
    </svg>
  );
}

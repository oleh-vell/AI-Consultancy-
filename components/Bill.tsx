"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/data";
import { Button } from "./ui";
import type { Account } from "@/lib/types";
import styles from "./Bill.module.css";

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb";

type PayPalState =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "approved"
  | "cancelled"
  | "error";

type PayPalOrderData = {
  orderID?: string;
};

type PayPalCaptureDetails = {
  id?: string;
  purchase_units?: {
    payments?: {
      captures?: { id?: string }[];
    };
  }[];
};

type PayPalButtonActions = {
  order: {
    create: (order: {
      intent: "CAPTURE";
      purchase_units: {
        description: string;
        invoice_id: string;
        custom_id: string;
        amount: { currency_code: string; value: string };
      }[];
    }) => Promise<string>;
    capture: () => Promise<PayPalCaptureDetails>;
  };
};

type PayPalButtonInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close: () => void;
  isEligible?: () => boolean;
};

type PayPalNamespace = {
  Buttons: (options: {
    style: {
      layout: "horizontal";
      color: "gold";
      shape: "rect";
      label: "pay";
      height: number;
      tagline: false;
    };
    createOrder: (
      data: PayPalOrderData,
      actions: PayPalButtonActions
    ) => Promise<string>;
    onApprove: (
      data: PayPalOrderData,
      actions: PayPalButtonActions
    ) => Promise<void>;
    onCancel: () => void;
    onError: (err: unknown) => void;
  }) => PayPalButtonInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let paypalScriptPromise: Promise<void> | null = null;
let paypalScriptKey: string | null = null;

function paypalCurrencyCode(currency: string) {
  if (currency === "£") return "GBP";
  if (currency === "$") return "USD";
  if (currency === "€") return "EUR";
  return currency.length === 3 ? currency.toUpperCase() : "USD";
}

function paymentAmount(total: number) {
  return total.toFixed(2);
}

function paymentDisplay(total: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
    }).format(total);
  } catch {
    return `${currencyCode} ${paymentAmount(total)}`;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

function customerPayPalLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "bill");
  url.searchParams.set("checkout", "paypal");
  return url.toString();
}

function loadPayPalScript(currencyCode: string) {
  if (typeof window === "undefined") return Promise.resolve();
  const key = `${PAYPAL_CLIENT_ID}:${currencyCode}`;
  if (window.paypal?.Buttons && paypalScriptKey === key) return Promise.resolve();
  if (window.paypal?.Buttons && paypalScriptKey !== key) {
    document.querySelectorAll("script[data-paypal-sdk]").forEach((script) => {
      script.remove();
    });
    delete window.paypal;
    paypalScriptPromise = null;
    paypalScriptKey = null;
  }
  if (paypalScriptPromise && paypalScriptKey === key) return paypalScriptPromise;

  paypalScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-paypal-sdk="${key}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("PayPal SDK failed to load")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": PAYPAL_CLIENT_ID,
      currency: currencyCode,
      intent: "capture",
      components: "buttons",
      "disable-funding": "card,credit,paylater,venmo",
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.dataset.paypalSdk = key;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("PayPal SDK failed to load")),
      { once: true }
    );
    document.head.appendChild(script);
  });
  paypalScriptKey = key;

  return paypalScriptPromise;
}

export function Bill({ account }: { account: Account }) {
  const generateInvoice = useStore((s) => s.generateInvoice);
  const [generating, setGenerating] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paypalState, setPayPalState] = useState<PayPalState>("idle");
  const [paypalError, setPayPalError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);
  const paypalButtonsRef = useRef<PayPalButtonInstance | null>(null);

  const invoice = account.invoice;
  const payPalCurrency = invoice ? paypalCurrencyCode(invoice.currency) : "USD";
  const payPalAmount = invoice ? paymentAmount(invoice.total) : "0.00";
  const payPalDisplay = invoice
    ? paymentDisplay(invoice.total, payPalCurrency)
    : "";

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => generateInvoice(account.id), 1100);
  };

  useEffect(() => {
    if (!invoice || paid) return;

    let alive = true;
    const container = paypalContainerRef.current;
    if (!container) return;

    setPayPalState("loading");
    setPayPalError(null);
    container.innerHTML = "";
    paypalButtonsRef.current?.close();

    loadPayPalScript(payPalCurrency)
      .then(() => {
        if (!alive || !container || !window.paypal?.Buttons) return;

        const buttons = window.paypal.Buttons({
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "rect",
            label: "pay",
            height: 35,
            tagline: false,
          },
          createOrder: (_data, actions) =>
            actions.order.create({
              intent: "CAPTURE",
              purchase_units: [
                {
                  description: `AI Consultancy of London sandbox charge for ${account.company}`,
                  invoice_id: invoice.number,
                  custom_id: account.id,
                  amount: {
                    currency_code: payPalCurrency,
                    value: payPalAmount,
                  },
                },
              ],
            }),
          onApprove: async (data, actions) => {
            setPayPalState("capturing");
            const details = await actions.order.capture();
            const captureId =
              details.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
              details.id ||
              data.orderID ||
              "SANDBOX-CAPTURE";
            setTransactionId(captureId);
            setPaid(true);
            setPayPalState("approved");
          },
          onCancel: () => {
            setPayPalState("cancelled");
          },
          onError: (err) => {
            console.error("PayPal sandbox checkout failed", err);
            setPayPalState("error");
            setPayPalError(
              "PayPal sandbox could not complete the checkout. Use the demo capture to keep the billing loop moving."
            );
          },
        });

        if (buttons.isEligible && !buttons.isEligible()) {
          setPayPalState("error");
          setPayPalError("PayPal checkout is not eligible in this browser.");
          return;
        }

        paypalButtonsRef.current = buttons;
        buttons
          .render(container)
          .then(() => {
            if (alive) setPayPalState("ready");
          })
          .catch((err) => {
            console.error("PayPal sandbox buttons failed to render", err);
            if (!alive) return;
            setPayPalState("error");
            setPayPalError(
              "PayPal sandbox buttons failed to render. Use the demo capture to keep the billing loop moving."
            );
          });
      })
      .catch((err) => {
        console.error("PayPal SDK failed to load", err);
        if (!alive) return;
        setPayPalState("error");
        setPayPalError(
          "PayPal sandbox is unavailable from this browser. Use the demo capture to generate a fake payment."
        );
      });

    return () => {
      alive = false;
      paypalButtonsRef.current?.close();
      paypalButtonsRef.current = null;
    };
  }, [account.company, account.id, invoice, paid, payPalAmount, payPalCurrency]);

  const handleDemoCapture = () => {
    setPayPalState("capturing");
    setPayPalError(null);
    setTimeout(() => {
      setTransactionId(`SANDBOX-${Date.now().toString(36).toUpperCase()}`);
      setPaid(true);
      setPayPalState("approved");
    }, 900);
  };

  const handleCopyLink = async () => {
    setCopyState("idle");
    try {
      await copyText(customerPayPalLink());
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
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
        </div>
      </div>

      {!paid && (
        <section className={styles.paypalPanel} aria-labelledby="paypal-title">
          <div>
            <h2 id="paypal-title" className={styles.paypalTitle}>
              PayPal sandbox checkout
            </h2>
            <p className={styles.paypalBody}>
              Charge {account.company}{" "}
              <strong>{payPalDisplay}</strong>{" "}
              through PayPal sandbox. This records the demo payment without
              touching live funds.
            </p>
          </div>
          <div className={styles.paypalAction}>
            <div ref={paypalContainerRef} className={styles.paypalButtons} />
            {paypalState === "loading" && (
              <p className={styles.paypalStatus}>Loading PayPal…</p>
            )}
            {paypalState === "capturing" && (
              <p className={styles.paypalStatus}>Capturing sandbox payment…</p>
            )}
            {paypalState === "cancelled" && (
              <p className={styles.paypalStatus}>Checkout cancelled.</p>
            )}
            {paypalError && (
              <p className={styles.paypalError}>{paypalError}</p>
            )}
            {copyState === "error" && (
              <p className={styles.paypalError}>
                Could not copy the link from this browser.
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              {copyState === "copied" ? "Copied PayPal link" : "Copy PayPal link"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDemoCapture}
              loading={paypalState === "capturing"}
            >
              Generate demo capture
            </Button>
          </div>
        </section>
      )}

      {paid && (
        <section className={styles.paypalPaid}>
          <span className={styles.paypalPaidMark} aria-hidden="true">
            Paid
          </span>
          <div>
            <h2 className={styles.paypalTitle}>PayPal sandbox payment captured</h2>
            <p className={styles.paypalBody}>
              Recorded {payPalDisplay}
              {transactionId ? (
                <>
                  {" "}
                  · transaction <span className="tnum">{transactionId}</span>
                </>
              ) : null}
            </p>
          </div>
        </section>
      )}

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
          <span className={styles.paypalNote}>
            <PayPalGlyph /> PayPal sandbox
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

function PayPalGlyph() {
  return (
    <svg width="48" height="15" viewBox="0 0 48 15" fill="none" aria-hidden="true">
      <text
        x="0"
        y="12"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="700"
        fill="var(--primary-ink)"
      >
        PayPal
      </text>
    </svg>
  );
}

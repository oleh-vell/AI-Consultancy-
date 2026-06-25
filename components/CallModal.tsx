"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTypewriter } from "@/lib/useTypewriter";
import { startRing, stopRing, chime } from "@/lib/ring";
import { Avatar, Button } from "./ui";
import type { Lead, DiscoveryAnswer } from "@/lib/types";
import styles from "./CallModal.module.css";

type Phase = "ringing" | "live" | "wrapup";

interface Turn {
  text: string;
  awaits: boolean;
  qIndex?: number;
  last?: boolean;
}

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function CallModal({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const router = useRouter();
  const setLeadStatus = useStore((s) => s.setLeadStatus);
  const promoteLead = useStore((s) => s.promoteLead);
  const discovery = useStore((s) => s.discovery);

  const [phase, setPhase] = useState<Phase>("ringing");
  const [turnIndex, setTurnIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);

  const first = lead.contact.split(" ")[0];
  const turns: Turn[] = [
    {
      text: `Hello ${first}, this is the AI Consultancy of London. Thanks for picking up — I'd like to understand where ${lead.company} is losing time, then put a tailored plan together. Mind if I ask three quick questions?`,
      awaits: false,
    },
    ...discovery.map((q, i) => ({
      text: q.prompt,
      awaits: true,
      qIndex: i,
    })),
    {
      text: `Perfect — that's everything I need. I'm drafting your engagement plan and promoting ${lead.company} to an active account now. Thank you, ${first}.`,
      awaits: false,
      last: true,
    },
  ];

  const active = turns[turnIndex];
  const { out, done } = useTypewriter(phase === "live" ? active?.text ?? "" : "");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  /* ---- ringing audio + body scroll lock ---- */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      stopRing();
    };
  }, []);

  useEffect(() => {
    if (phase === "ringing") startRing();
    else stopRing();
  }, [phase]);

  /* ---- call timer ---- */
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  /* ---- auto-advance non-awaiting agent turns ---- */
  useEffect(() => {
    if (phase !== "live" || !done || !active) return;
    if (active.awaits) {
      composerRef.current?.focus();
      return;
    }
    const delay = active.last ? 900 : 650;
    const id = setTimeout(() => {
      if (active.last) finish();
      else setTurnIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, done, turnIndex]);

  /* keep transcript scrolled to newest line */
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [out, answers.length, turnIndex]);

  const accept = useCallback(() => {
    stopRing();
    chime();
    setLeadStatus(lead.id, "calling");
    setPhase("live");
  }, [lead.id, setLeadStatus]);

  const finish = useCallback(() => {
    const collected: DiscoveryAnswer[] = answers.map((a, i) => ({
      q: discovery[i].prompt,
      a,
      tag: discovery[i].tag,
    }));
    chime();
    setPhase("wrapup");
    // Persist in the background; the wrap-up ladder animates while it lands.
    promoteLead(lead.id, collected, fmtTime(seconds || 1))
      .then(setAccountId)
      .catch(() => setAccountId(null));
  }, [answers, discovery, lead.id, promoteLead, seconds]);

  const submitAnswer = () => {
    const text = draft.trim();
    if (!text || !active?.awaits) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[active.qIndex!] = text;
      return next;
    });
    setDraft("");
    setTurnIndex((i) => i + 1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  /* escape to dismiss while ringing */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "ringing") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={phase === "ringing" ? onClose : undefined}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Call with ${lead.contact}, ${lead.company}`}
        onMouseDown={(e) => e.stopPropagation()}
        data-phase={phase}
      >
        {phase === "ringing" && (
          <Ringing lead={lead} onAccept={accept} onDecline={onClose} />
        )}

        {phase === "live" && (
          <div className={styles.live}>
            <CallHeader lead={lead} seconds={seconds} />
            <div className={styles.log} ref={logRef}>
              {turns.slice(0, turnIndex).map((t, i) => (
                <div key={i} className={styles.exchange}>
                  <Bubble speaker="agent" text={t.text} />
                  {t.awaits && answers[t.qIndex!] && (
                    <Bubble speaker="client" text={answers[t.qIndex!]} />
                  )}
                </div>
              ))}
              {active && (
                <div className={styles.exchange}>
                  <Bubble speaker="agent" text={out} typing={!done} />
                </div>
              )}
            </div>

            {active?.awaits && done ? (
              <div className={styles.composer}>
                <button
                  type="button"
                  className={styles.suggest}
                  onClick={() => {
                    setDraft(discovery[active.qIndex!].suggestion);
                    composerRef.current?.focus();
                  }}
                >
                  <span className={styles.suggestDot} />
                  Use suggested answer
                </button>
                <div className={styles.inputRow}>
                  <textarea
                    ref={composerRef}
                    className={styles.input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKey}
                    placeholder={discovery[active.qIndex!].placeholder}
                    rows={1}
                  />
                  <Button variant="primary" onClick={submitAnswer} disabled={!draft.trim()}>
                    Reply
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.listening}>
                <Waveform />
                <span>{done ? "Listening…" : "Speaking…"}</span>
              </div>
            )}
          </div>
        )}

        {phase === "wrapup" && (
          <Wrapup
            lead={lead}
            answers={answers}
            onOpen={() => {
              onClose();
              router.push(accountId ? `/accounts/${accountId}` : "/accounts");
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Ringing ---------- */
function Ringing({
  lead,
  onAccept,
  onDecline,
}: {
  lead: Lead;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className={styles.ringing}>
      <span className={styles.incoming}>Outbound call · connecting</span>
      <div className={styles.ringAvatar}>
        <span className={styles.ringWave} />
        <span className={styles.ringWave} style={{ animationDelay: "0.6s" }} />
        <Avatar initials={lead.initials} hue={lead.hue} size={84} />
      </div>
      <h2 className={styles.ringName}>{lead.contact}</h2>
      <p className={styles.ringMeta}>
        {lead.role} · {lead.company}
      </p>
      <p className={styles.ringPhone + " tnum"}>{lead.phone}</p>
      <div className={styles.ringActions}>
        <button className={`${styles.ringBtn} ${styles.decline}`} onClick={onDecline} aria-label="Decline">
          <PhoneDown />
        </button>
        <button className={`${styles.ringBtn} ${styles.answer}`} onClick={onAccept} aria-label="Answer">
          <PhoneUp />
        </button>
      </div>
      <span className={styles.ringHint}>The agent is calling — pick up to run discovery</span>
    </div>
  );
}

/* ---------- Live sub-parts ---------- */
function CallHeader({ lead, seconds }: { lead: Lead; seconds: number }) {
  return (
    <header className={styles.callHead}>
      <Avatar initials={lead.initials} hue={lead.hue} size={38} />
      <div className={styles.callWho}>
        <span className={styles.callName}>{lead.contact}</span>
        <span className={styles.callSub}>{lead.company}</span>
      </div>
      <div className={styles.callTimer}>
        <span className={styles.recDot} />
        <span className="tnum">{fmtTime(seconds)}</span>
      </div>
    </header>
  );
}

function Bubble({
  speaker,
  text,
  typing,
}: {
  speaker: "agent" | "client";
  text: string;
  typing?: boolean;
}) {
  return (
    <div className={`${styles.bubbleRow} ${styles[speaker]}`}>
      <span className={styles.bubbleWho}>
        {speaker === "agent" ? "AI Agent" : "Client"}
      </span>
      <div className={styles.bubble}>
        {text}
        {typing && <span className={styles.caret} />}
      </div>
    </div>
  );
}

function Waveform() {
  return (
    <span className={styles.wave} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

/* ---------- Wrapup ladder ---------- */
const LADDER = ["Queued", "Calling", "Completed", "Promoted to account"] as const;

function Wrapup({
  lead,
  answers,
  onOpen,
}: {
  lead: Lead;
  answers: string[];
  onOpen: () => void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => (s < LADDER.length ? s + 1 : s)),
      460
    );
    return () => clearInterval(id);
  }, []);
  const complete = step >= LADDER.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.wrapHead}>
        <Avatar initials={lead.initials} hue={lead.hue} size={44} />
        <div>
          <h2 className={styles.wrapTitle}>{lead.company}</h2>
          <p className={styles.wrapSub}>Discovery complete · {answers.filter(Boolean).length} answers captured</p>
        </div>
      </div>

      <ol className={styles.ladder}>
        {LADDER.map((label, i) => {
          const state = step > i ? "done" : step === i ? "active" : "todo";
          return (
            <li key={label} className={styles.rung} data-state={state}>
              <span className={styles.rungMark}>
                {step > i ? <Check /> : <span className={styles.rungDot} />}
              </span>
              <span className={styles.rungLabel}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className={`${styles.wrapArtifacts} ${complete ? styles.shown : ""}`}>
        <Artifact label="Call transcript" sub="Logged to activity" />
        <Artifact label="Pitch deck" sub="6 slides, drafted from the call" />
        <Artifact label="Account record" sub="Enriched & ready" />
      </div>

      <Button
        variant="primary"
        size="md"
        className={styles.wrapCta}
        onClick={onOpen}
        disabled={!complete}
      >
        {complete ? `Open ${lead.company}` : "Promoting…"}
        <Arrow />
      </Button>
    </div>
  );
}

function Artifact({ label, sub }: { label: string; sub: string }) {
  return (
    <div className={styles.artifact}>
      <Check small />
      <div>
        <span className={styles.artLabel}>{label}</span>
        <span className={styles.artSub}>{sub}</span>
      </div>
    </div>
  );
}

/* ---------- icons ---------- */
function PhoneUp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3.5 9 4l1 3.5L8 9a11 11 0 0 0 7 7l1.5-2 3.5 1 .5 2.5c0 .8-.7 1.5-1.5 1.5A15 15 0 0 1 5 5c0-.8.7-1.5 1.5-1.5Z" fill="currentColor" />
    </svg>
  );
}
function PhoneDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <g transform="rotate(135 12 12)">
        <path d="M6.5 3.5 9 4l1 3.5L8 9a11 11 0 0 0 7 7l1.5-2 3.5 1 .5 2.5c0 .8-.7 1.5-1.5 1.5A15 15 0 0 1 5 5c0-.8.7-1.5 1.5-1.5Z" fill="currentColor" />
      </g>
    </svg>
  );
}
function Check({ small }: { small?: boolean }) {
  return (
    <svg width={small ? 13 : 15} height={small ? 13 : 15} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h9M8.5 4 12.5 8 8.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

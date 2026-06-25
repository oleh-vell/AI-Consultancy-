"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { startRing, stopRing, chime } from "@/lib/ring";
import {
  startCall,
  fetchConversation,
  CallConfigError,
  type ConversationSnapshot,
} from "@/lib/callClient";
import { Avatar, Button } from "./ui";
import type { Lead, TranscriptLine } from "@/lib/types";
import styles from "./CallModal.module.css";

/**
 * Live (fully-real) call: fires the ElevenLabs outbound call so the user's phone
 * actually rings, streams the real transcript as they talk, then promotes the lead
 * from the REAL extracted answers — so the deck quotes what was said on the call.
 *
 * Self-contained on purpose: it reuses CallModal.module.css for identical styling
 * but touches none of the simulated CallModal's logic.
 */

type Phase = "dialing" | "live" | "wrapup" | "error";

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const POLL_MS = 3000;
const MAX_MS = 4 * 60_000;

function isConnected(status: string) {
  const s = (status || "").toLowerCase();
  return s.includes("progress") || s.includes("ongoing") || s === "in-progress";
}

export function LiveCallModal({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const router = useRouter();
  const setLeadStatus = useStore((s) => s.setLeadStatus);
  const promoteLead = useStore((s) => s.promoteLead);

  const [phase, setPhase] = useState<Phase>("dialing");
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const logRef = useRef<HTMLDivElement | null>(null);
  const finishedRef = useRef(false);
  const first = lead.contact.split(" ")[0];

  /* ---- body scroll lock + ring audio ---- */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    startRing();
    return () => {
      document.body.style.overflow = "";
      stopRing();
    };
  }, []);

  useEffect(() => {
    if (connected) stopRing();
  }, [connected]);

  /* ---- call timer (starts once connected) ---- */
  useEffect(() => {
    if (!connected || phase === "wrapup") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connected, phase]);

  /* keep transcript scrolled to newest line */
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript.length]);

  const finish = useCallback(
    async (snap: ConversationSnapshot) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      stopRing();
      chime();
      try {
        await setLeadStatus(lead.id, "completed");
        const id = await promoteLead(
          lead.id,
          snap.answers,
          snap.duration,
          snap.transcript // verbatim call transcript → Activity tab
        );
        setAccountId(id);
        setPhase("wrapup");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to promote the lead"
        );
        setPhase("error");
      }
    },
    [lead.id, promoteLead, setLeadStatus]
  );

  /* ---- start the real call + poll the transcript ---- */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    (async () => {
      let convId: string;
      try {
        convId = await startCall(lead); // phone rings here
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof CallConfigError
            ? "ElevenLabs keys are missing. Add them to .env.local and restart the dev server."
            : err instanceof Error
              ? err.message
              : "Could not start the call"
        );
        setPhase("error");
        return;
      }
      if (cancelled) return;
      setLeadStatus(lead.id, "calling"); // optimistic; flips the leads table

      const poll = async () => {
        if (cancelled) return;
        try {
          const snap = await fetchConversation(convId);
          if (cancelled) return;
          if (snap.transcript.length) setTranscript(snap.transcript);
          if (snap.transcript.length || isConnected(snap.status)) {
            setConnected(true);
            setPhase((p) => (p === "dialing" ? "live" : p));
          }
          if (snap.done) {
            finish(snap);
            return;
          }
          // Safety net: if the call drags past the cap but we have answers, wrap up.
          if (Date.now() - startedAt > MAX_MS) {
            if (snap.answers.some((a) => a.a)) finish(snap);
            else {
              setErrorMsg("Timed out waiting for the call to complete.");
              setPhase("error");
            }
            return;
          }
        } catch {
          // transient lookup error (e.g. transcript not ready yet) — keep polling
        }
        timer = setTimeout(poll, POLL_MS);
      };
      poll();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={phase === "dialing" || phase === "error" ? onClose : undefined}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Live call with ${lead.contact}, ${lead.company}`}
        onMouseDown={(e) => e.stopPropagation()}
        data-phase={phase === "wrapup" ? "wrapup" : "live"}
      >
        {phase === "dialing" && (
          <Dialing lead={lead} onCancel={onClose} />
        )}

        {phase === "live" && (
          <div className={styles.live}>
            <CallHeader lead={lead} seconds={seconds} />
            <div className={styles.log} ref={logRef}>
              {transcript.length === 0 ? (
                <div className={styles.exchange}>
                  <Bubble
                    speaker="agent"
                    text={`Connecting with ${first}…`}
                    typing
                  />
                </div>
              ) : (
                transcript.map((t, i) => (
                  <div key={i} className={styles.exchange}>
                    <Bubble speaker={t.speaker} text={t.text} />
                  </div>
                ))
              )}
            </div>
            <div className={styles.listening}>
              <Waveform />
              <span>Live on your phone · discovery in progress</span>
            </div>
          </div>
        )}

        {phase === "wrapup" && (
          <Wrapup
            lead={lead}
            answerCount={transcript.filter((t) => t.speaker === "client").length}
            onOpen={() => {
              onClose();
              if (accountId) router.push(`/accounts/${accountId}`);
            }}
          />
        )}

        {phase === "error" && (
          <ErrorPane lead={lead} message={errorMsg} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* ---------- Dialing (real phone ringing) ---------- */
function Dialing({ lead, onCancel }: { lead: Lead; onCancel: () => void }) {
  return (
    <div className={styles.ringing}>
      <span className={styles.incoming}>Outbound call · dialing your phone</span>
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
        <button
          className={`${styles.ringBtn} ${styles.decline}`}
          onClick={onCancel}
          aria-label="Cancel"
        >
          <PhoneDown />
        </button>
      </div>
      <span className={styles.ringHint}>
        Your phone is ringing — pick up to run discovery out loud
      </span>
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
  answerCount,
  onOpen,
}: {
  lead: Lead;
  answerCount: number;
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
          <p className={styles.wrapSub}>
            Discovery complete · {answerCount} replies captured live
          </p>
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
        <Artifact label="Pitch deck" sub="Drafted from the live call" />
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

/* ---------- Error pane ---------- */
function ErrorPane({
  lead,
  message,
  onClose,
}: {
  lead: Lead;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.ringing}>
      <span className={styles.incoming}>Call could not complete</span>
      <div className={styles.ringAvatar}>
        <Avatar initials={lead.initials} hue={lead.hue} size={84} />
      </div>
      <h2 className={styles.ringName}>{lead.company}</h2>
      <p className={styles.ringMeta} style={{ maxWidth: 320, textAlign: "center" }}>
        {message}
      </p>
      <div style={{ marginTop: 18 }}>
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

/* ---------- icons ---------- */
function PhoneDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <g transform="rotate(135 12 12)">
        <path
          d="M6.5 3.5 9 4l1 3.5L8 9a11 11 0 0 0 7 7l1.5-2 3.5 1 .5 2.5c0 .8-.7 1.5-1.5 1.5A15 15 0 0 1 5 5c0-.8.7-1.5 1.5-1.5Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
function Check({ small }: { small?: boolean }) {
  return (
    <svg
      width={small ? 13 : 15}
      height={small ? 13 : 15}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8h9M8.5 4 12.5 8 8.5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

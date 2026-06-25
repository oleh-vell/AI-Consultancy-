"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTypewriter } from "@/lib/useTypewriter";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { startRing, stopRing, chime } from "@/lib/ring";
import {
  startCall,
  fetchConversation,
  CallConfigError,
  type ConversationSnapshot,
} from "@/lib/callClient";
import { Avatar, Button } from "./ui";
import type { Lead, DiscoveryAnswer, TranscriptLine } from "@/lib/types";
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

const POLL_MS = 2500;
const MAX_MS = 4 * 60_000;
// How long the agent dwells on a question before moving on, when the caller's
// real answer hasn't surfaced yet (ElevenLabs usually only finalizes it at call end).
const QUESTION_DWELL_MS = 15_000;
const GREETING_DWELL_MS = 1_400;

const FALLBACK_QS = [
  "To start — what's the single biggest operational bottleneck your team is hitting right now?",
  "And if one part of that were automated tomorrow, which would move the needle most?",
  "Last one — what's your rough timeline and budget for getting this solved?",
];

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
  const discovery = useStore((s) => s.discovery);
  const { supported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("dialing");
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [step, setStep] = useState(0); // index into agentLines; === length → wrapping
  const [answers, setAnswers] = useState<DiscoveryAnswer[]>([]);
  const [liveAnswers, setLiveAnswers] = useState<string[]>([]); // browser-transcribed, by qIndex
  const [interim, setInterim] = useState(""); // in-progress words for the current question
  const [seconds, setSeconds] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const logRef = useRef<HTMLDivElement | null>(null);
  const finishedRef = useRef(false);
  // Set once we've optimistically flipped the lead to "calling", so the unmount
  // cleanup knows whether it owns a rollback.
  const callingRef = useRef(false);
  const qRef = useRef<number | null>(null); // current question index for the mic callback
  const acceptRef = useRef(false); // only capture speech during a question's answer window
  const liveAnswersRef = useRef<string[]>([]); // mirror of liveAnswers for finish()
  const first = lead.contact.split(" ")[0];

  /* ---- the agent's script: greeting + three discovery questions ----
     ElevenLabs only finalizes the transcript after the call ends, so mid-call we
     stream the agent's side (it really is asking these), show a "listening" state
     while the caller replies, and merge real answers in as polling surfaces them. */
  const prompts =
    discovery.length >= 3
      ? discovery.slice(0, 3).map((d) => d.prompt)
      : FALLBACK_QS;
  const greeting = `Hello ${first} — this is the AI Consultancy of London. Thanks for picking up. Mind if I ask three quick questions about where ${lead.company} is losing time?`;
  const agentLines: { text: string; qIndex?: number }[] = [
    { text: greeting },
    ...prompts.map((text, qIndex) => ({ text, qIndex })),
  ];
  const current = step < agentLines.length ? agentLines[step] : null;
  const wrapping = step >= agentLines.length;
  const { out, done: typed } = useTypewriter(current?.text ?? "");
  const answerFor = (qIndex: number) => answers[qIndex]?.a?.trim() || "";
  // What to show as the caller's reply: live browser captions first (with the
  // in-progress words for the active question), else the answer ElevenLabs
  // extracted — which only lands at call end.
  const displayAnswer = (qIndex: number, isCurrent: boolean) =>
    (
      (liveAnswers[qIndex] || "") + (isCurrent && interim ? " " + interim : "")
    ).trim() || answerFor(qIndex);

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
  }, [step, out, answers]);

  /* ---- mic: transcribe the caller live from the laptop microphone ---- */
  useEffect(() => {
    if (phase !== "live" || !micSupported) return;
    startMic((text, isFinal) => {
      if (!acceptRef.current) return; // ignore the agent's own audio / dead air
      const idx = qRef.current;
      if (idx == null) return;
      if (isFinal) {
        setLiveAnswers((prev) => {
          const n = [...prev];
          n[idx] = ((n[idx] || "") + " " + text).trim();
          liveAnswersRef.current = n;
          return n;
        });
        setInterim("");
      } else {
        setInterim(text);
      }
    });
    return () => stopMic();
  }, [phase, micSupported, startMic, stopMic]);

  /* attribute the mic's speech to the question currently being asked */
  useEffect(() => {
    qRef.current = current?.qIndex ?? null;
    setInterim("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* only capture speech once the agent has finished asking a question */
  useEffect(() => {
    acceptRef.current = phase === "live" && current?.qIndex != null && typed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, typed]);

  /* ---- drive the agent through its script while the call is live ---- */
  useEffect(() => {
    if (phase !== "live" || !current || !typed) return;
    // Greeting: a brief beat, then the first question.
    if (current.qIndex == null) {
      const t = setTimeout(() => setStep((s) => s + 1), GREETING_DWELL_MS);
      return () => clearTimeout(t);
    }
    // Question: once the caller has said something, advance shortly after they
    // pause (interim updates keep resetting this timer); else fall back to a dwell.
    const idx = current.qIndex;
    const spoke = !!liveAnswers[idx]?.trim() || !!answerFor(idx);
    const wait = spoke ? 1900 : QUESTION_DWELL_MS;
    const t = setTimeout(() => setStep((s) => s + 1), wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, typed, answers, liveAnswers, interim]);

  const finish = useCallback(
    async (snap: ConversationSnapshot) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      stopRing();
      chime();
      try {
        await setLeadStatus(lead.id, "completed");
        // Prefer ElevenLabs' finalized data; fall back to what we captured live
        // in the browser if EL returned nothing usable (so the deck/activity is
        // never blank after a real conversation).
        const live = liveAnswersRef.current;
        const elHasAnswers = snap.answers.some((a) => a.a);
        const liveHasAnswers = live.some((a) => a?.trim());
        const tags = ["bottleneck", "leverage", "timeline"];
        const finalAnswers =
          elHasAnswers || !liveHasAnswers
            ? snap.answers
            : tags.map((tag, i) => ({
                q: agentLines[i + 1]?.text ?? "",
                a: (live[i] || "").trim(),
                tag,
              }));
        const finalTranscript: TranscriptLine[] =
          snap.transcript.length > 0
            ? snap.transcript
            : agentLines.flatMap((l) =>
                l.qIndex != null && live[l.qIndex]?.trim()
                  ? [
                      { speaker: "agent" as const, text: l.text },
                      { speaker: "client" as const, text: live[l.qIndex].trim() },
                    ]
                  : [{ speaker: "agent" as const, text: l.text }]
              );
        const id = await promoteLead(
          lead.id,
          finalAnswers,
          snap.duration,
          finalTranscript
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lead.id, promoteLead, setLeadStatus]
  );

  /* ---- terminal failure / abort: never leave the lead stuck in "calling" ---- */
  const bail = useCallback(
    (message: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      stopRing();
      // Roll the lead back to "queued" so it's callable again, not stranded.
      setLeadStatus(lead.id, "queued");
      setErrorMsg(message);
      setPhase("error");
    },
    [lead.id, setLeadStatus]
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
      callingRef.current = true;
      setLeadStatus(lead.id, "calling"); // optimistic; flips the leads table

      const poll = async () => {
        if (cancelled) return;
        try {
          const snap = await fetchConversation(convId);
          if (cancelled) return;
          if (snap.transcript.length) setTranscript(snap.transcript);
          if (snap.answers.some((a) => a.a)) setAnswers(snap.answers);
          if (snap.transcript.length || isConnected(snap.status)) {
            setConnected(true);
            setPhase((p) => (p === "dialing" ? "live" : p));
          }
          if (snap.done) {
            finish(snap);
            return;
          }
          // Call ended in a failure/hangup state. If discovery still captured
          // real answers, promote from them; otherwise release the lead back to
          // the queue instead of leaving it stuck in "calling".
          if (snap.failed || (snap.ended && !snap.done)) {
            if (snap.answers.some((a) => a.a)) finish(snap);
            else bail("The call ended before discovery completed — lead returned to the queue.");
            return;
          }
          // Safety net: if the call drags past the cap but we have answers, wrap up.
          if (Date.now() - startedAt > MAX_MS) {
            if (snap.answers.some((a) => a.a)) finish(snap);
            else bail("Timed out waiting for the call to complete — lead returned to the queue.");
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
      // If the modal is torn down mid-call (user closed it or navigated away)
      // before any terminal outcome, roll the lead back to "queued" so it's
      // never permanently stranded in "calling".
      if (callingRef.current && !finishedRef.current) {
        finishedRef.current = true;
        setLeadStatus(lead.id, "queued");
      }
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
              {agentLines.slice(0, step).map((line, i) => (
                <div key={i} className={styles.exchange}>
                  <Bubble speaker="agent" text={line.text} />
                  {line.qIndex != null && displayAnswer(line.qIndex, false) && (
                    <Bubble
                      speaker="client"
                      text={displayAnswer(line.qIndex, false)}
                    />
                  )}
                </div>
              ))}

              {current && (
                <div className={styles.exchange}>
                  <Bubble speaker="agent" text={out} typing={!typed} />
                  {typed &&
                    current.qIndex != null &&
                    (displayAnswer(current.qIndex, true) ? (
                      <Bubble
                        speaker="client"
                        text={displayAnswer(current.qIndex, true)}
                        typing={!!interim}
                      />
                    ) : (
                      <ListeningRow label={`${first} is answering…`} />
                    ))}
                </div>
              )}

              {wrapping && <ListeningRow label="Wrapping up the call…" />}
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
            answerCount={
              answers.filter((a) => a.a).length ||
              transcript.filter((t) => t.speaker === "client").length
            }
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
        <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={84} />
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
      <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={38} />
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

function ListeningRow({ label }: { label: string }) {
  return (
    <div className={styles.listening}>
      <Waveform />
      <span>{label}</span>
    </div>
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
        <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={44} />
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
        <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={84} />
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

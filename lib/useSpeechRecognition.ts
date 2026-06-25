"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper over the browser Web Speech API (Chrome/Edge: webkitSpeechRecognition).
 * Used to transcribe the caller LIVE from the laptop microphone while they talk on
 * the phone — ElevenLabs only finalizes the call transcript after hang-up, so this
 * is what gives the modal real-time captions of what the user is saying.
 *
 * Gracefully no-ops where unsupported (e.g. Safari/Firefox); callers fall back to
 * the scripted "listening…" state.
 */

type ResultCb = (text: string, isFinal: boolean) => void;

// Minimal shape — the DOM lib doesn't ship SpeechRecognition types.
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SRResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}
interface SRResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

function getCtor(): (new () => SRInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRInstance;
    webkitSpeechRecognition?: new () => SRInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SRInstance | null>(null);
  const activeRef = useRef(false);
  const cbRef = useRef<ResultCb | null>(null);

  useEffect(() => {
    setSupported(!!getCtor());
  }, []);

  const start = useCallback((onResult: ResultCb) => {
    const Ctor = getCtor();
    if (!Ctor || activeRef.current) return;
    cbRef.current = onResult;

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: SRResultEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) cbRef.current?.(txt.trim(), true);
        else interim += txt;
      }
      if (interim.trim()) cbRef.current?.(interim.trim(), false);
    };
    // The API stops itself periodically; restart while we still want to listen.
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = () => {
      /* ignore transient no-speech / network errors; onend will restart */
    };

    recRef.current = rec;
    activeRef.current = true;
    try {
      rec.start();
    } catch {
      /* start() can throw if called twice in a tick */
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    },
    []
  );

  return { supported, start, stop };
}

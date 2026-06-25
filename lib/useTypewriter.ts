"use client";

import { useEffect, useState, useRef } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types out `text` character by character. Returns the visible slice and a
 *  `done` flag. Respects reduced-motion (renders instantly). */
export function useTypewriter(text: string, speed = 18, startDelay = 220) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOut("");
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }
    if (prefersReduced()) {
      setOut(text);
      setDone(true);
      return;
    }
    let i = 0;
    const tick = () => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        return;
      }
      // vary cadence slightly at sentence breaks for a natural read
      const ch = text[i - 1];
      const pause = ch === "." || ch === "?" || ch === "—" ? speed * 8 : speed;
      timer.current = setTimeout(tick, pause);
    };
    timer.current = setTimeout(tick, startDelay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, speed, startDelay]);

  return { out, done };
}

"use client";

/** A soft, two-tone "UK ringtone"-ish cadence via Web Audio.
 *  Safe to call after a user gesture (the Call-now click). No-ops on failure. */
let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;

export function startRing() {
  stopRing();
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") ctx.resume();

    let cancelled = false;
    const ring = () => {
      if (cancelled || !ctx) return;
      // UK double-ring: two short bursts, then a gap
      pip(ctx, 0);
      pip(ctx, 0.4);
    };
    ring();
    const id = setInterval(ring, 2400);
    stopFn = () => {
      cancelled = true;
      clearInterval(id);
    };
  } catch {
    /* audio not available — silent */
  }
}

function pip(ac: AudioContext, offset: number) {
  const t = ac.currentTime + offset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.setValueAtTime(480, t + 0.18);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
  gain.gain.setValueAtTime(0.05, t + 0.32);
  gain.gain.linearRampToValueAtTime(0, t + 0.36);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.38);
}

export function stopRing() {
  if (stopFn) stopFn();
  stopFn = null;
}

/** Soft confirmation chime when the call connects / completes. */
export function chime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    [659.25, 880].forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const s = t + i * 0.1;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.045, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
      osc.connect(g).connect(ctx!.destination);
      osc.start(s);
      osc.stop(s + 0.5);
    });
  } catch {
    /* silent */
  }
}

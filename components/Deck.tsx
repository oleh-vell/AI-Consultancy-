"use client";

import { useEffect, useState } from "react";
import type { Account, Slide } from "@/lib/types";
import styles from "./Deck.module.css";

export function Deck({ account }: { account: Account }) {
  const [i, setI] = useState(0);
  const slides = account.deck;
  const slide = slides[i];

  const go = (n: number) =>
    setI((cur) => Math.max(0, Math.min(slides.length - 1, cur + n)));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.genBadge}>
          <span className={styles.genDot} />
          Generated from the discovery call
        </div>
        <button className={styles.export} onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </div>

      <div className={styles.stage}>
        <SlideView slide={slide} index={i} total={slides.length} />
      </div>

      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={() => go(-1)}
          disabled={i === 0}
          aria-label="Previous slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className={`${styles.counter} tnum`}>
          {String(i + 1).padStart(2, "0")} <span>/ {String(slides.length).padStart(2, "0")}</span>
        </span>
        <button
          className={styles.navBtn}
          onClick={() => go(1)}
          disabled={i === slides.length - 1}
          aria-label="Next slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className={styles.thumbs}>
        {slides.map((s, idx) => (
          <button
            key={idx}
            className={`${styles.thumb} ${idx === i ? styles.thumbActive : ""}`}
            onClick={() => setI(idx)}
            data-kind={s.kind}
          >
            <span className={`${styles.thumbNo} tnum`}>{idx + 1}</span>
            <span className={styles.thumbTitle}>{s.eyebrow}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlideView({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  const isCover = slide.kind === "cover";
  return (
    <article className={styles.slide} data-cover={isCover} key={index}>
      <div className={styles.slideTop}>
        <span className={styles.eyebrow}>{slide.eyebrow}</span>
        <span className={styles.deckMark}>AI Consultancy of London</span>
      </div>

      <div className={styles.slideBody}>
        <h2 className={styles.slideTitle} data-cover={isCover}>
          {slide.title}
        </h2>

        {slide.quote && (
          <blockquote className={styles.quote}>
            <span className={styles.quoteMark}>“</span>
            {slide.quote}
          </blockquote>
        )}

        {slide.body && <p className={styles.slideText}>{slide.body}</p>}

        {slide.bullets && (
          <ul className={styles.bullets}>
            {slide.bullets.map((b, k) => (
              <li key={k}>
                <span className={styles.bulletMark}>{String(k + 1).padStart(2, "0")}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.slideFoot}>
        <span>{slide.eyebrow}</span>
        <span className="tnum">{index + 1} of {total}</span>
      </div>
    </article>
  );
}

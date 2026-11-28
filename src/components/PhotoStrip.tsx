import { useLayoutEffect, useRef, useState } from 'react';
import { siteUrl } from '../config';
import { t, type Lang } from '../i18n';
import { HEADER_ASPECT } from '../lib/photos';
import type { PublicPlace } from '../lib/schema';

/** How long scrolling must be still before a wrap jump (browsers without `scrollend`). */
const SETTLE_MS = 120;

/**
 * A place's own photos as one swipeable 2:1 strip under its name (CLAUDE.md, "Photos"). Sideways
 * swipe (or ‹ › on a mouse) moves one photo at a time; the browser's scroll snapping does the
 * paging, so there's no carousel library. Each photo shows its own credit, if it has one (R's own photos have none; the license
 * stays in the YAML as R's record).
 *
 * It goes round: past the last photo comes the first, and before the first the last. With two or
 * more photos the strip holds a copy of the last photo before the first and a copy of the first
 * after the last; when scrolling settles on a copy, it jumps without animation to the real photo,
 * which looks the same.
 */
export function PhotoStrip({
  photos,
  lang,
}: {
  photos: NonNullable<PublicPlace['photos']>;
  lang: Lang;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;
  const n = photos.length;
  /** What's in the strip: [last copy, ...photos, first copy] when it goes round. */
  const slides = many ? [photos[n - 1]!, ...photos, photos[0]!] : photos;
  // Start on the first real photo (position 1, past the copy of the last), before the first paint.
  useLayoutEffect(() => {
    const el = strip.current;
    if (el && many) el.scrollLeft = el.clientWidth;
  }, [many]);

  // When scrolling has settled on a copy, jump to the real photo it copies.
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el || !many) return;
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      const pos = Math.round(el.scrollLeft / el.clientWidth);
      if (pos === 0) el.scrollLeft = n * el.clientWidth;
      else if (pos === n + 1) el.scrollLeft = el.clientWidth;
    };
    const onScroll = () => {
      // Slide position → real photo: position 1 is photo 0, and the copies count as what they copy.
      const pos = Math.round(el.scrollLeft / el.clientWidth);
      setIndex((pos - 1 + n) % n);
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', settle);
    };
  }, [many, n]);

  const step = (by: number) => {
    const el = strip.current;
    if (el) el.scrollBy({ left: by * el.clientWidth, behavior: 'smooth' });
  };

  const current = photos[index] ?? photos[0]!;

  return (
    <figure className="page-photo">
      <div ref={strip} className="photo-strip" style={{ aspectRatio: HEADER_ASPECT }}>
        {slides.map((p, i) => (
          <img
            key={`${i}-${p.src}`}
            src={siteUrl(p.src)}
            alt=""
            loading={i === (many ? 1 : 0) ? 'eager' : 'lazy'}
            draggable={false}
          />
        ))}
      </div>
      {many && (
        <>
          <button
            type="button"
            className="photo-arrow prev"
            aria-label={t('photoPrev', lang)}
            onClick={() => step(-1)}
          >
            <Chevron points="8 2.5 4 6 8 9.5" />
          </button>
          <button
            type="button"
            className="photo-arrow next"
            aria-label={t('photoNext', lang)}
            onClick={() => step(1)}
          >
            <Chevron points="4 2.5 8 6 4 9.5" />
          </button>
          <div className="photo-dots" aria-hidden="true">
            {photos.map((p, i) => (
              <span key={p.src} className={i === index ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
      {current.credit && <figcaption>{current.credit}</figcaption>}
    </figure>
  );
}

/**
 * The ‹ › arrows, drawn rather than typed: a font's ‹ › sit off-centre (they're punctuation,
 * placed for text), so they never centre on a round button. Each chevron's box is centred on the
 * 12 × 12 view, which the button centres.
 */
function Chevron({ points }: { points: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SHEET_HALF, SHEET_TOP_PX } from '../config';

/** The sheet's resting heights (CLAUDE.md, "Phone layout"). */
export type Snap = 'peek' | 'half' | 'full';

interface Props {
  snap: Snap;
  onSnap: (s: Snap) => void;
  /** The heights a drag or the grab bar can reach, lowest first (the list skips half). */
  snaps: readonly Snap[];
  /** Changes when the content is replaced (list ↔ a place page): scrolls back to the top. */
  contentKey: string;
  /** The sheet's height in px each time it comes to rest. */
  onRest?: (px: number) => void;
  /** The grab bar's accessible name. */
  handleLabel: string;
  children: ReactNode;
}

/** A finger must move this far before it counts as a drag, not a tap. */
const DRAG_START_PX = 6;
/** Release speed (px/ms) and how far ahead it carries, for picking the snap after a flick. */
const FLICK_MS = 160;
/** Fallback peek until the content has been measured. */
const PEEK_FALLBACK_PX = 64;
/** Space kept under the content's [data-peek] element at peek height. */
const PEEK_PAD_PX = 8;

/**
 * Phones: a bottom sheet over the map holding the list or place page. Resting heights: peek
 * (down to the content's [data-peek] element), half and full; `snaps` says which of them the
 * current content uses (the list: peek and full). The whole sheet drags.
 * Below full the content doesn't scroll, so a swipe on it moves the sheet. At full the content
 * scrolls, and pulling down from its top lowers the sheet again (as in Google Maps).
 */
export default function Sheet({
  snap,
  onSnap,
  snaps,
  contentKey,
  onRest,
  handleLabel,
  children,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState(0);
  const [peek, setPeek] = useState(PEEK_FALLBACK_PX);
  const [dragH, setDragH] = useState<number | null>(null);

  // The map area's height (the sheet's parent), on every resize.
  useLayoutEffect(() => {
    const parent = root.current!.parentElement!;
    const measure = () => setArea(parent.clientHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    measure();
    return () => ro.disconnect();
  }, []);

  // Peek height: down to the content's [data-peek] element (the list's count line; a place
  // page's name and top feature), measured after every render. No loop: an unchanged value
  // doesn't re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = content.current?.querySelector('[data-peek]');
    if (!el || !root.current || !content.current) return;
    const bottom =
      el.getBoundingClientRect().bottom -
      root.current.getBoundingClientRect().top +
      content.current.scrollTop;
    setPeek(Math.ceil(bottom) + PEEK_PAD_PX);
  });

  const maxH = Math.max(0, area - SHEET_TOP_PX);
  const heights: Record<Snap, number> = {
    peek: Math.min(peek, maxH),
    half: Math.min(Math.round(area * SHEET_HALF), maxH),
    full: maxH,
  };
  const h = dragH ?? heights[snap];

  // The map's corner controls (the OSM credit) sit above the sheet: styles.css reads --sheet-h.
  useLayoutEffect(() => {
    root.current?.parentElement?.style.setProperty('--sheet-h', `${h}px`);
  }, [h]);

  const restH = heights[snap];
  useEffect(() => {
    if (dragH === null && area > 0) onRest?.(restH);
  }, [restH, dragH, area, onRest]);

  // New content, or the sheet lowered below full (where content can't scroll): back to the top.
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [contentKey]);
  useEffect(() => {
    if (snap !== 'full' && content.current) content.current.scrollTop = 0;
  }, [snap]);

  // The allowed height nearest to a drag's end.
  const nearest = (aim: number): Snap =>
    snaps.reduce((a, b) => (Math.abs(heights[b] - aim) < Math.abs(heights[a] - aim) ? b : a));

  // Latest values for the native listeners below.
  const live = useRef({ snap, h, heights, onSnap, nearest });
  useLayoutEffect(() => {
    live.current = { snap, h, heights, onSnap, nearest };
  });

  // Dragging. Native listeners, because touchmove must be non-passive to stop the content
  // scrolling once a drag has started (React's touch listeners are passive).
  useEffect(() => {
    const el = root.current!;
    const scroller = content.current!;
    let start: { x: number; y: number; h: number; inContent: boolean } | null = null;
    let decided = false;
    let dragging = false;
    let last = { y: 0, t: 0, v: 0 };
    let swallowClick = false;

    const begin = (x: number, y: number, target: EventTarget | null) => {
      start = { x, y, h: live.current.h, inContent: scroller.contains(target as Node) };
      decided = false;
      dragging = false;
      last = { y, t: performance.now(), v: 0 };
    };

    /** Returns true when the move belongs to the sheet (the caller then cancels scrolling). */
    const move = (x: number, y: number): boolean => {
      if (!start) return false;
      const dy = y - start.y;
      if (!decided) {
        const dx = x - start.x;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_START_PX) return false;
        decided = true;
        // Mostly sideways (the place photo strip): never the sheet's.
        if (Math.abs(dx) > Math.abs(dy)) {
          start = null;
          return false;
        }
        // At full height a swipe on the content scrolls it, unless it's a pull down from the top.
        const scrolls = live.current.snap === 'full' && start.inContent;
        dragging = !scrolls || (dy > 0 && scroller.scrollTop <= 0);
        if (!dragging) {
          start = null;
          return false;
        }
      }
      const now = performance.now();
      if (now > last.t) last = { y, t: now, v: (last.y - y) / (now - last.t) };
      const { heights: hs } = live.current;
      setDragH(Math.max(hs.peek, Math.min(hs.full, start.h - dy)));
      return true;
    };

    const end = () => {
      if (!start) return;
      const wasDragging = dragging;
      start = null;
      if (!wasDragging) return;
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      // The allowed height nearest to where the sheet would have coasted to.
      const { h: nowH, onSnap: snapTo, nearest: pick } = live.current;
      setDragH(null);
      snapTo(pick(nowH + last.v * FLICK_MS));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) begin(e.touches[0]!.clientX, e.touches[0]!.clientY, e.target);
      else start = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0]!.clientX, e.touches[0]!.clientY) && e.cancelable) e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (move(e.clientX, e.clientY)) e.preventDefault();
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      end();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      begin(e.clientX, e.clientY, e.target);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
    // A drag that ends on a list row isn't a tap on it.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('click', onClick, true);
      onMouseUp();
    };
  }, []);

  // Tapping the grab bar steps up through the allowed heights, then back to the lowest (for a
  // mouse, or anyone who doesn't swipe).
  const next = snaps[(snaps.indexOf(snap) + 1) % snaps.length]!;

  return (
    <div
      ref={root}
      className={`sheet sheet-${snap}${dragH !== null ? ' dragging' : ''}`}
      style={{ height: maxH, transform: `translateY(${maxH - h}px)` }}
    >
      <button
        type="button"
        className="sheet-grab"
        aria-label={handleLabel}
        onClick={() => onSnap(next)}
      />
      <div ref={content} className="sheet-content">
        {children}
      </div>
    </div>
  );
}

// Pin appearance (CLAUDE.md, "Map UI"). One function turns a place's status into the look of its
// pin; the map only places the element. No status text and no kanji on the pin itself.

import type { Lang } from './i18n';
import { stageColor, stageLabel } from './labels';
import { RING_COLORS, rank, type FeatureState, type PlaceStatus } from './lib/status';
import { placeholderPhoto } from './placeholders';

export interface PinLook {
  photo: string;
  /** CSS background for the ring: a colour, or a conic gradient for 咲き始め. */
  ring: string;
  /** Thin ring = estimate (usual window, forecast, stale, last season's dates). */
  thin: boolean;
  /** Photo treatment: grey for まもなく / シーズン外 / unlit, part-faded for 見頃過ぎ. */
  photoFilter: 'none' | 'grey' | 'faded';
  festival: boolean;
  clock: boolean;
  /** Stacking: better pins sit on top when they overlap. */
  zIndex: number;
  /** For screen readers only; not drawn. */
  ariaLabel: string;
}

function photoFor(pin: FeatureState, ps: PlaceStatus): string {
  if (pin.type === 'illumination') return placeholderPhoto({ type: 'illumination' });
  const planting = ps.place.plantings.find((p) => p.id === pin.id);
  return placeholderPhoto({ type: 'planting', species: planting?.species ?? '', kind: pin.kind });
}

export function pinLook(ps: PlaceStatus, lang: Lang): PinLook | null {
  const pin = ps.pin;
  if (!pin) return null;
  const noInfo = pin.type === 'planting' && pin.noRecentInfo;
  const color = noInfo ? RING_COLORS.track : stageColor(pin);
  const pct = pin.type === 'planting' && pin.level === 1 && !noInfo ? (pin.bloomPct ?? 33) : null;
  const ring =
    pct === null ? color : `conic-gradient(${color} 0 ${pct}%, ${RING_COLORS.track} ${pct}% 100%)`;

  const greyed =
    pin.type === 'illumination'
      ? pin.state !== 'lit'
      : pin.level === 0 || pin.level === 4 || noInfo;
  const faded = pin.type === 'planting' && pin.level === 3;
  const name = (lang === 'en' && ps.place.name_en) || ps.place.name_ja;

  return {
    photo: photoFor(pin, ps),
    ring,
    thin: !pin.confirmed || noInfo,
    photoFilter: greyed ? 'grey' : faded ? 'faded' : 'none',
    festival: ps.festivals.length > 0,
    clock: pin.peakSoon,
    zIndex: rank(pin) * 10 + (pin.confirmed ? 1 : 0),
    ariaLabel: `${name}: ${stageLabel(pin, lang)}`,
  };
}

const CLOCK_SVG =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B0245C" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/**
 * Create or update a pin's DOM. `el` is the marker element MapLibre positions (it sets a
 * transform on it), so the visible pin is an inner element that can scale on hover.
 */
export function drawPin(el: HTMLElement, look: PinLook, name: string): void {
  el.classList.add('pin-marker');
  el.style.zIndex = String(look.zIndex);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', look.ariaLabel);
  el.innerHTML =
    `<div class="pin${look.thin ? ' thin' : ''}">` +
    `<img alt="" src="${look.photo}" class="photo-${look.photoFilter}">` +
    (look.festival ? '<span class="pin-fest"></span>' : '') +
    (look.clock ? `<span class="pin-clock">${CLOCK_SVG}</span>` : '') +
    '</div><span class="pin-label"></span>';
  const pin = el.firstElementChild as HTMLElement;
  pin.style.background = look.ring;
  // Name on hover only (step 5.8 adds names by zoom level). It sits outside .pin so the
  // pin's hover zoom doesn't scale the text.
  el.querySelector('.pin-label')!.textContent = name;
}

// Pin appearance (CLAUDE.md, "Map UI"). One function turns a place's status into the look of its
// pin; the map only places the element. No status text and no kanji on the pin itself.

import type { CSSProperties } from 'react';
import {
  FESTIVAL_COLOR,
  NAME_FONT_PX,
  NAME_LINE_HEIGHT,
  PIN,
  PIN_RING_PX,
  PIN_SELECTED_SCALE,
  PIN_TIP_TUCK_PX,
  siteUrl,
  type PinSize,
} from './config';
import type { Lang } from './i18n';
import { stageColor, stageLabel } from './labels';
import {
  DEFAULT_STARTING_PCT,
  RING_COLORS,
  rank,
  type FeatureState,
  type PlaceStatus,
} from './lib/status';
import { placeholderPhoto } from './placeholders';

export interface PinLook {
  photo: string;
  /** CSS background for the ring: a colour, or a conic gradient for 咲き始め. */
  ring: string;
  /** Colour of the taper under the circle: the stage colour (solid even while 咲き始め fills). */
  tip: string;
  /** Photo treatment: grey for over (シーズン外, no recent info), part-faded for 見頃過ぎ. まもなく
   *  keeps its colour: grey would read as over, not soon. */
  photoFilter: 'none' | 'grey' | 'faded';
  /** Lit illumination: a soft glow in the ring's gold around the pin. */
  glow: boolean;
  festival: boolean;
  /** Stacking: better pins sit on top when they overlap. */
  zIndex: number;
  /** For screen readers only; not drawn. */
  ariaLabel: string;
}

/**
 * A feature's pin/row photo: the planting's pin_photo override, else its species close-up (both
 * resolved by build-data into `pin_src`), else the drawn placeholder. Illuminations: placeholder
 * until they have on-location photos.
 */
export function featurePhoto(pin: FeatureState, ps: PlaceStatus): string {
  if (pin.type === 'illumination') return placeholderPhoto({ type: 'illumination' });
  const planting = ps.place.plantings.find((p) => p.id === pin.id);
  if (planting?.pin_src) return siteUrl(planting.pin_src);
  return placeholderPhoto({ type: 'planting', species: planting?.species ?? '', kind: pin.kind });
}

export function pinLook(ps: PlaceStatus, lang: Lang): PinLook | null {
  const pin = ps.pin;
  if (!pin) return null;
  const noInfo = pin.type === 'planting' && pin.noRecentInfo;
  const color = noInfo ? RING_COLORS.track : stageColor(pin);
  const pct =
    pin.type === 'planting' && pin.level === 1 && !noInfo
      ? (pin.bloomPct ?? DEFAULT_STARTING_PCT)
      : null;
  const ring =
    pct === null ? color : `conic-gradient(${color} 0 ${pct}%, ${RING_COLORS.track} ${pct}% 100%)`;

  const greyed = pin.type === 'illumination' ? pin.state === 'off' : pin.level === 4 || noInfo;
  const faded = pin.type === 'planting' && pin.level === 3;
  const name = (lang === 'en' && ps.place.name_en) || ps.place.name_ja;

  return {
    photo: featurePhoto(pin, ps),
    ring,
    tip: color,
    photoFilter: greyed ? 'grey' : faded ? 'faded' : 'none',
    glow: pin.type === 'illumination' && pin.state === 'lit',
    festival: ps.festivals.length > 0,
    zIndex: rank(pin) * 10 + (pin.confirmed ? 1 : 0),
    ariaLabel: `${name}: ${stageLabel(pin, lang)}`,
  };
}

/**
 * A group pin (CLAUDE.md, "Grouped pins"): the best place's photo and ring, the festival dot if
 * any place in the group has a festival on.
 */
export function groupLook(leader: PinLook, festival: boolean, label: string): PinLook {
  return {
    ...leader,
    festival,
    ariaLabel: label,
  };
}

/**
 * Create or update a pin's DOM: a photo circle with a taper whose tip is the place's point (the
 * marker is anchored at its bottom). `el` is the element MapLibre positions (it sets a transform
 * on it), so the visible pin is an inner element that can scale on hover. `count` > 1 draws a
 * group pin with its count badge. `label` is the hover text.
 */
export function drawPin(el: HTMLElement, look: PinLook, label: string, count = 1): void {
  el.classList.add('pin-marker');
  el.style.zIndex = String(look.zIndex);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', look.ariaLabel);
  el.innerHTML =
    '<div class="pin-body">' +
    `<div class="pin${look.glow ? ' glow' : ''}">` +
    `<img alt="" src="${look.photo}" class="photo-${look.photoFilter}">` +
    (look.festival ? '<span class="pin-fest"></span>' : '') +
    (count > 1 ? `<span class="pin-count">${count}</span>` : '') +
    '</div><span class="pin-tip"></span></div><span class="pin-label"><span></span></span>';
  el.classList.toggle('group', count > 1);
  (el.querySelector('.pin') as HTMLElement).style.setProperty('--ring', look.ring);
  (el.querySelector('.pin-tip') as HTMLElement).style.borderTopColor = look.tip;
  // The pin's name: the only place it's drawn. MapView decides when it shows (collisions);
  // styles.css shows it on hover and for the selected pin too. It sits outside .pin so the
  // pin's hover zoom doesn't scale the text.
  el.querySelector('.pin-label > span')!.textContent = label;
}

/**
 * The map pin's sizes as CSS variables (pin.css; styles.css: .pin-marker, .pin-tip, selected
 * pin), plus what every pin shares: ring width, festival colour and the list's pin size (rows
 * keep the desktop pin on phones too).
 */
export function pinStyle(pin: PinSize): CSSProperties {
  return {
    '--pin-size': `${pin.size}px`,
    '--pin-ring': `${PIN_RING_PX}px`,
    '--list-pin': `${PIN.size}px`,
    '--festival': FESTIVAL_COLOR,
    '--pin-tip-w': `${pin.tipHalfW}px`,
    '--pin-tip-h': `${pin.tipH}px`,
    '--pin-tip-tuck': `${PIN_TIP_TUCK_PX}px`,
    '--pin-selected-scale': String(PIN_SELECTED_SCALE),
    '--name-font-size': `${NAME_FONT_PX}px`,
    '--name-line-height': String(NAME_LINE_HEIGHT),
  } as CSSProperties;
}

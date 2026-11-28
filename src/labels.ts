import { NAME_BREAK_CHARS } from './config';
import type { Lang } from './i18n';
import type { Species } from './lib/schema';
import {
  ILLUMINATION_LABELS,
  RING_COLORS,
  STAGE_LABELS,
  type FeatureState,
  type PlaceStatus,
} from './lib/status';

/** The stage name shown for a feature: まもなく / 咲き始め / … or 点灯中 etc. */
export function stageLabel(s: FeatureState, lang: Lang): string {
  if (s.type === 'illumination') return ILLUMINATION_LABELS[s.state][lang];
  return STAGE_LABELS[s.kind][s.level][lang];
}

/** Ring colour for a feature's stage (CLAUDE.md, Map UI). */
export function stageColor(s: FeatureState): string {
  if (s.type === 'illumination') return s.state === 'lit' ? RING_COLORS.lit : RING_COLORS.track;
  if (s.level === 0 || s.level === 4) return RING_COLORS.track;
  return RING_COLORS[s.kind][s.level];
}

/** What a feature is: the illumination's name, or the species (with variety) for a planting. */
export function featureName(
  s: FeatureState,
  ps: PlaceStatus,
  species: Species[],
  lang: Lang,
): string {
  if (s.type === 'illumination') {
    const il = ps.place.illuminations.find((x) => x.id === s.id);
    return (lang === 'en' && il?.name_en) || il?.name_ja || s.id;
  }
  const pl = ps.place.plantings.find((x) => x.id === s.id);
  const sp = species.find((x) => x.id === pl?.species);
  const name = sp ? sp[lang === 'en' ? 'name_en' : 'name_ja'] : (pl?.species ?? s.id);
  return pl?.species_variety ? `${name}（${pl.species_variety}）` : name;
}

/** Prefecture folder slugs (CLAUDE.md, "Folders") and their Japanese names. */
const PREFECTURES: Record<string, string> = { ibaraki: '茨城県' };

/**
 * The full address as you'd type it into a map or car navigation: 茨城県筑西市宮山504. The
 * YAML's address_ja starts after the municipality. Empty when the place has no address.
 */
export function fullAddress(place: PlaceStatus['place']): string {
  if (!place.address_ja) return '';
  return `${PREFECTURES[place.prefecture] ?? ''}${place.municipality}${place.address_ja}`;
}

/** The place's display name in the current language. */
export const placeName = (ps: PlaceStatus, lang: Lang): string =>
  (lang === 'en' && ps.place.name_en) || ps.place.name_ja;

/**
 * An English name on one or two lines (CLAUDE.md, "Place names"): longer than NAME_BREAK_CHARS,
 * it breaks at the space that makes the longer line shortest, a tie putting the shorter line on
 * top. No space: one line.
 */
export function breakName(name: string): string {
  const len = (s: string) => [...s].length;
  if (len(name) <= NAME_BREAK_CHARS) return name;
  let best: { top: string; bottom: string } | null = null;
  for (let i = name.indexOf(' '); i !== -1; i = name.indexOf(' ', i + 1)) {
    const top = name.slice(0, i);
    const bottom = name.slice(i + 1);
    if (!top || !bottom) continue;
    if (
      !best ||
      Math.max(len(top), len(bottom)) < Math.max(len(best.top), len(best.bottom)) ||
      (Math.max(len(top), len(bottom)) === Math.max(len(best.top), len(best.bottom)) &&
        len(top) < len(best.top))
    )
      best = { top, bottom };
  }
  return best ? `${best.top}\n${best.bottom}` : name;
}

/**
 * The name under a pin: English names may break onto two lines (breakName); Japanese names,
 * including the Japanese fallback in English mode, stay on one.
 */
export const pinName = (ps: PlaceStatus, lang: Lang): string =>
  lang === 'en' && ps.place.name_en ? breakName(ps.place.name_en) : ps.place.name_ja;

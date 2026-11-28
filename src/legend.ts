// The map legend's contents (CLAUDE.md, "Legend"): which rows show, and the pins in each. The
// pins are drawn by the map's own code (pinLook, drawPin) from made-up statuses, so the legend
// can't drift from the map.

import type { Lang } from './i18n';
import { t } from './i18n';
import {
  ILLUMINATION_LABELS,
  STAGE_LABELS,
  type FeatureState,
  type PlaceStatus,
} from './lib/status';
import { pinLook, type PinLook } from './pins';

export type LegendRow = 'bloom' | 'foliage' | 'illumination' | 'off' | 'festival';

/** The rows in display order. The last two share one line. No group pin: tapping one explains
 *  it. */
export const LEGEND_ROWS: readonly LegendRow[] = [
  'bloom',
  'foliage',
  'illumination',
  'off',
  'festival',
];

/** The row a pin's look belongs to; none for "no recent info", which has no row yet. */
function rowOf(pin: FeatureState): LegendRow | null {
  if (pin.type === 'illumination') return pin.state === 'off' ? 'off' : 'illumination';
  if (pin.noRecentInfo) return null;
  return pin.level === 4 ? 'off' : pin.kind;
}

/**
 * The rows to show: each stage row when some place's pin uses it, the festival row when some
 * place has a festival on. None at all when no place passes the filter. `places` are the places passing the current
 * filter, each with the filter's pin (not only those on screen, so panning never changes it).
 */
export function legendRows(places: Pick<PlaceStatus, 'pin' | 'festivals'>[]): Set<LegendRow> {
  const rows = new Set<LegendRow>();
  for (const ps of places) {
    const row = ps.pin && rowOf(ps.pin);
    if (row) rows.add(row);
    if (ps.festivals.length > 0) rows.add('festival');
  }
  return rows;
}

export interface LegendCell {
  look: PinLook;
  label: string;
}

/** The species whose close-ups stand for flowers and leaves in the legend. */
const LEGEND_SPECIES = { bloom: 'sakura', foliage: 'momiji' } as const;

/** A planting at `level`, as status.ts would report it. */
function planting(kind: 'bloom' | 'foliage', level: 0 | 1 | 2 | 3 | 4): FeatureState {
  return {
    type: 'planting',
    id: `legend-${kind}`,
    kind,
    level,
    confirmed: true,
    basis: 'report',
    noRecentInfo: false,
    peakSoon: false,
    featured: false,
    why: '',
  };
}

function illumination(state: 'soon' | 'lit'): FeatureState {
  return {
    type: 'illumination',
    id: 'legend-illumination',
    state,
    confirmed: true,
    peakSoon: false,
    featured: false,
    why: '',
  };
}

/**
 * The pins of one row. `pinSrc` maps a species to its pin close-up (the build's crop), so the
 * legend shows the same photos as the map; without one, the drawn placeholder.
 */
export function legendCells(
  row: LegendRow,
  pinSrc: Record<string, string | undefined>,
  lang: Lang,
): LegendCell[] {
  const look = (pin: FeatureState, festival = false): PinLook => {
    const species = pin.type === 'planting' ? LEGEND_SPECIES[pin.kind] : '';
    const ps = {
      place: {
        name_ja: '',
        plantings: [{ id: pin.id, species, pin_src: pinSrc[species] }],
        illuminations: [],
      },
      pin,
      features: [pin],
      festivals: festival ? [{}] : [],
      closed: false,
    } as unknown as PlaceStatus;
    return pinLook(ps, lang)!;
  };
  switch (row) {
    case 'bloom':
    case 'foliage':
      return ([0, 1, 2, 3] as const).map((level) => ({
        look: look(planting(row, level)),
        label: STAGE_LABELS[row][level][lang],
      }));
    case 'illumination':
      return (['soon', 'lit'] as const).map((state) => ({
        look: look(illumination(state)),
        label: ILLUMINATION_LABELS[state][lang],
      }));
    case 'off':
      return [{ look: look(planting('bloom', 4)), label: STAGE_LABELS.bloom[4][lang] }];
    case 'festival':
      return [{ look: look(planting('bloom', 2), true), label: t('legendFestival', lang) }];
  }
}

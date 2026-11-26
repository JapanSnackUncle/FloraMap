// Stage, visibility, freshness and pin rules (CLAUDE.md, "Status and display logic").
// Pure functions: everything takes `today` (ISO date, Japan time) as an argument,
// so the debug date bar and the tests can ask about any day.
//
// Each decision lives in one function with its precedence written at the top:
//   plantingState      what stage a planting is at, and how sure we are
//   illuminationState  lit / soon / out of season
//   closedToday        the venue's 本日休園
//   rank / choosePin   which feature fronts a place's pin
//   passesFilter       which places a filter shows
//   pageOrder          order of features on the place page
// Every state carries `why`, a short English explanation for debug mode.

import type { PublicFestival, PublicPlace, PublicPlanting, PublicStatus } from './schema';
import {
  addDays,
  addYears,
  daysBetween,
  seasonLabel,
  thirdEnd,
  thirdStart,
  weekdayOf,
} from './dates';

// ---------- constants (CLAUDE.md)

/** まもなく shows only this many days before a planting starts opening (or an illumination starts). */
export const LEAD = 14;
/** 咲き始め days before the usual window when a planting's species doesn't say (species.yaml starting_days). */
export const DEFAULT_STARTING_DAYS = 7;
/** Fresh / aging limits in days, by level 0–3. */
export const FRESHNESS: Record<0 | 1 | 2 | 3, { fresh: number; aging: number }> = {
  0: { fresh: 7, aging: 14 },
  1: { fresh: 3, aging: 6 },
  2: { fresh: 4, aging: 8 },
  3: { fresh: 3, aging: 6 },
};
/** After this many days without a report, the pin shows "no recent info". */
export const NO_RECENT_INFO_DAYS = 21;
/** Statuses older than this never count. */
export const MAX_STATUS_AGE = 60;
/** A season runs from the まもなく period before the usual window to this many days after it ("the following month"). */
export const SEASON_TAIL_DAYS = 30;
/** Usual-window fallback: 見頃過ぎ for the first third of a month after the window. */
export const USUAL_PAST_PEAK_DAYS = 10;
/** Clock badge: peak (or lighting) expected within this many days. */
export const PEAK_SOON_DAYS = 5;
/** 咲き始め ring fill when the source gives words, not a 分咲き figure: half, so it's easy to see. */
export const DEFAULT_STARTING_PCT = 50;

export type Level = 0 | 1 | 2 | 3 | 4;
export const SOON: Level = 0;
export const STARTING: Level = 1;
export const PEAK: Level = 2;
export const PAST_PEAK: Level = 3;
export const OUT_OF_SEASON: Level = 4;

const CONFIRMED_KINDS = new Set(['official', 'admin', 'user']);
const ESTIMATE_KINDS = new Set(['forecast', 'usual']);

// ---------- labels and colours

export const STAGE_LABELS = {
  bloom: [
    { ja: 'まもなく', en: 'Soon' },
    { ja: '咲き始め', en: 'Starting to Bloom' },
    { ja: '見頃', en: 'Peak' },
    { ja: '見頃過ぎ', en: 'Past Peak' },
    { ja: 'シーズン外', en: 'Out of Season' },
  ],
  foliage: [
    { ja: '青葉', en: 'Green' },
    { ja: '色づき始め', en: 'Turning Color' },
    { ja: '見頃', en: 'Peak' },
    { ja: '見頃過ぎ', en: 'Past Peak' },
    { ja: 'シーズン外', en: 'Out of Season' },
  ],
} as const;

export const ILLUMINATION_LABELS = {
  soon: { ja: 'まもなく', en: 'Soon' },
  lit: { ja: '点灯中', en: 'Lit' },
  off: { ja: 'シーズン外', en: 'Out of Season' },
} as const;

export const RING_COLORS = {
  track: '#E7E5E4',
  bloom: { 1: '#E58FAD', 2: '#B0245C', 3: '#9E7F89' },
  foliage: { 1: '#E9A23B', 2: '#C2410C', 3: '#8C6A4F' },
  lit: '#D4A017',
} as const;

// ---------- planting state

export interface WindowInstance {
  start: string;
  end: string;
}

export interface PlantingState {
  type: 'planting';
  id: string;
  kind: 'bloom' | 'foliage';
  level: Level;
  /** Full ring (confirmed, fresh or aging) vs thin ring (any estimate). */
  confirmed: boolean;
  basis: 'report' | 'forecast' | 'last-report' | 'usual-window' | 'off-season';
  /** Only for basis "report": fresh = normal, aging = show the age prominently. */
  freshness?: 'fresh' | 'aging';
  /** The report the level came from, when there is one. */
  report?: PublicStatus;
  ageDays?: number;
  /** 3 weeks without a report: plain "no recent info" pin style. */
  noRecentInfo: boolean;
  /** Ring fill for 咲き始め, 0–100. */
  bloomPct?: number;
  /** The usual window this season (or the next one when out of season). */
  window?: WindowInstance;
  /** The next usual window starting after today: for "次回 例年 …" text and page order. */
  nextWindow?: WindowInstance;
  /** Clock badge. */
  peakSoon: boolean;
  featured: boolean;
  why: string;
}

/** Usual windows as dates, for the years around `today`, sorted by start. */
export function windowInstances(planting: PublicPlanting, today: string): WindowInstance[] {
  const y = +today.slice(0, 4);
  const out: WindowInstance[] = [];
  for (const w of planting.windows ?? []) {
    for (const year of [y - 1, y, y + 1]) {
      const start = thirdStart(w.start, year);
      // A window can cross the new year ("12-3" to "01-2").
      const endYear = w.end < w.start ? year + 1 : year;
      out.push({ start, end: thirdEnd(w.end, endYear) });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** The usual window is the typical 見頃 period; 咲き始め runs for `startingDays` before it, まもなく for LEAD before that. */
export function seasonOf(w: WindowInstance, startingDays = DEFAULT_STARTING_DAYS) {
  return { from: addDays(w.start, -(startingDays + LEAD)), to: addDays(w.end, SEASON_TAIL_DAYS) };
}

/**
 * Level from the usual window alone. Precedence: within `startingDays` before the window = 咲き始め,
 * LEAD days before that = まもなく, inside = 見頃, first third of a month after = 見頃過ぎ, else シーズン外.
 */
export function usualLevel(
  w: WindowInstance,
  today: string,
  startingDays = DEFAULT_STARTING_DAYS,
): Level {
  if (today < w.start) {
    const n = daysBetween(today, w.start);
    if (n <= startingDays) return STARTING;
    return n <= startingDays + LEAD ? SOON : OUT_OF_SEASON;
  }
  if (today <= w.end) return PEAK;
  if (daysBetween(w.end, today) <= USUAL_PAST_PEAK_DAYS) return PAST_PEAK;
  return OUT_OF_SEASON;
}

/** 咲き始め fill from a 分咲き figure ("3分" -> 30); half when there's no figure. */
export function bloomPct(detail: string | undefined): number {
  const m = detail?.match(/(\d+(?:\.\d+)?)\s*分/);
  if (!m) return DEFAULT_STARTING_PCT;
  return Math.min(69, Math.max(5, Math.round(+m[1]! * 10)));
}

/**
 * A planting's stage on `today`. Precedence:
 *  1. Out of season (no season contains today) -> シーズン外.
 *  2. Latest confirmed report this season (official/admin/user, ≤ 60 days old):
 *     fresh or aging -> that level, full ring.
 *     stale -> a forecast dated after the report, else the report's level; thin ring.
 *     21+ days old -> also flagged "no recent info".
 *     Never lower than the highest confirmed level this season.
 *  3. No confirmed report this season -> latest forecast this season, else the usual window; thin ring.
 */
export function plantingState(planting: PublicPlanting, today: string): PlantingState {
  const instances = windowInstances(planting, today);
  const next = instances.find((w) => w.start > today);
  const base = {
    type: 'planting' as const,
    id: planting.id,
    kind: planting.kind,
    featured: planting.featured === true,
    noRecentInfo: false,
    peakSoon: false,
    nextWindow: next,
  };
  const startingDays = planting.starting_days ?? DEFAULT_STARTING_DAYS;
  const current = instances.filter((w) => {
    const s = seasonOf(w, startingDays);
    return s.from <= today && today <= s.to;
  });
  const window = current.at(-1);

  if (!window) {
    return {
      ...base,
      level: OUT_OF_SEASON,
      confirmed: false,
      basis: 'off-season',
      window: next,
      why: next
        ? `off season; next usual window starts ${next.start}`
        : 'off season; no usual window',
    };
  }

  const season = seasonOf(window, startingDays);
  const inSeason = (s: PublicStatus) =>
    s.date >= season.from && s.date <= today && daysBetween(s.date, today) <= MAX_STATUS_AGE;
  const rows = planting.statuses.filter(inSeason);
  const confirmedRows = rows.filter((s) => CONFIRMED_KINDS.has(s.kind));
  const estimateRows = rows.filter((s) => ESTIMATE_KINDS.has(s.kind));
  const latest = <T extends { date: string }>(xs: T[]) =>
    xs.reduce<T | undefined>((a, b) => (!a || b.date >= a.date ? b : a), undefined);
  const floor = Math.max(-1, ...confirmedRows.map((s) => s.level)); // never backwards
  const lastReport = latest(confirmedRows);
  const peakSoon = peakSoonFor(planting, today, lastReport);

  if (lastReport) {
    const level = Math.max(lastReport.level, floor) as Level;
    const age = daysBetween(lastReport.date, today);
    const limits =
      level < 4 ? FRESHNESS[level as 0 | 1 | 2 | 3] : { fresh: Infinity, aging: Infinity };
    const pct = level === STARTING ? bloomPct(lastReport.detail) : undefined;
    if (age <= limits.aging) {
      const freshness = age <= limits.fresh ? 'fresh' : 'aging';
      return {
        ...base,
        level,
        confirmed: true,
        basis: 'report',
        freshness,
        report: lastReport,
        ageDays: age,
        bloomPct: pct,
        window,
        peakSoon,
        why: `${lastReport.kind} report ${lastReport.date} (${age} days, ${freshness})`,
      };
    }
    const newerForecast = latest(estimateRows.filter((s) => s.date > lastReport.date));
    const noRecentInfo = age > NO_RECENT_INFO_DAYS;
    if (newerForecast) {
      const fLevel = Math.max(newerForecast.level, floor) as Level;
      return {
        ...base,
        level: fLevel,
        confirmed: false,
        basis: 'forecast',
        report: newerForecast,
        ageDays: age,
        noRecentInfo,
        bloomPct: fLevel === STARTING ? bloomPct(newerForecast.detail) : undefined,
        window,
        why: `report ${lastReport.date} is stale (${age} days); forecast for ${newerForecast.date} is newer`,
      };
    }
    return {
      ...base,
      level,
      confirmed: false,
      basis: 'last-report',
      report: lastReport,
      ageDays: age,
      noRecentInfo,
      bloomPct: pct,
      window,
      why: `report ${lastReport.date} is stale (${age} days); showing it thin${noRecentInfo ? ', no recent info' : ''}`,
    };
  }

  const forecast = latest(estimateRows);
  if (forecast) {
    return {
      ...base,
      level: forecast.level as Level,
      confirmed: false,
      basis: 'forecast',
      report: forecast,
      bloomPct: forecast.level === STARTING ? bloomPct(forecast.detail) : undefined,
      window,
      peakSoon,
      why: `no report this season; ${forecast.kind} for ${forecast.date}`,
    };
  }

  const level = usualLevel(window, today, startingDays);
  return {
    ...base,
    level,
    confirmed: false,
    basis: 'usual-window',
    window,
    bloomPct: level === STARTING ? DEFAULT_STARTING_PCT : undefined,
    why: `no report this season; usual window ${window.start} to ${window.end}`,
  };
}

/**
 * Clock badge for a planting: currently before peak on a fresh or aging official report,
 * and a forecast from a named source puts 見頃 within PEAK_SOON_DAYS. Never from the usual window.
 */
function peakSoonFor(
  planting: PublicPlanting,
  today: string,
  lastReport: PublicStatus | undefined,
): boolean {
  if (!lastReport || lastReport.kind !== 'official' || lastReport.level >= PEAK) return false;
  const age = daysBetween(lastReport.date, today);
  if (age > FRESHNESS[lastReport.level as 0 | 1].aging) return false;
  return planting.statuses.some(
    (s) =>
      s.kind === 'forecast' &&
      s.source_id !== undefined &&
      s.level === PEAK &&
      s.date > today &&
      daysBetween(today, s.date) <= PEAK_SOON_DAYS,
  );
}

// ---------- illumination state

type PublicIllumination = PublicPlace['illuminations'][number];
type PublicEdition = PublicIllumination['editions'][number];

export interface IlluminationState {
  type: 'illumination';
  id: string;
  state: 'lit' | 'soon' | 'off';
  /** Full ring when this season's dates are announced; thin for last season's dates as a placeholder. */
  confirmed: boolean;
  from?: string;
  to?: string;
  /** Tonight's hours, when lit. */
  hoursJa?: string;
  /** Lit, but the venue is closed today (so tonight's hours don't apply). Set by featureStates. */
  closedTonight?: boolean;
  /** When closedTonight: the next night the venue is open within this run. None if the run ends first. */
  nextNight?: { date: string; hoursJa?: string };
  /** 点灯まで あと n 日: only when soon and announced. */
  countdownDays?: number;
  /** Days to the start (for sorting まもなく; not for display unless announced). */
  daysToStart?: number;
  peakSoon: boolean;
  featured: false;
  why: string;
}

interface DatedEdition {
  from: string;
  to: string;
  announced: boolean;
  hours: { from: string; to: string; hours_ja: string }[];
  season: string;
}

/** Editions with dates; this season's unannounced edition borrows last season's dates, one year on. */
export function datedEditions(il: PublicIllumination, today: string): DatedEdition[] {
  const bySeason = new Map(il.editions.map((e) => [e.season, e]));
  const out: DatedEdition[] = [];
  const shift = (e: PublicEdition, season: string): DatedEdition => ({
    from: addYears(e.from!, 1),
    to: addYears(e.to!, 1),
    announced: false,
    hours: (e.hours ?? []).map((h) => ({ ...h, from: addYears(h.from, 1), to: addYears(h.to, 1) })),
    season,
  });
  for (const e of il.editions) {
    if (e.from && e.to) {
      out.push({
        from: e.from,
        to: e.to,
        announced: e.dates_announced,
        hours: e.hours ?? [],
        season: e.season,
      });
    }
  }
  // This season and next: fill in a placeholder where the edition has no dates yet (or is missing).
  const current = seasonLabel(today);
  const nextLabel = `${+current.slice(0, 4) + 1}-${String(+current.slice(0, 4) + 2).slice(2)}`;
  const prevLabel = `${+current.slice(0, 4) - 1}-${current.slice(2, 4)}`;
  for (const [label, prev] of [
    [current, prevLabel],
    [nextLabel, current],
  ] as const) {
    const ed = bySeason.get(label);
    const before = bySeason.get(prev);
    if (ed && !(ed.from && ed.to) && before?.from && before.to) out.push(shift(before, label));
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Precedence: lit (today within an edition's dates) > soon (within LEAD days of the start) > out of season.
 * Placeholder dates (not announced) give the same states with a thin ring and no countdown.
 */
export function illuminationState(il: PublicIllumination, today: string): IlluminationState {
  const base = { type: 'illumination' as const, id: il.id, featured: false as const };
  const eds = datedEditions(il, today);
  const lit = eds.find((e) => e.from <= today && today <= e.to);
  if (lit) {
    const hours = lit.hours.find((h) => h.from <= today && today <= h.to);
    return {
      ...base,
      state: 'lit',
      confirmed: lit.announced,
      from: lit.from,
      to: lit.to,
      hoursJa: hours?.hours_ja,
      peakSoon: false,
      why: `lit ${lit.from} to ${lit.to}${lit.announced ? '' : ' (last season’s dates)'}`,
    };
  }
  const upcoming = eds.find((e) => e.from > today);
  if (upcoming) {
    const n = daysBetween(today, upcoming.from);
    if (n <= LEAD) {
      return {
        ...base,
        state: 'soon',
        confirmed: upcoming.announced,
        from: upcoming.from,
        to: upcoming.to,
        daysToStart: n,
        countdownDays: upcoming.announced ? n : undefined,
        peakSoon: upcoming.announced && n <= PEAK_SOON_DAYS,
        why: `starts ${upcoming.from} in ${n} days${upcoming.announced ? '' : ' (last season’s dates)'}`,
      };
    }
    return {
      ...base,
      state: 'off',
      confirmed: false,
      from: upcoming.from,
      to: upcoming.to,
      daysToStart: n,
      peakSoon: false,
      why: `next run starts ${upcoming.from}${upcoming.announced ? '' : ' (last season’s dates)'}`,
    };
  }
  return { ...base, state: 'off', confirmed: false, peakSoon: false, why: 'no upcoming dates' };
}

/**
 * On a closed day during a lit run: the first later night in the same run when the venue is
 * open, with that night's hours. Undefined when the run ends before the venue reopens.
 */
export function nextOpenNight(
  il: PublicIllumination,
  place: Pick<PublicPlace, 'closures' | 'one_off_closures'>,
  today: string,
): { date: string; hoursJa?: string } | undefined {
  const run = datedEditions(il, today).find((e) => e.from <= today && today <= e.to);
  if (!run) return undefined;
  for (let d = addDays(today, 1); d <= run.to; d = addDays(d, 1)) {
    if (closedToday(place, d)) continue;
    const hours = run.hours.find((h) => h.from <= d && d <= h.to);
    return { date: d, hoursJa: hours?.hours_ja };
  }
  return undefined;
}

// ---------- closures

/**
 * Is the venue closed today? Precedence, highest first:
 *  closures.csv row > dates_open / periods_open > dates_closed / fixed_dates > weekly day off.
 * No closures data -> open (不定休/unknown shows no pill).
 */
export function closedToday(
  place: Pick<PublicPlace, 'closures' | 'one_off_closures'>,
  today: string,
): boolean {
  if (place.one_off_closures.some((c) => c.date === today)) return true;
  const c = place.closures;
  if (!c) return false;
  if (c.dates_open?.includes(today)) return false;
  if (c.periods_open?.some((p) => p.from <= today && today <= p.to)) return false;
  if (c.dates_closed?.includes(today)) return true;
  if (c.fixed_dates?.includes(today.slice(5))) return true;
  return c.weekly?.includes(weekdayOf(today)) ?? false;
}

/** Closures data past its valid_until (flag for the morning digest; still applied). */
export function closuresExpired(place: Pick<PublicPlace, 'closures'>, today: string): boolean {
  const until = place.closures?.valid_until;
  return until !== undefined && today > until;
}

// ---------- pin choice

export type FeatureState = PlantingState | IlluminationState;

/**
 * Rank, highest wins: lit illumination 6 > 見頃 5 > 咲き始め 4 > 見頃過ぎ 3 >
 * まもなく 2 (plantings and illuminations before their start) > シーズン外 1.
 */
export function rank(s: FeatureState): number {
  if (s.type === 'illumination') return s.state === 'lit' ? 6 : s.state === 'soon' ? 2 : 1;
  return { 2: 5, 1: 4, 3: 3, 0: 2, 4: 1 }[s.level];
}

/**
 * Within a rank: featured first, then more of the stage still ahead
 * (見頃: later window end; 咲き始め: higher %; 見頃過ぎ: later window end;
 *  まもなく: sooner start; lit: later end), then id so the result is stable.
 */
export function compareFeatures(a: FeatureState, b: FeatureState): number {
  const r = rank(b) - rank(a);
  if (r) return r;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  // All in epoch ms so plantings and illuminations compare on the same scale.
  const ahead = (s: FeatureState): number => {
    if (s.type === 'illumination') {
      if (s.state === 'lit') return s.to ? Date.parse(s.to) : 0;
      if (s.state === 'soon') return s.from ? -Date.parse(s.from) : 0;
      return 0;
    }
    if (s.level === STARTING) return s.bloomPct ?? 0;
    if (s.level === PEAK || s.level === PAST_PEAK) return s.window ? Date.parse(s.window.end) : 0;
    if (s.level === SOON) return s.window ? -Date.parse(s.window.start) : 0;
    return 0;
  };
  const t = ahead(b) - ahead(a);
  if (t) return t;
  return a.id.localeCompare(b.id);
}

export function featureStates(place: PublicPlace, today: string): FeatureState[] {
  return [
    ...place.plantings.map((p) => plantingState(p, today)),
    ...place.illuminations.map((il): IlluminationState => {
      const s = illuminationState(il, today);
      if (s.state !== 'lit' || !closedToday(place, today)) return s;
      return { ...s, closedTonight: true, nextNight: nextOpenNight(il, place, today) };
    }),
  ];
}

/** The feature that fronts the place's pin. Venue closures never affect it. */
export function choosePin(states: FeatureState[]): FeatureState | undefined {
  return [...states].sort(compareFeatures)[0];
}

// ---------- festivals, filters, page order

/** Festivals at this place with an edition running today (dated editions only). */
export function festivalsOn(
  festivals: PublicFestival[],
  placeId: string,
  today: string,
): PublicFestival[] {
  return festivals.filter(
    (f) =>
      f.place_ids.includes(placeId) &&
      f.editions.some((e) => e.from && e.to && e.from <= today && today <= e.to),
  );
}

export type Filter = 'in-season' | 'peak' | 'festivals' | 'illuminations' | 'all';

export interface PlaceStatus {
  place: PublicPlace;
  pin: FeatureState | undefined;
  features: FeatureState[];
  festivals: PublicFestival[];
  closed: boolean;
}

export function placeStatus(
  place: PublicPlace,
  festivals: PublicFestival[],
  today: string,
): PlaceStatus {
  const features = featureStates(place, today);
  return {
    place,
    pin: choosePin(features),
    features: pageOrder(features),
    festivals: festivalsOn(festivals, place.id, today),
    closed: closedToday(place, today),
  };
}

const isOff = (s: FeatureState) =>
  s.type === 'illumination' ? s.state === 'off' : s.level === OUT_OF_SEASON;

/**
 * シーズン中 (default): pin isn't シーズン外. 見頃のみ: a planting at 見頃.
 * 開催中のイベント: a festival on today. イルミネーション: an illumination lit or soon. すべて表示: everything.
 */
export function passesFilter(ps: PlaceStatus, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'in-season':
      return ps.pin !== undefined && !isOff(ps.pin);
    case 'peak':
      return ps.features.some((s) => s.type === 'planting' && s.level === PEAK);
    case 'festivals':
      return ps.festivals.length > 0;
    case 'illuminations':
      return ps.features.some((s) => s.type === 'illumination' && s.state !== 'off');
  }
}

/** Features a filter is about; the others don't compete for the pin while it's on. */
function filterCandidates(features: FeatureState[], filter: Filter): FeatureState[] {
  if (filter === 'peak') return features.filter((s) => s.type === 'planting' && s.level === PEAK);
  if (filter === 'illuminations')
    return features.filter((s) => s.type === 'illumination' && s.state !== 'off');
  return features;
}

/**
 * The pin shown under a filter: the usual pin choice, made among the features the filter is
 * about. 見頃のみ fronts a 見頃 planting even when a lit illumination would normally win;
 * イルミネーション fronts the illumination even when a flower is at 見頃. Same ranking either way.
 */
export function pinForFilter(ps: PlaceStatus, filter: Filter): FeatureState | undefined {
  const candidates = filterCandidates(ps.features, filter);
  return candidates.length ? choosePin(candidates) : ps.pin;
}

/**
 * Place page: illuminations in their run first, then everything in a rolling year from today:
 * in season first (earliest start on top), then upcoming by start date (finished ones end up last).
 */
export function pageOrder(states: FeatureState[]): FeatureState[] {
  const group = (s: FeatureState) =>
    s.type === 'illumination' && s.state === 'lit' ? 0 : isOff(s) ? 2 : 1;
  const start = (s: FeatureState) =>
    s.type === 'illumination'
      ? (s.from ?? '9999')
      : ((isOff(s) ? s.nextWindow?.start : s.window?.start) ?? '9999');
  return [...states].sort(
    (a, b) => group(a) - group(b) || start(a).localeCompare(start(b)) || a.id.localeCompare(b.id),
  );
}

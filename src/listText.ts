// The status line under each place in the list (CLAUDE.md: source, age, 分咲き figure and dates
// go in the list, never on the pin). One pure function per feature state; tested.

import { t, type Lang } from './i18n';
import { daysBetween, weekdayOf } from './lib/dates';
import {
  compareFeatures,
  type FeatureState,
  type PlaceStatus,
  type WindowInstance,
} from './lib/status';

/** The visible map area: west, south, east, north (MapView reports it). */
export type ViewBounds = [number, number, number, number];

const inside = (ps: PlaceStatus, [w, s, e, n]: ViewBounds) =>
  ps.place.lng >= w && ps.place.lng <= e && ps.place.lat >= s && ps.place.lat <= n;

/** Places that pass the filter and are on screen, best pin first (CLAUDE.md, "List"). */
export function listedPlaces(places: PlaceStatus[], bounds: ViewBounds | null): PlaceStatus[] {
  return places
    .filter((ps) => ps.pin && (!bounds || inside(ps, bounds)))
    .sort((a, b) => compareFeatures(a.pin!, b.pin!));
}

/** The list's count line: 一覧（Nか所） / "List (N places)". */
export function listCountText(n: number, lang: Lang): string {
  return n === 1 ? t('listCountOne', lang) : t('listCount', lang).replace('{n}', String(n));
}

export interface RowText {
  /** The main part: stage figure, tonight's hours, usual window… */
  main: string;
  /** The secondary part, shown smaller after a gap: source and age, end date, last check. */
  sub: string;
  /** Aging report: the secondary part (source and age) is shown prominently. */
  aging: boolean;
}

/** 2027-02-05 -> 2/5 (both languages). */
export const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;

const THIRDS = {
  ja: ['上旬', '中旬', '下旬'],
  en: ['early', 'mid', 'late'],
};
const MONTHS_EN = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** A window edge as month + third: "2027-02-21" -> 2月下旬 / late Feb. */
function monthThird(iso: string, lang: Lang): string {
  const m = +iso.slice(5, 7);
  const d = +iso.slice(8, 10);
  const third = THIRDS[lang][d <= 10 ? 0 : d <= 20 ? 1 : 2];
  return lang === 'ja' ? `${m}月${third}` : `${third} ${MONTHS_EN[m - 1]}`;
}

/** 例年 2月下旬〜3月上旬 / Usually late Feb – early Mar (one third only when both ends match). */
export function usualWindowText(w: WindowInstance, lang: Lang): string {
  const a = monthThird(w.start, lang);
  const b = monthThird(w.end, lang);
  if (lang === 'ja') return `例年 ${a === b ? a : `${a}〜${b}`}`;
  return `Usually ${a === b ? a : `${a} – ${b}`}`;
}

function ageText(days: number, lang: Lang): string {
  if (lang === 'ja') return days === 0 ? '今日' : days === 1 ? '昨日' : `${days}日前`;
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

const REPORT_KIND = {
  official: { ja: '公式', en: 'Official' },
  admin: { ja: '編集部', en: 'Our check' },
  user: { ja: '投稿', en: 'Visitor report' },
} as const;

const UNANNOUNCED = {
  ja: '日程未発表（昨年の日程で表示）',
  en: 'Dates not announced yet (shown with last year’s)',
};

const WEEKDAYS = {
  ja: { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' },
  en: { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' },
};

/** Closed tonight: 次回 11/27（金）17:00〜20:30 / Next: Fri 11/27, 17:00〜20:30 (hours are data). */
function nextNightText(n: { date: string; hoursJa?: string }, lang: Lang): string {
  const day = WEEKDAYS[lang][weekdayOf(n.date)];
  if (lang === 'ja') return `次回 ${md(n.date)}（${day}）${n.hoursJa ?? ''}`;
  return `Next: ${day} ${md(n.date)}${n.hoursJa ? `, ${n.hoursJa}` : ''}`;
}

/** The status line for one feature on `today` (CLAUDE.md, Status lines). Empty = nothing to show. */
export function rowText(s: FeatureState, today: string, lang: Lang): RowText {
  const line = (main: string, sub = '', aging = false): RowText => ({ main, sub, aging });
  const ja = lang === 'ja';

  if (s.type === 'illumination') {
    if (s.state === 'lit') {
      if (!s.confirmed) return line(UNANNOUNCED[lang]);
      const until = s.to ? (ja ? `${md(s.to)}まで` : `until ${md(s.to)}`) : '';
      const when = s.closedTonight
        ? s.nextNight
          ? nextNightText(s.nextNight, lang)
          : ''
        : s.hoursJa
          ? ja
            ? `今夜 ${s.hoursJa}`
            : `Tonight ${s.hoursJa}`
          : '';
      return line(when, until);
    }
    if (s.state === 'soon') {
      if (s.countdownDays === undefined) return line(UNANNOUNCED[lang]);
      const n = s.countdownDays;
      return line(ja ? `点灯まで あと${n}日` : `Lights on in ${n} day${n === 1 ? '' : 's'}`);
    }
    return line('');
  }

  // With no recent info, that is the main part and whatever follows is secondary.
  const stale = s.noRecentInfo ? (ja ? '最近の情報なし' : 'No recent info') : '';
  const rest = (text: string) => (stale ? line(stale, text) : line(text));
  switch (s.basis) {
    case 'report': {
      const r = s.report!;
      const kind = REPORT_KIND[r.kind as keyof typeof REPORT_KIND]?.[lang] ?? r.kind;
      const age = ageText(s.ageDays ?? daysBetween(r.date, today), lang);
      const main = [stale, r.detail].filter(Boolean).join(' ');
      return line(main, ja ? `${kind}（${age}）` : `${kind} (${age})`, s.freshness === 'aging');
    }
    case 'forecast':
      if (s.report?.kind === 'forecast') {
        return rest(ja ? `予想（${md(s.report.date)}時点）` : `Forecast for ${md(s.report.date)}`);
      }
      return rest(s.window ? usualWindowText(s.window, lang) : '');
    case 'last-report': {
      const checked = ja ? `最終確認 ${md(s.report!.date)}` : `Last checked ${md(s.report!.date)}`;
      return line(stale, checked);
    }
    case 'usual-window':
      return rest(s.window ? usualWindowText(s.window, lang) : '');
    case 'off-season':
      return rest(
        s.nextWindow ? `${ja ? '次回 ' : 'Next: '}${usualWindowText(s.nextWindow, lang)}` : '',
      );
  }
  return line(stale);
}

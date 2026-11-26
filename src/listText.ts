// The status line under each place in the list (CLAUDE.md: source, age, 分咲き figure and dates
// go in the list, never on the pin). One pure function per feature state; tested.

import type { Lang } from './i18n';
import { daysBetween } from './lib/dates';
import type { FeatureState, WindowInstance } from './lib/status';

export interface RowText {
  text: string;
  /** Aging report: the age is shown prominently. */
  aging: boolean;
}

const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;

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

/** The list's status line for one feature on `today`. Empty text = nothing to show. */
export function rowText(s: FeatureState, today: string, lang: Lang): RowText {
  const plain = (text: string): RowText => ({ text, aging: false });
  const ja = lang === 'ja';

  if (s.type === 'illumination') {
    if (s.state === 'lit') {
      if (!s.confirmed) return plain(UNANNOUNCED[lang]);
      const until = s.to ? (ja ? `${md(s.to)}まで` : `until ${md(s.to)}`) : '';
      const tonight = s.hoursJa ? (ja ? `今夜 ${s.hoursJa}` : `Tonight ${s.hoursJa}`) : '';
      return plain([tonight, until].filter(Boolean).join(' · '));
    }
    if (s.state === 'soon') {
      if (s.countdownDays === undefined) return plain(UNANNOUNCED[lang]);
      const n = s.countdownDays;
      return plain(ja ? `点灯まで あと${n}日` : `Lights on in ${n} day${n === 1 ? '' : 's'}`);
    }
    return plain('');
  }

  const parts: string[] = [];
  if (s.noRecentInfo) parts.push(ja ? '最近の情報なし' : 'No recent info');
  switch (s.basis) {
    case 'report': {
      const r = s.report!;
      const kind = REPORT_KIND[r.kind as keyof typeof REPORT_KIND]?.[lang] ?? r.kind;
      if (r.detail) parts.push(r.detail);
      parts.push(`${kind} · ${ageText(s.ageDays ?? daysBetween(r.date, today), lang)}`);
      return { text: parts.join(' · '), aging: s.freshness === 'aging' };
    }
    case 'forecast':
      if (s.report?.kind === 'forecast') {
        parts.push(ja ? `予想（${md(s.report.date)}時点）` : `Forecast for ${md(s.report.date)}`);
      } else if (s.window) parts.push(usualWindowText(s.window, lang));
      break;
    case 'last-report':
      parts.push(ja ? `最終確認 ${md(s.report!.date)}` : `Last checked ${md(s.report!.date)}`);
      break;
    case 'usual-window':
      if (s.window) parts.push(usualWindowText(s.window, lang));
      break;
    case 'off-season':
      if (s.nextWindow) {
        parts.push(`${ja ? '次回 ' : 'Next: '}${usualWindowText(s.nextWindow, lang)}`);
      }
      break;
  }
  return plain(parts.join(' · '));
}

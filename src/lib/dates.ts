// Calendar-day helpers. Every date in the app is an ISO string ("2027-02-22") in
// Japan time; arithmetic is done in whole days on UTC midnights, so no time zone
// or daylight-saving surprises.

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;

/** Today's date in Japan, whatever the visitor's own time zone. */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function toDay(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
}

export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

/** b - a in days (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return toDay(b) - toDay(a);
}

/** Same month and day, n years later (Feb 29 becomes Feb 28). */
export function addYears(iso: string, n: number): string {
  const y = +iso.slice(0, 4) + n;
  const md = iso.slice(5);
  return md === '02-29' && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`;
}

/** "mon".."sun" for an ISO date. */
export function weekdayOf(iso: string): 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  return names[new Date(toDay(iso) * DAY_MS).getUTCDay()]!;
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** First day of a month-third: "04-2" in 2027 -> "2027-04-11". */
export function thirdStart(monthThird: string, year: number): string {
  const m = +monthThird.slice(0, 2);
  const t = +monthThird.slice(3);
  return `${year}-${pad(m)}-${pad([1, 11, 21][t - 1]!)}`;
}

/** Last day of a month-third: "04-2" -> "2027-04-20"; "02-3" -> "2027-02-28". */
export function thirdEnd(monthThird: string, year: number): string {
  const m = +monthThird.slice(0, 2);
  const t = +monthThird.slice(3);
  const d = t === 1 ? 10 : t === 2 ? 20 : lastDayOfMonth(year, m);
  return `${year}-${pad(m)}-${pad(d)}`;
}

/** Illumination season label for a date: Nov 2026 and Jan 2027 are both "2026-27". */
export function seasonLabel(iso: string): string {
  const y = +iso.slice(0, 4);
  const start = +iso.slice(5, 7) >= 7 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

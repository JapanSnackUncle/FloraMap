import { useCallback, useState } from 'react';
import { todayJst } from './lib/dates';

/** Debug mode exists only in `npm run dev`; production builds always use today's date in Japan. */
export const DEBUG = import.meta.env.DEV;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function readDateParam(): string | null {
  const d = new URLSearchParams(window.location.search).get('date');
  return d && ISO.test(d) ? d : null;
}

/**
 * The date the app shows. In debug mode it can be overridden and is kept in the address bar
 * (?date=2027-04-16), so a view can be bookmarked or sent ("look at this on that day").
 */
export function useAppDate(): {
  date: string;
  isOverride: boolean;
  setDate: (d: string | null) => void;
} {
  const [override, setOverride] = useState<string | null>(() => (DEBUG ? readDateParam() : null));

  const setDate = useCallback((d: string | null) => {
    if (!DEBUG) return;
    const next = d === todayJst() ? null : d;
    setOverride(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('date', next);
    else url.searchParams.delete('date');
    window.history.replaceState(null, '', url);
  }, []);

  return { date: override ?? todayJst(), isOverride: override !== null, setDate };
}

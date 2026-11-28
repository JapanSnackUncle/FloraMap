// Non-UI pieces both photo tool tabs use: the last-used credit/license pair, option lists, sizes.
// Components are in fields.tsx (a file of only components keeps Vite's fast refresh working).

import { useState } from 'react';
import { OWN_LICENSE } from '../../src/lib/schema.ts';
import type { CreditPair } from './api.ts';

/** Originals longer than this (px, either side) get a warning: they go into git. */
export const MAX_SIDE = 2000;
const LAST_PAIR_KEY = 'photo-tool:last-pair';

export type Dims = { w: number; h: number };

/** The Species tab's addresses start with this (#species/ume); anything else is a place. */
export const SPECIES_HASH = 'species';
/** The Pins tab's address. */
export const PINS_HASH = 'pins';

/** The credit/license pair last chosen in either tab (new photos start with it). */
export function readLastPair(): { credit: string; license: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_PAIR_KEY) ?? 'null') as unknown;
    if (v && typeof v === 'object' && 'credit' in v && 'license' in v)
      return v as { credit: string; license: string };
  } catch {
    /* ignore */
  }
  return null;
}

export const rememberPair = (credit: string, license: string) =>
  localStorage.setItem(LAST_PAIR_KEY, JSON.stringify({ credit, license }));

/** The pair a new photo starts with: the last one chosen, else the most used one. */
export const startingPair = (pairs: CreditPair[]) =>
  readLastPair() ?? pairs[0] ?? { credit: '', license: '' };

export function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
}

export const setDimsFor =
  (set: React.Dispatch<React.SetStateAction<Record<string, Dims>>>) => (src: string, d: Dims) =>
    set((all) => (all[src]?.w === d.w && all[src]?.h === d.h ? all : { ...all, [src]: d }));

/** Credit and license choices: every value already used in data/, plus any typed in this session. */
export function usePairOptions(pairs: CreditPair[]) {
  const [added, setAdded] = useState<{ credits: string[]; licenses: string[] }>({
    credits: [],
    licenses: [],
  });
  return {
    creditOptions: uniq([...pairs.map((c) => c.credit), ...added.credits]),
    licenseOptions: uniq([...pairs.map((c) => c.license), ...added.licenses]),
    onAddCredit: (v: string) => setAdded((a) => ({ ...a, credits: uniq([...a.credits, v]) })),
    onAddLicense: (v: string) => setAdded((a) => ({ ...a, licenses: uniq([...a.licenses, v]) })),
  };
}

/**
 * Apply a credit or license change: picking a credit also picks the license most used with it,
 * and R's own photos carry no credit. Remembers the pair for the next new photo.
 */
export function withPairChange<T extends { credit: string; license: string }>(
  current: T,
  change: Partial<T>,
  pairs: CreditPair[],
): T {
  const next = { ...current, ...change };
  if (change.credit !== undefined) {
    const license = pairs.find((c) => c.credit === change.credit)?.license;
    if (license) next.license = license;
  }
  if (next.license === OWN_LICENSE) next.credit = '';
  if (change.credit !== undefined || change.license !== undefined)
    rememberPair(next.credit, next.license);
  return next;
}

/** The text shown after a save, from the server's answer. */
export function saveResultText(res: { changed: boolean; check: { ok: boolean; output: string } }): {
  ok: boolean;
  text: string;
} {
  return {
    ok: res.check.ok,
    text:
      (res.changed ? 'Saved.' : 'No change to save.') +
      (res.check.ok
        ? ` Data check: ${res.check.output}`
        : `\nData check failed:\n${res.check.output}`),
  };
}

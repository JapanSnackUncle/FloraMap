// YAML reading and writing for the photo tool. Pure functions (text in, text out) so they can be
// tested; server.ts does the file access.

import { Document, isMap, isScalar, parseDocument, visit, type Pair, type YAMLMap } from 'yaml';
import type { CreditPair, PhotoEntry } from './api.ts';

/** Image file extensions the tool lists from a photo folder. */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Keys `photos` is placed before when a place has none yet (schema order in src/lib/schema.ts). */
const PHOTOS_GOES_BEFORE = ['closures', 'plantings', 'illuminations'];

/** The `photos:` block as text, values double-quoted like the rest of data/. Ends in a newline. */
function photosBlock(photos: PhotoEntry[]): string {
  const plain = photos.map((p) => ({
    file: p.file,
    credit: p.credit,
    license: p.license,
    ...(p.focus_y === undefined ? {} : { focus_y: p.focus_y }),
  }));
  const doc = new Document({ photos: plain });
  visit(doc, {
    Pair(_key, pair) {
      if (isScalar(pair.value) && typeof pair.value.value === 'string')
        pair.value.type = 'QUOTE_DOUBLE';
    },
  });
  return doc.toString({ lineWidth: 0, doubleQuotedAsJSON: true });
}

type Ranged = { range: [number, number, number] };

/**
 * Replace a place file's top-level `photos` list. Only the text of that block changes: the rest
 * of the file (comments, order, quoting, line breaks) stays byte for byte. An empty list removes
 * the block. A new block goes before `closures`, `plantings` or `illuminations` (whichever comes
 * first in the file), else at the end. Throws on YAML it can't read, so a broken file is never
 * overwritten.
 */
export function setPlacePhotos(text: string, photos: PhotoEntry[]): string {
  const doc = parseDocument(text);
  if (doc.errors.length) throw new Error(doc.errors.map((e) => e.message).join('\n'));
  if (!isMap(doc.contents)) throw new Error('the file is not a YAML mapping');
  const map = doc.contents as YAMLMap & Ranged;
  const items = map.items as Pair[];
  const keyOf = (pair: Pair) => (isScalar(pair.key) ? String(pair.key.value) : '');
  /** Where a top-level entry's text starts (its key, at the start of a line). */
  const startOf = (i: number) => (items[i]!.key as Ranged).range[0];

  const block = photos.length ? photosBlock(photos) : '';
  const existing = items.findIndex((p) => keyOf(p) === 'photos');
  if (existing !== -1) {
    const end = existing + 1 < items.length ? startOf(existing + 1) : map.range[2];
    return text.slice(0, startOf(existing)) + block + text.slice(end);
  }
  if (!block) return text;
  const before = items.findIndex((p) => PHOTOS_GOES_BEFORE.includes(keyOf(p)));
  if (before !== -1) return text.slice(0, startOf(before)) + block + text.slice(startOf(before));
  return (text === '' || text.endsWith('\n') ? text : text + '\n') + block;
}

/**
 * Every credit/license pair in some parsed YAML values (any object holding both as strings: place
 * photos, planting and illumination photos, pin photos), most used first.
 */
export function collectCreditPairs(values: unknown[]): CreditPair[] {
  const counts = new Map<string, CreditPair>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.credit === 'string' && typeof o.license === 'string') {
      const k = JSON.stringify([o.credit, o.license]);
      const known = counts.get(k);
      if (known) known.count++;
      else counts.set(k, { credit: o.credit, license: o.license, count: 1 });
    }
    Object.values(o).forEach(walk);
  };
  values.forEach(walk);
  return [...counts.values()].sort((a, b) => b.count - a.count || a.credit.localeCompare(b.credit));
}

/** Problems with a list the tool is about to save; empty when it's fine. */
export function photoListProblems(photos: PhotoEntry[], filesInFolder: string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of photos) {
    if (!p.file || /[\\/]/.test(p.file)) problems.push(`"${p.file}": must be a bare file name`);
    else if (!filesInFolder.includes(p.file)) problems.push(`"${p.file}": not in the photo folder`);
    if (seen.has(p.file)) problems.push(`"${p.file}": listed twice`);
    seen.add(p.file);
    if (!p.credit?.trim()) problems.push(`"${p.file}": credit is empty`);
    if (!p.license?.trim()) problems.push(`"${p.file}": license is empty`);
    if (
      p.focus_y !== undefined &&
      !(Number.isInteger(p.focus_y) && p.focus_y >= 0 && p.focus_y <= 100)
    )
      problems.push(`"${p.file}": focus_y must be a whole number from 0 to 100`);
  }
  return problems;
}

// YAML reading and writing for the photo tool. Pure functions (text in, text out) so they can be
// tested; server.ts does the file access.

import { Document, isMap, isScalar, parseDocument, visit, type Pair, type YAMLMap } from 'yaml';
import { isSpeciesPhotoName } from '../../src/lib/photos.ts';
import { OWN_LICENSE } from '../../src/lib/schema.ts';
import type { CreditPair, PhotoEntry, SpeciesPhoto } from './api.ts';

/** Image file extensions the tool lists from a photo folder. */
export { IMAGE_EXTENSIONS } from '../../src/lib/photos.ts';

/** Keys `photos` is placed before when a place has none yet (schema order in src/lib/schema.ts). */
const PHOTOS_GOES_BEFORE = ['closures', 'plantings', 'illuminations'];

/**
 * The `photos:` block as text, values double-quoted like the rest of data/. Ends in a newline.
 * R's own photos (license "own") get no `credit` line.
 */
function photosBlock(photos: PhotoEntry[]): string {
  const plain = photos.map((p) => ({
    file: p.file,
    ...(p.license === OWN_LICENSE ? {} : { credit: p.credit }),
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
 * Every credit/license pair in some parsed YAML values (any object holding a license and, unless
 * it's R's own photo, a credit: place photos, planting and illumination photos, pin photos), most
 * used first. Own photos count with credit "".
 */
export function collectCreditPairs(values: unknown[]): CreditPair[] {
  const counts = new Map<string, CreditPair>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const credit = typeof o.credit === 'string' ? o.credit : o.license === OWN_LICENSE ? '' : null;
    if (credit !== null && typeof o.license === 'string') {
      const k = JSON.stringify([credit, o.license]);
      const known = counts.get(k);
      if (known) known.count++;
      else counts.set(k, { credit, license: o.license, count: 1 });
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
    if (p.license !== OWN_LICENSE && !p.credit?.trim())
      problems.push(`"${p.file}": credit is empty`);
    if (!p.license?.trim()) problems.push(`"${p.file}": license is empty`);
    if (
      p.focus_y !== undefined &&
      !(Number.isInteger(p.focus_y) && p.focus_y >= 0 && p.focus_y <= 100)
    )
      problems.push(`"${p.file}": focus_y must be a whole number from 0 to 100`);
  }
  return problems;
}

/** A species' `pin_photo` as plain YAML values: no credit for own photos, crop only when set. */
export function speciesPhotoValue(p: SpeciesPhoto): Record<string, unknown> {
  return {
    file: p.file,
    ...(p.license === OWN_LICENSE ? {} : { credit: p.credit }),
    license: p.license,
    ...(p.crop ? { crop: { x: p.crop.x, y: p.crop.y, size: p.crop.size } } : {}),
  };
}

/** The `pin_photo:` block at `indent` spaces, in species.yaml's style (crop on one line). */
function pinPhotoLines(p: SpeciesPhoto, indent: number): string[] {
  const pad = ' '.repeat(indent + 2);
  const v = speciesPhotoValue(p);
  const lines = [`${' '.repeat(indent)}pin_photo:`, `${pad}file: ${JSON.stringify(v.file)}`];
  if ('credit' in v) lines.push(`${pad}credit: ${JSON.stringify(v.credit)}`);
  lines.push(`${pad}license: ${JSON.stringify(v.license)}`);
  if (p.crop) lines.push(`${pad}crop: { x: ${p.crop.x}, y: ${p.crop.y}, size: ${p.crop.size} }`);
  return lines;
}

/** Same plain YAML values (key order ignored). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameValue(v, b[i]))
    );
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * Set (or with null, remove) one species' `pin_photo` in species.yaml's text. Only that block's
 * lines change; the rest (comments, quoting, line endings) stays byte for byte. A new block goes
 * at the end of the species' entry. Throws if the file can't be read, the species isn't there, or
 * the result doesn't parse back to exactly the intended change, so a file is never mangled.
 */
export function setSpeciesPinPhoto(text: string, id: string, photo: SpeciesPhoto | null): string {
  const before = parseDocument(text);
  if (before.errors.length) throw new Error(before.errors.map((e) => e.message).join('\n'));
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  // The entry: from its "- id: <id>" line to the next line at the dash's indent or less.
  const start = lines.findIndex((l) => {
    const m = /^(\s*)- id:\s*"?([^"\s#]+)"?\s*(#.*)?$/.exec(l);
    return m?.[2] === id;
  });
  if (start === -1) throw new Error(`species "${id}" not found in species.yaml`);
  const dash = indentOf(lines[start]!);
  const field = lines[start]!.indexOf('id:');
  let end = start + 1;
  while (end < lines.length && (lines[end]!.trim() === '' || indentOf(lines[end]!) > dash)) end++;
  // Trailing blank lines belong between entries, not to this one.
  while (end > start + 1 && lines[end - 1]!.trim() === '') end--;

  // The existing block: its key line at the field indent, then everything indented deeper.
  const key = lines.findIndex(
    (l, i) => i > start && i < end && indentOf(l) === field && /^\s*pin_photo:/.test(l),
  );
  let from = end;
  let to = end;
  if (key !== -1) {
    from = key;
    to = key + 1;
    while (to < end && (lines[to]!.trim() === '' || indentOf(lines[to]!) > field)) to++;
  }
  const block = photo ? pinPhotoLines(photo, field) : [];
  const out = [...lines.slice(0, from), ...block, ...lines.slice(to)].join(eol);

  // Check: the species' pin_photo is exactly what was asked, and nothing else changed.
  const a = before.toJS() as { species?: Record<string, unknown>[] };
  const b = parseDocument(out).toJS() as { species?: Record<string, unknown>[] };
  const without = (o: Record<string, unknown>, key: string) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));
  const expected = (a.species ?? []).map((sp) => {
    if (sp.id !== id) return sp;
    const rest = without(sp, 'pin_photo');
    return photo ? { ...rest, pin_photo: speciesPhotoValue(photo) } : rest;
  });
  if (!sameValue(b.species, expected) || !sameValue(without(a, 'species'), without(b, 'species')))
    throw new Error(`writing ${id}'s pin_photo would change more than that block; nothing written`);
  return out;
}

/** Problems with a species' pin_photo the tool is about to save; empty when it's fine. */
export function speciesPhotoProblems(
  id: string,
  p: SpeciesPhoto,
  filesInFolder: string[],
): string[] {
  const problems: string[] = [];
  if (!isSpeciesPhotoName(id, p.file))
    problems.push(
      `"${p.file}": must be named after the species ("${id}.jpg", .jpeg, .png or .webp)`,
    );
  else if (!filesInFolder.includes(p.file)) problems.push(`"${p.file}": not in photos/species/`);
  if (p.license !== OWN_LICENSE && !p.credit?.trim()) problems.push('credit is empty');
  if (!p.license?.trim()) problems.push('license is empty');
  if (p.crop) {
    const { x, y, size } = p.crop;
    const whole = (v: number, lo: number) => Number.isInteger(v) && v >= lo && v <= 100;
    if (!whole(x, 0) || !whole(y, 0) || !whole(size, 1))
      problems.push('crop: x and y must be whole numbers 0–100, size 1–100');
  }
  return problems;
}

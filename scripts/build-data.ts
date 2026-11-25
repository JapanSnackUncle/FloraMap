// data/ (YAML + CSV) -> public/data/places.json
//
//   node scripts/build-data.ts           validate and write the JSON
//   node scripts/build-data.ts --check   validate only
//
// Every problem is listed with its file and field; any problem fails the build,
// so bad data never reaches the site. Private fields (schema.PRIVATE_KEYS) are
// stripped from the output. No date logic here: stages are decided in the browser.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import {
  closureRow,
  festivalFile,
  placeFile,
  PRIVATE_KEYS,
  SCHEMA_VERSION,
  sourcesFile,
  speciesFile,
  statusRow,
  type ClosureRow,
  type FestivalFile,
  type PlaceFile,
  type PublicData,
  type PublicPlace,
  type StatusRow,
} from '../src/lib/schema.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(ROOT, 'data');
export const OUT_FILE = join(ROOT, 'public', 'data', 'places.json');

const STATUS_COLUMNS = [
  'planting_id',
  'date',
  'level',
  'kind',
  'source_id',
  'raw_text',
  'detail',
  'note',
];
const CLOSURE_COLUMNS = ['place_id', 'date', 'reason', 'source'];

export interface BuildResult {
  data: PublicData | null;
  errors: string[];
}

export function buildData(dataDir: string = DATA_DIR): BuildResult {
  const errors: string[] = [];
  const rel = (p: string) => relative(dataDir, p).split(sep).join('/');
  const err = (file: string, msg: string) => errors.push(`${file}: ${msg}`);

  function validate<T extends z.ZodType>(
    file: string,
    schema: T,
    value: unknown,
  ): z.infer<T> | null {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const issue of r.error.issues) {
      const at = issue.path.length ? issue.path.join('.') : '(file)';
      err(file, `${at}: ${issue.message}`);
    }
    return null;
  }

  function readYaml(path: string): unknown {
    try {
      return parseYaml(readFileSync(path, 'utf8'));
    } catch (e) {
      err(rel(path), `YAML error: ${(e as Error).message.split('\n')[0]}`);
      return undefined;
    }
  }

  function readCsv<T extends z.ZodType>(name: string, columns: string[], schema: T): z.infer<T>[] {
    const path = join(dataDir, name);
    let rows: string[][];
    try {
      rows = parseCsv(readFileSync(path, 'utf8'));
    } catch (e) {
      err(name, (e as Error).message);
      return [];
    }
    const header = rows.shift() ?? [];
    if (header.join(',') !== columns.join(',')) {
      err(name, `header must be exactly: ${columns.join(',')}`);
      return [];
    }
    const out: z.infer<T>[] = [];
    rows.forEach((cells, i) => {
      if (cells.length === 1 && cells[0] === '') return; // blank line
      const line = i + 2;
      if (cells.length !== columns.length) {
        err(name, `line ${line}: expected ${columns.length} columns, got ${cells.length}`);
        return;
      }
      const row = Object.fromEntries(columns.map((c, j) => [c, cells[j]]));
      const parsed = validate(`${name} line ${line}`, schema, row);
      if (parsed) out.push(parsed);
    });
    return out;
  }

  // ---------- read and validate each file on its own

  const speciesDoc = validate('species.yaml', speciesFile, readYaml(join(dataDir, 'species.yaml')));
  const sourcesDoc = validate('sources.yaml', sourcesFile, readYaml(join(dataDir, 'sources.yaml')));

  const places: { file: string; doc: PlaceFile }[] = [];
  for (const path of yamlFiles(join(dataDir, 'places'))) {
    const doc = validate(rel(path), placeFile, readYaml(path));
    if (doc) places.push({ file: rel(path), doc });
  }
  const festivals: { file: string; doc: FestivalFile }[] = [];
  for (const path of yamlFiles(join(dataDir, 'festivals'))) {
    const doc = validate(rel(path), festivalFile, readYaml(path));
    if (doc) festivals.push({ file: rel(path), doc });
  }
  const statuses: StatusRow[] = readCsv('statuses.csv', STATUS_COLUMNS, statusRow);
  const oneOffClosures: ClosureRow[] = readCsv('closures.csv', CLOSURE_COLUMNS, closureRow);

  // ---------- IDs: unique, and every reference resolves

  const unique = (kind: string, items: { id: string; file: string }[]) => {
    const seen = new Map<string, string>();
    for (const { id, file } of items) {
      const first = seen.get(id);
      if (first) err(file, `duplicate ${kind} id "${id}" (also in ${first})`);
      else seen.set(id, file);
    }
    return new Set(seen.keys());
  };

  const speciesIds = unique(
    'species',
    (speciesDoc?.species ?? []).map((s) => ({ id: s.id, file: 'species.yaml' })),
  );
  const placeIds = unique(
    'place',
    places.map(({ file, doc }) => ({ id: doc.id, file })),
  );
  const plantingPlace = new Map<string, string>();
  const featureIds = unique(
    'planting/illumination',
    places.flatMap(({ file, doc }) => [
      ...(doc.plantings ?? []).map((p) => {
        plantingPlace.set(p.id, doc.id);
        return { id: p.id, file };
      }),
      ...(doc.illuminations ?? []).map((il) => ({ id: il.id, file })),
    ]),
  );
  unique(
    'festival',
    festivals.map(({ file, doc }) => ({ id: doc.id, file })),
  );
  unique(
    'festival edition',
    festivals.flatMap(({ file, doc }) => doc.editions.map((e) => ({ id: e.id, file }))),
  );
  const sourceIds = unique(
    'source',
    (sourcesDoc?.sources ?? []).map((s) => ({ id: s.id, file: 'sources.yaml' })),
  );
  const plantingIds = new Set([...plantingPlace.keys()].filter((id) => featureIds.has(id)));

  // ---------- places

  const muniSlugs = new Map<string, { slug: string; file: string }>();
  for (const { file, doc } of places) {
    const parts = file.split('/');
    if (parts.length !== 4 || parts[0] !== 'places') {
      err(file, 'must be at places/<prefecture>/<municipality>/<place-id>.yaml');
    } else {
      if (parts[1] !== doc.prefecture)
        err(file, `folder "${parts[1]}" but prefecture is "${doc.prefecture}"`);
      if (parts[2] !== doc.municipality_slug)
        err(file, `folder "${parts[2]}" but municipality_slug is "${doc.municipality_slug}"`);
      if (parts[3] !== `${doc.id}.yaml`)
        err(file, `file name must be "${doc.id}.yaml" to match the id`);
    }
    const known = muniSlugs.get(doc.municipality);
    if (known && known.slug !== doc.municipality_slug)
      err(
        file,
        `municipality ${doc.municipality} is "${known.slug}" in ${known.file} but "${doc.municipality_slug}" here`,
      );
    else muniSlugs.set(doc.municipality, { slug: doc.municipality_slug, file });

    for (const p of doc.plantings ?? []) {
      if (speciesDoc && !speciesIds.has(p.species))
        err(file, `planting ${p.id}: unknown species "${p.species}"`);
    }
    for (const il of doc.illuminations ?? []) {
      for (const ed of il.editions) {
        const where = `illumination ${il.id} ${ed.season}`;
        if (ed.dates_announced && !(ed.from && ed.to))
          err(file, `${where}: dates_announced is true but from/to are missing`);
        if (Boolean(ed.from) !== Boolean(ed.to))
          err(file, `${where}: give both from and to, or neither`);
        if (ed.from && ed.to && ed.from > ed.to)
          err(file, `${where}: from ${ed.from} is after to ${ed.to}`);
        for (const h of ed.hours ?? []) {
          if (h.from > h.to) err(file, `${where}: hours ${h.from}–${h.to} run backwards`);
          if (ed.from && ed.to && (h.from < ed.from || h.to > ed.to))
            err(
              file,
              `${where}: hours ${h.from}–${h.to} fall outside the edition ${ed.from}–${ed.to}`,
            );
        }
      }
    }
    for (const r of doc.closures?.periods_open ?? []) {
      if (r.from > r.to) err(file, `closures.periods_open ${r.from}–${r.to} runs backwards`);
    }
  }

  // ---------- festivals

  for (const { file, doc } of festivals) {
    const parts = file.split('/');
    const prefs = new Set(
      doc.place_ids
        .map((id) => places.find((p) => p.doc.id === id)?.doc.prefecture)
        .filter(Boolean),
    );
    if (parts.length !== 3 || parts[0] !== 'festivals')
      err(file, 'must be at festivals/<prefecture>/<festival-id>.yaml');
    else {
      if (parts[2] !== `${doc.id}.yaml`)
        err(file, `file name must be "${doc.id}.yaml" to match the id`);
      for (const pref of prefs)
        if (pref !== parts[1]) err(file, `folder "${parts[1]}" but its places are in "${pref}"`);
    }
    for (const id of doc.place_ids)
      if (!placeIds.has(id)) err(file, `place_ids: unknown place "${id}"`);
    for (const id of doc.planting_ids ?? []) {
      if (!plantingIds.has(id)) err(file, `planting_ids: unknown planting "${id}"`);
      else if (!doc.place_ids.includes(plantingPlace.get(id)!))
        err(file, `planting_ids: "${id}" is at ${plantingPlace.get(id)}, which isn't in place_ids`);
    }
    for (const ed of doc.editions) {
      if (ed.dates_announced && !(ed.from && ed.to))
        err(file, `edition ${ed.id}: dates_announced is true but from/to are missing`);
      if (Boolean(ed.from) !== Boolean(ed.to))
        err(file, `edition ${ed.id}: give both from and to, or neither`);
      if (ed.from && ed.to && ed.from > ed.to)
        err(file, `edition ${ed.id}: from ${ed.from} is after to ${ed.to}`);
    }
  }

  // ---------- sources, statuses, one-off closures

  for (const s of sourcesDoc?.sources ?? []) {
    for (const id of s.planting_ids)
      if (!plantingIds.has(id)) err('sources.yaml', `${s.id}: unknown planting "${id}"`);
  }
  statuses.forEach((s, i) => {
    const where = `statuses.csv row ${i + 1} (${s.planting_id} ${s.date})`;
    if (!plantingIds.has(s.planting_id)) err(where, `unknown planting "${s.planting_id}"`);
    if (s.source_id && !sourceIds.has(s.source_id)) err(where, `unknown source "${s.source_id}"`);
    if (s.kind === 'official' && !s.source_id) err(where, 'official rows need a source_id');
  });
  oneOffClosures.forEach((c, i) => {
    if (!placeIds.has(c.place_id))
      err(`closures.csv row ${i + 1}`, `unknown place "${c.place_id}"`);
  });

  if (errors.length || !speciesDoc || !sourcesDoc) return { data: null, errors };

  // ---------- assemble the public JSON

  const festivalIdsByPlace = new Map<string, string[]>();
  for (const { doc } of festivals)
    for (const id of doc.place_ids)
      festivalIdsByPlace.set(id, [...(festivalIdsByPlace.get(id) ?? []), doc.id]);

  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

  const publicPlaces = places
    .map(({ doc }) => {
      const { municipality_slug: _slug, plantings = [], illuminations = [], ...rest } = doc;
      void _slug;
      return stripPrivate({
        ...rest,
        plantings: plantings.map((p) => ({
          ...p,
          statuses: statuses.filter((s) => s.planting_id === p.id).sort(byDate),
        })),
        illuminations,
        one_off_closures: oneOffClosures
          .filter((c) => c.place_id === doc.id)
          .sort(byDate)
          .map(({ place_id: _p, ...c }) => (void _p, c)),
        festival_ids: (festivalIdsByPlace.get(doc.id) ?? []).sort(),
      }) as PublicPlace;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const data = stripPrivate({
    schema_version: SCHEMA_VERSION,
    species: speciesDoc.species,
    places: publicPlaces,
    festivals: festivals.map((f) => f.doc).sort((a, b) => a.id.localeCompare(b.id)),
    sources: sourcesDoc.sources,
  }) as PublicData;
  // stripPrivate removes schema_version everywhere; put the top-level one back.
  data.schema_version = SCHEMA_VERSION;

  return { data, errors };
}

// ---------- helpers

function yamlFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return yamlFiles(p);
      return name.endsWith('.yaml') || name.endsWith('.yml') ? [p] : [];
    })
    .sort();
}

const PRIVATE = new Set<string>(PRIVATE_KEYS);

/** Deep copy without private keys or undefined values. */
export function stripPrivate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivate);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => !PRIVATE.has(k) && v !== undefined)
        .map(([k, v]) => [k, stripPrivate(v)]),
    );
  }
  return value;
}

/** Minimal RFC 4180 CSV: commas, double-quoted fields, "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, ''); // drop a byte-order mark (Excel adds one)
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      if (field !== '') throw new Error(`stray quote in an unquoted field near character ${i}`);
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('unclosed quote');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- command line

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checkOnly = process.argv.includes('--check');
  const { data, errors } = buildData();
  if (errors.length) {
    console.error(`Data check failed: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  const n = data!.places.reduce((sum, p) => sum + p.plantings.length, 0);
  const summary = `${data!.places.length} places, ${n} plantings, ${data!.festivals.length} festivals, ${data!.sources.length} sources`;
  if (checkOnly) {
    console.log(`Data OK: ${summary}`);
  } else {
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(data));
    console.log(`Wrote ${relative(ROOT, OUT_FILE)}: ${summary}`);
  }
}

// Data schema: one definition used twice.
// 1. scripts/build-data.ts validates every file in data/ against the *File schemas.
// 2. The app imports the exported types (import type only, so zod isn't bundled).
// Objects are strict: an unknown or misspelt field fails the build instead of being ignored.

import { z } from 'zod';

export const SCHEMA_VERSION = 1;

// ---------- primitives

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase slug like "kairakuen-ume"');

/** ISO calendar date, e.g. "2027-02-22" (Japan time). Rejects impossible dates like 2027-02-30. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date like "2027-02-22"')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'is not a real calendar date');

/** Month + third: "04-2" = mid-April (1 = 上旬, 2 = 中旬, 3 = 下旬). */
const monthThird = z.string().regex(/^(0[1-9]|1[0-2])-[123]$/, 'must be month-third like "04-2"');

/** Yearly fixed date, e.g. "12-31". */
const monthDay = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'must be MM-DD like "12-31"');

const url = z.url();
const text = z.string().min(1);
const weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const dateRange = z.strictObject({ from: isoDate, to: isoDate });

// ---------- private fields
// Kept in data/ for R and the build checks; never written to the public JSON.
export const PRIVATE_KEYS = [
  'editor_notes',
  'checked_against',
  'window_raw',
  'raw_text',
  'geocode_precision',
  'point_note',
  'format',
  'checked',
  'schema_version',
] as const;

const privateFields = {
  editor_notes: text.optional(),
  checked_against: z.array(url).optional(),
};

// ---------- place files: data/places/<prefecture>/<municipality>/<place-id>.yaml

export const usualWindow = z.strictObject({ start: monthThird, end: monthThird });

export const photo = z.strictObject({
  file: text,
  credit: text,
  license: text,
});

const percent = z.number().min(0).max(100);

/**
 * A species close-up (file in photos-species/). Optional `crop` picks the square used for pins and
 * feature rows: `x`, `y` = its centre in % of the photo's width and height, `size` = its side in %
 * of the photo's shorter side. Without `crop`, the largest centred square is used.
 */
export const pinPhoto = photo.extend({
  crop: z.strictObject({ x: percent, y: percent, size: z.number().gt(0).max(100) }).optional(),
});

export const planting = z.strictObject({
  id: slug,
  kind: z.enum(['bloom', 'foliage']),
  species: slug,
  species_variety: text.optional(),
  featured: z.boolean().optional(),
  windows: z.array(usualWindow).optional(),
  provisional: z.boolean().optional(),
  window_raw: text.optional(),
  official_urls: z.array(url).optional(),
  /** Pin image override when the species close-up doesn't fit (e.g. 河津桜). */
  pin_photo: pinPhoto.optional(),
  /** Place-specific photos, for the place page. */
  photos: z.array(photo).optional(),
  ...privateFields,
});

export const illuminationHours = z.strictObject({
  from: isoDate,
  to: isoDate,
  hours_ja: text,
  note_ja: text.optional(),
  note_en: text.optional(),
});

export const illuminationEdition = z.strictObject({
  season: z.string().regex(/^\d{4}-\d{2}$/, 'must be a season like "2026-27"'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  dates_announced: z.boolean(),
  hours: z.array(illuminationHours).optional(),
  fee_ja: text.optional(),
  fee_en: text.optional(),
  editor_notes: text.optional(),
});

export const illumination = z.strictObject({
  id: slug,
  kind: z.literal('illumination'),
  name_ja: text,
  name_en: text.optional(),
  official_urls: z.array(url).optional(),
  /** On-location photos; the first is the pin image. */
  photos: z.array(photo).optional(),
  editions: z.array(illuminationEdition).min(1),
});

export const closures = z.strictObject({
  source_url: url.optional(),
  valid_until: isoDate.optional(),
  weekly: z.array(weekday).optional(),
  fixed_dates: z.array(monthDay).optional(),
  dates_closed: z.array(isoDate).optional(),
  dates_open: z.array(isoDate).optional(),
  periods_open: z.array(dateRange).optional(),
});

export const placeFile = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  id: slug,
  name_ja: text,
  name_en: text.optional(),
  name_kana: text.optional(),
  prefecture: slug,
  municipality: text,
  municipality_slug: slug,
  address_ja: text.optional(),
  lat: z.number().min(20).max(46),
  lng: z.number().min(122).max(154),
  geocode_precision: z.enum(['lot', 'block', 'manual', 'approximate']),
  point_note: text.optional(),
  // Practical info: Japanese, plus R's English translation when there is one.
  hours_ja: text.optional(),
  hours_en: text.optional(),
  closed_ja: text.optional(),
  closed_en: text.optional(),
  fee_ja: text.optional(),
  fee_en: text.optional(),
  parking_ja: text.optional(),
  parking_en: text.optional(),
  official_urls: z.array(url).optional(),
  closures: closures.optional(),
  plantings: z.array(planting).optional(),
  illuminations: z.array(illumination).optional(),
  ...privateFields,
});

// ---------- festival files: data/festivals/<prefecture>/<festival-id>.yaml

export const festivalEdition = z.strictObject({
  id: slug,
  from: isoDate.optional(),
  to: isoDate.optional(),
  dates_announced: z.boolean(),
});

export const festivalFile = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  id: slug,
  name_ja: text,
  name_en: text.optional(),
  place_ids: z.array(slug).min(1),
  planting_ids: z.array(slug).optional(),
  fee_ja: text.optional(),
  fee_en: text.optional(),
  parking_ja: text.optional(),
  parking_en: text.optional(),
  night_events_ja: text.optional(),
  night_events_en: text.optional(),
  official_urls: z.array(url).optional(),
  editions: z.array(festivalEdition).min(1),
  ...privateFields,
});

// ---------- data/sources.yaml, data/species.yaml

export const source = z.strictObject({
  id: slug,
  name_ja: text,
  publisher: text.optional(),
  url,
  format: text.optional(),
  checked: z.enum(['yes', 'partly', 'no']),
  planting_ids: z.array(slug),
  editor_notes: text.optional(),
});

export const sourcesFile = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  sources: z.array(source),
});

export const species = z.strictObject({
  id: slug,
  kind: z.enum(['bloom', 'foliage']),
  /** Days of 咲き始め (色づき始め for leaves) shown before the usual window when there's no report. */
  starting_days: z.number().int().min(0).max(60),
  /** Close-up used as the pin image for this species' plantings. Never a place's header photo. */
  pin_photo: pinPhoto.optional(),
  name_ja: text,
  name_en: text,
});

export const speciesFile = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  species: z.array(species).min(1),
});

// ---------- data/statuses.csv, data/closures.csv (one row each)

const optionalText = z
  .string()
  .transform((s) => (s.trim() === '' ? undefined : s.trim()))
  .pipe(text.optional());

export const statusRow = z.strictObject({
  planting_id: slug,
  date: isoDate,
  level: z.coerce.number().int().min(0).max(4),
  kind: z.enum(['official', 'admin', 'user', 'forecast', 'usual']),
  source_id: optionalText,
  raw_text: optionalText,
  detail: optionalText,
  note: optionalText,
});

export const closureRow = z.strictObject({
  place_id: slug,
  date: isoDate,
  reason: optionalText,
  source: optionalText,
});

// ---------- types

export type PlaceFile = z.infer<typeof placeFile>;
export type FestivalFile = z.infer<typeof festivalFile>;
export type Source = z.infer<typeof source>;
export type Species = z.infer<typeof species>;
export type StatusRow = z.infer<typeof statusRow>;
export type ClosureRow = z.infer<typeof closureRow>;
export type Planting = z.infer<typeof planting>;
export type Illumination = z.infer<typeof illumination>;
export type Closures = z.infer<typeof closures>;

// Public output (public/data/places.json): the same shapes minus PRIVATE_KEYS,
// with statuses and one-off closures attached to what they belong to.

type Public<T> = T extends readonly (infer U)[]
  ? Public<U>[]
  : T extends object
    ? { [K in keyof T as K extends (typeof PRIVATE_KEYS)[number] ? never : K]: Public<T[K]> }
    : T;

export type PublicStatus = Public<StatusRow>;
export type PublicPlanting = Public<Planting> & {
  statuses: PublicStatus[];
  /** Copied from the planting's species by build-data. */
  starting_days: number;
  /** URL of the resized pin square (planting override, else species close-up); none → placeholder. */
  pin_src?: string;
};
export type PublicPlace = Omit<Public<PlaceFile>, 'plantings' | 'municipality_slug'> & {
  plantings: PublicPlanting[];
  illuminations: Public<Illumination>[];
  one_off_closures: Public<Omit<ClosureRow, 'place_id'>>[];
  festival_ids: string[];
};
export type PublicFestival = Public<FestivalFile>;
export type PublicSource = Public<Source>;

export interface PublicData {
  schema_version: number;
  species: Species[];
  places: PublicPlace[];
  festivals: PublicFestival[];
  sources: PublicSource[];
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PRIVATE_KEYS } from '../src/lib/schema.ts';
import { buildData, parseCsv } from './build-data.ts';

// ---------- a tiny valid dataset, written to a temp folder per test

const PLACE = `schema_version: 1
id: test-park
name_ja: "テスト公園"
prefecture: ibaraki
municipality: "水戸市"
municipality_slug: mito
lat: 36.37
lng: 140.45
geocode_precision: lot
editor_notes: "private note"
checked_against: ["https://example.com/aggregator"]
closures:
  weekly: [tue]
  dates_closed: ["2027-02-24"]
plantings:
  - id: test-park-ume
    kind: bloom
    species: ume
    windows:
      - start: "02-3"
        end: "03-1"
    provisional: true
    window_raw: "2月下旬〜3月上旬"
illuminations:
  - id: test-park-lights
    kind: illumination
    name_ja: "テストイルミ"
    editions:
      - season: "2026-27"
        from: "2026-11-01"
        to: "2027-01-31"
        dates_announced: true
        hours:
          - from: "2026-11-01"
            to: "2027-01-31"
            hours_ja: "17:00〜21:00"
`;

const FESTIVAL = `schema_version: 1
id: test-ume-matsuri
name_ja: "テスト梅まつり"
place_ids: [test-park]
planting_ids: [test-park-ume]
editions:
  - id: test-ume-matsuri-2027
    from: "2027-02-11"
    to: "2027-03-22"
    dates_announced: true
`;

const SPECIES = `schema_version: 1
species:
  - id: ume
    kind: bloom
    starting_days: 7
    name_ja: "梅"
    name_en: "Plum"
`;

const SOURCES = `schema_version: 1
sources:
  - id: test-source
    name_ja: "テスト開花情報"
    url: "https://example.com/status"
    format: "HTML"
    checked: "yes"
    planting_ids: [test-park-ume]
`;

const STATUSES = `planting_id,date,level,kind,source_id,raw_text,detail,note
test-park-ume,2027-02-20,1,official,test-source,"全体の3分咲き, 紅梅は5分",3分,
`;

const CLOSURES = `place_id,date,reason,source\ntest-park,2027-02-25,台風,https://example.com/news\n`;

let dir = '';
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

function dataset(overrides: Record<string, string | null> = {}): string {
  dir = mkdtempSync(join(tmpdir(), 'flora-data-'));
  const files: Record<string, string | null> = {
    'places/ibaraki/mito/test-park.yaml': PLACE,
    'festivals/ibaraki/test-ume-matsuri.yaml': FESTIVAL,
    'species.yaml': SPECIES,
    'sources.yaml': SOURCES,
    'statuses.csv': STATUSES,
    'closures.csv': CLOSURES,
    ...overrides,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

function errorsFor(overrides: Record<string, string | null>): string[] {
  return buildData(dataset(overrides)).errors;
}

// ---------- the real data

describe('data/ in this repo', () => {
  it('builds with no errors', () => {
    const { errors } = buildData();
    expect(errors).toEqual([]);
  });

  it('puts no private field in the public JSON', () => {
    const json = JSON.stringify(buildData().data);
    for (const key of PRIVATE_KEYS.filter((k) => k !== 'schema_version')) {
      expect(json, key).not.toContain(`"${key}"`);
    }
    expect(json).not.toContain('"municipality_slug"');
  });
});

// ---------- the fixture

describe('a valid dataset', () => {
  it('builds, attaches statuses, closures and festivals, and strips private fields', () => {
    const { data, errors } = buildData(dataset());
    expect(errors).toEqual([]);
    const place = data!.places[0]!;
    expect(place.id).toBe('test-park');
    expect(place.festival_ids).toEqual(['test-ume-matsuri']);
    expect(place.one_off_closures).toEqual([
      { date: '2027-02-25', reason: '台風', source: 'https://example.com/news' },
    ]);
    const status = place.plantings[0]!.statuses[0]!;
    expect(status).toEqual({
      planting_id: 'test-park-ume',
      date: '2027-02-20',
      level: 1,
      kind: 'official',
      source_id: 'test-source',
      detail: '3分',
    });
    const json = JSON.stringify(data);
    for (const s of [
      'private note',
      'aggregator',
      '2月下旬',
      '紅梅は5分',
      '"checked"',
      '"format"',
    ]) {
      expect(json, s).not.toContain(s);
    }
  });
});

describe('the build fails on', () => {
  const fails = (overrides: Record<string, string | null>, ...fragments: string[]) => {
    const errors = errorsFor(overrides);
    expect(errors.length, 'expected at least one error').toBeGreaterThan(0);
    for (const f of fragments) expect(errors.join('\n')).toContain(f);
  };

  it('an unknown species', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('species: ume', 'species: plum') },
      'unknown species "plum"',
    );
  });

  it('an impossible date', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('2027-02-24', '2027-02-30') },
      'not a real calendar date',
    );
  });

  it('a badly written window', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('"02-3"', '"2-3"') },
      'month-third',
    );
  });

  it('a misspelt field', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('name_ja:', 'nmae_ja:') },
      'nmae_ja',
    );
  });

  it('a missing prefecture', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('prefecture: ibaraki\n', '') },
      'prefecture',
    );
  });

  it('a folder that disagrees with the file', () => {
    fails(
      {
        'places/ibaraki/mito/test-park.yaml': null,
        'places/ibaraki/kasama/test-park.yaml': PLACE,
      },
      'folder "kasama" but municipality_slug is "mito"',
    );
  });

  it('a duplicate place id, even in another prefecture', () => {
    fails(
      {
        'places/tochigi/nikko/test-park.yaml': PLACE.replace(
          'prefecture: ibaraki',
          'prefecture: tochigi',
        )
          .replace('municipality_slug: mito', 'municipality_slug: nikko')
          .replace('"水戸市"', '"日光市"')
          .replace(/test-park-/g, 'other-'),
      },
      'duplicate place id "test-park"',
    );
  });

  it('a festival pointing at a place that does not exist', () => {
    fails(
      {
        'festivals/ibaraki/test-ume-matsuri.yaml': FESTIVAL.replace(
          'place_ids: [test-park]',
          'place_ids: [test-park, nowhere]',
        ),
      },
      'unknown place "nowhere"',
    );
  });

  it('announced dates with no dates', () => {
    fails(
      {
        'festivals/ibaraki/test-ume-matsuri.yaml': FESTIVAL.replace(
          / {4}from: .*\n {4}to: .*\n/,
          '',
        ),
      },
      'dates_announced is true but from/to are missing',
    );
  });

  it('a range in Japanese text written with – instead of 〜 (private fields exempt)', () => {
    fails(
      { 'places/ibaraki/mito/test-park.yaml': PLACE.replace('17:00〜21:00', '17:00–21:00') },
      'illuminations.0.editions.0.hours.0.hours_ja: write ranges with 〜',
    );
    expect(
      errorsFor({
        'places/ibaraki/mito/test-park.yaml': PLACE.replace(
          'window_raw: "2月下旬〜3月上旬"',
          'window_raw: "2月下旬–3月上旬"',
        ),
      }),
    ).toEqual([]);
  });

  it('illumination hours outside their edition', () => {
    fails(
      {
        'places/ibaraki/mito/test-park.yaml': PLACE.replace(
          '          - from: "2026-11-01"',
          '          - from: "2026-10-01"',
        ),
      },
      'fall outside the edition',
    );
  });

  it('a status row for an unknown planting or with a bad level', () => {
    fails(
      {
        'statuses.csv': STATUSES.replace(
          'test-park-ume,2027-02-20,1',
          'test-park-sakura,2027-02-20,7',
        ),
      },
      'statuses.csv line 2',
    );
  });

  it('an official status with no source', () => {
    fails(
      { 'statuses.csv': STATUSES.replace(',test-source,', ',,') },
      'official rows need a source_id',
    );
  });

  it('a renamed CSV column', () => {
    fails({ 'closures.csv': CLOSURES.replace('place_id', 'place') }, 'header must be exactly');
  });

  it('a pin photo file that does not exist', () => {
    fails(
      {
        'species.yaml': SPECIES.replace(
          '    name_en: "Plum"\n',
          '    name_en: "Plum"\n    pin_photo:\n      file: "missing.jpg"\n      credit: "R"\n      license: "own"\n',
        ),
      },
      'pin_photo "missing.jpg" not found in photos/species/',
    );
  });

  it('a crop field with a bad value', () => {
    fails(
      { 'species.yaml': speciesWithPhoto('      crop: { x: 50, y: 120, size: 40 }\n') },
      'crop.y',
    );
  });

  it('broken YAML', () => {
    fails({ 'species.yaml': 'species:\n  - id: [unclosed\n' }, 'YAML error');
  });
});

// ---------- pin photos

/** SPECIES with a pin_photo "ume.jpg" on ume, plus any extra lines inside it. */
function speciesWithPhoto(extra = ''): string {
  return SPECIES.replace(
    '    name_en: "Plum"\n',
    '    name_en: "Plum"\n    pin_photo:\n      file: "ume.jpg"\n      credit: "R"\n      license: "own"\n' +
      extra,
  );
}

describe('pin photos', () => {
  it('a planting override beats the species close-up; no photo → no pin_src', () => {
    const d = dataset({ 'species.yaml': speciesWithPhoto() });
    const photos = join(d, 'photos');
    mkdirSync(photos);
    writeFileSync(join(photos, 'ume.jpg'), 'species');
    writeFileSync(join(photos, 'ume-yae.jpg'), 'override');

    const plain = buildData(d, photos);
    expect(plain.errors).toEqual([]);
    expect(plain.data!.places[0]!.plantings[0]!.pin_src).toMatch(
      /^\/photos\/pins\/ume-[0-9a-f]{10}\.webp$/,
    );
    expect(plain.pinJobs).toHaveLength(1);

    const placeFile = join(d, 'places/ibaraki/mito/test-park.yaml');
    writeFileSync(
      placeFile,
      PLACE.replace(
        '    species: ume\n',
        '    species: ume\n    pin_photo:\n      file: "ume-yae.jpg"\n      credit: "R"\n      license: "own"\n',
      ),
    );
    const override = buildData(d, photos);
    expect(override.errors).toEqual([]);
    expect(override.data!.places[0]!.plantings[0]!.pin_src).toMatch(
      /\/ume-yae-[0-9a-f]{10}\.webp$/,
    );

    const none = buildData(dataset(), photos);
    expect(none.data!.places[0]!.plantings[0]!.pin_src).toBeUndefined();
  });
});

// ---------- place photos

/** PLACE with two photos; the first is the header. */
const PLACE_WITH_PHOTOS = PLACE.replace(
  'closures:\n',
  'photos:\n  - file: "gate.jpg"\n    credit: "R"\n    license: "own"\n    focus_y: 70\n' +
    '  - file: "pond.jpg"\n    credit: "R"\n    license: "own"\n' +
    'closures:\n',
);

describe('place photos', () => {
  it('cuts every photo in order to a strip with its own focus_y; no photos → none', () => {
    const d = dataset({ 'places/ibaraki/mito/test-park.yaml': PLACE_WITH_PHOTOS });
    const placePhotos = join(d, 'place-photos');
    const folder = join(placePhotos, 'ibaraki', 'mito', 'test-park');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'gate.jpg'), 'gate');
    writeFileSync(join(folder, 'pond.jpg'), 'pond');

    const r = buildData(d, join(d, 'photos'), placePhotos);
    expect(r.errors).toEqual([]);
    expect(r.headerJobs.map((j) => j.focusY)).toEqual([70, undefined]);
    // The public list replaces the raw one (file names and licenses aren't published).
    expect(r.data!.places[0]!.photos).toEqual([
      {
        src: expect.stringMatching(/^\/photos\/places\/gate-[0-9a-f]{10}\.webp$/),
        credit: 'R',
      },
      {
        src: expect.stringMatching(/^\/photos\/places\/pond-[0-9a-f]{10}\.webp$/),
        credit: 'R',
      },
    ]);

    const none = buildData(dataset(), join(d, 'photos'), placePhotos);
    expect(none.data!.places[0]!.photos).toBeUndefined();
  });

  it("fails when any photo's file is missing, not just the first", () => {
    const d = dataset({ 'places/ibaraki/mito/test-park.yaml': PLACE_WITH_PHOTOS });
    const placePhotos = join(d, 'place-photos');
    const folder = join(placePhotos, 'ibaraki', 'mito', 'test-park');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'gate.jpg'), 'gate');
    const r = buildData(d, join(d, 'photos'), placePhotos);
    expect(r.errors.join('\n')).toContain(
      'photo "pond.jpg" not found in photos/places/ibaraki/mito/test-park/',
    );
  });

  it('fails on a photo folder that matches no place path (e.g. left behind after a move)', () => {
    const d = dataset();
    const placePhotos = join(d, 'place-photos');
    mkdirSync(join(placePhotos, 'ibaraki', 'mito', 'test-park'), { recursive: true });
    expect(buildData(d, join(d, 'photos'), placePhotos).errors).toEqual([]);

    mkdirSync(join(placePhotos, 'ibaraki', 'hitachi', 'test-park'), { recursive: true });
    mkdirSync(join(placePhotos, 'test-park'), { recursive: true });
    const errors = buildData(d, join(d, 'photos'), placePhotos).errors.join('\n');
    expect(errors).toContain('photos/places/ibaraki/hitachi/test-park/: no place at this path');
    expect(errors).toContain('photos/places/test-park/: no place at this path');
  });
});

// ---------- CSV parsing

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas in fields and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('keeps empty fields', () => {
    expect(parseCsv('a,,c\n')).toEqual([['a', '', 'c']]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('"oops\n')).toThrow('unclosed quote');
  });
});

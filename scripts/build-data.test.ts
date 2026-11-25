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
            hours_ja: "17:00–21:00"
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
      'pin_photo "missing.jpg" not found',
    );
  });

  it('broken YAML', () => {
    fails({ 'species.yaml': 'species:\n  - id: [unclosed\n' }, 'YAML error');
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

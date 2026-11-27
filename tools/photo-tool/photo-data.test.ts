import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  collectCreditPairs,
  photoListProblems,
  setPlacePhotos,
  setSpeciesPinPhoto,
  speciesPhotoProblems,
} from './photo-data.ts';

const PLACE = `schema_version: 1
id: test-park
name_ja: "テスト公園" # a comment that must survive
official_urls: ["https://example.jp/"]
closures:
  weekly: [mon]
plantings:
  - id: test-park-ume
    kind: bloom
`;

const yamlFilesIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? yamlFilesIn(p) : n.endsWith('.yaml') ? [p] : [];
  });

describe('setPlacePhotos', () => {
  it('adds photos before closures, double-quoted, keeping the rest as written', () => {
    // An own photo gets no credit line, whatever the page sent.
    const out = setPlacePhotos(PLACE, [
      { file: 'gate.jpg', credit: 'R', license: 'own', focus_y: 70 },
      {
        file: '池.jpg',
        credit: 'いばらき観光キャンペーン推進協議会',
        license: 'ibaraki-photo-library',
      },
    ]);
    expect(out).toBe(
      PLACE.replace(
        'closures:\n',
        'photos:\n' +
          '  - file: "gate.jpg"\n    license: "own"\n    focus_y: 70\n' +
          '  - file: "池.jpg"\n    credit: "いばらき観光キャンペーン推進協議会"\n' +
          '    license: "ibaraki-photo-library"\n' +
          'closures:\n',
      ),
    );
  });

  it('replaces an existing list in place, and an empty list removes the key', () => {
    const once = setPlacePhotos(PLACE, [{ file: 'a.jpg', credit: 'R', license: 'own' }]);
    const twice = setPlacePhotos(once, [
      { file: 'b.jpg', credit: 'R', license: 'own', focus_y: 20 },
    ]);
    expect(twice).toContain('photos:\n  - file: "b.jpg"');
    expect(twice).not.toContain('a.jpg');
    expect(twice.indexOf('photos:')).toBeLessThan(twice.indexOf('closures:'));
    expect(setPlacePhotos(twice, [])).toBe(PLACE);
  });

  it('adds at the end when no later key exists', () => {
    const out = setPlacePhotos('schema_version: 1\nid: x\n', [
      { file: 'a.jpg', credit: 'R', license: 'own' },
    ]);
    expect(parse(out)).toEqual({
      schema_version: 1,
      id: 'x',
      photos: [{ file: 'a.jpg', license: 'own' }],
    });
  });

  it('rejects broken YAML instead of overwriting it', () => {
    expect(() => setPlacePhotos('id: [unclosed\n', [])).toThrow();
  });

  it('changes nothing but photos in any real place file, and writes them back unchanged', () => {
    const photo = { file: 'a.jpg', credit: 'R "x"', license: 'permission', focus_y: 40 };
    for (const file of yamlFilesIn(join(import.meta.dirname, '..', '..', 'data', 'places'))) {
      const text = readFileSync(file, 'utf8');
      const { photos: original, ...before } = parse(text);
      const replaced = setPlacePhotos(text, [photo]);
      const { photos, ...rest } = parse(replaced);
      expect(photos, file).toEqual([photo]);
      expect(rest, file).toEqual(before);
      // Putting the original list back gives the file as it was (byte for byte for files the
      // tool wrote; for files without photos, removing the block does).
      expect(parse(setPlacePhotos(replaced, original ?? [])), file).toEqual(parse(text));
      if (!original) expect(setPlacePhotos(replaced, []), file).toBe(text);
    }
  });
});

describe('collectCreditPairs', () => {
  it('counts pairs anywhere in the data, most used first', () => {
    const pairs = collectCreditPairs([
      { photos: [{ file: 'a', credit: 'R', license: 'own' }] },
      {
        species: [{ pin_photo: { file: 'b', credit: 'R', license: 'own' } }],
        plantings: [{ photos: [{ file: 'c', credit: 'X', license: 'permission' }] }],
      },
    ]);
    expect(pairs).toEqual([
      { credit: 'R', license: 'own', count: 2 },
      { credit: 'X', license: 'permission', count: 1 },
    ]);
  });

  it('counts own photos (no credit in the YAML) with credit ""', () => {
    expect(collectCreditPairs([{ photos: [{ file: 'a', license: 'own' }] }])).toEqual([
      { credit: '', license: 'own', count: 1 },
    ]);
  });
});

describe('photoListProblems', () => {
  it('flags missing files, duplicates, empty fields and bad focus_y', () => {
    expect(photoListProblems([{ file: 'a.jpg', credit: 'R', license: 'x' }], ['a.jpg'])).toEqual(
      [],
    );
    // R's own photos need no credit.
    expect(photoListProblems([{ file: 'a.jpg', credit: '', license: 'own' }], ['a.jpg'])).toEqual(
      [],
    );
    const problems = photoListProblems(
      [
        { file: 'a.jpg', credit: '', license: 'permission', focus_y: 50.5 },
        { file: 'a.jpg', credit: 'R', license: ' ' },
        { file: '../x.jpg', credit: 'R', license: 'own' },
        { file: 'gone.jpg', credit: 'R', license: 'own' },
      ],
      ['a.jpg'],
    );
    expect(problems).toEqual([
      '"a.jpg": credit is empty',
      '"a.jpg": focus_y must be a whole number from 0 to 100',
      '"a.jpg": listed twice',
      '"a.jpg": license is empty',
      '"../x.jpg": must be a bare file name',
      '"gone.jpg": not in the photo folder',
    ]);
  });
});

const SPECIES = [
  'schema_version: 1',
  'species:',
  '  - id: ume',
  '    kind: bloom',
  '    name_ja: "梅" # keep me',
  '    pin_photo:',
  '      file: "ume.jpg"',
  '      license: "own"',
  '      crop: { x: 40, y: 55, size: 80 }',
  '  - id: sakura',
  '    kind: bloom',
  '    name_ja: "桜"',
  '',
  '  - id: tulip',
  '    kind: bloom',
  '',
].join('\r\n');

describe('setSpeciesPinPhoto', () => {
  it('replaces one block in place, keeping CRLF, comments and the other species', () => {
    const out = setSpeciesPinPhoto(SPECIES, 'ume', {
      file: 'ume.jpg',
      credit: 'X',
      license: 'permission',
      crop: { x: 30, y: 80, size: 40 },
    });
    expect(out).toBe(
      SPECIES.replace(
        '      license: "own"\r\n      crop: { x: 40, y: 55, size: 80 }',
        '      credit: "X"\r\n      license: "permission"\r\n      crop: { x: 30, y: 80, size: 40 }',
      ),
    );
  });

  it('adds a block at the end of the entry (before blank lines), own with no credit or crop', () => {
    const out = setSpeciesPinPhoto(SPECIES, 'sakura', {
      file: 'sakura.jpg',
      credit: 'ignored',
      license: 'own',
    });
    expect(out).toContain(
      '    name_ja: "桜"\r\n    pin_photo:\r\n      file: "sakura.jpg"\r\n      license: "own"\r\n\r\n  - id: tulip',
    );
    // The last entry, at the end of the file.
    expect(
      parse(setSpeciesPinPhoto(SPECIES, 'tulip', { file: 'tulip.png', credit: '', license: 'own' }))
        .species[2],
    ).toEqual({ id: 'tulip', kind: 'bloom', pin_photo: { file: 'tulip.png', license: 'own' } });
  });

  it('null removes the block; unknown species and broken YAML throw', () => {
    expect(setSpeciesPinPhoto(SPECIES, 'ume', null)).toBe(
      SPECIES.replace(
        '    pin_photo:\r\n      file: "ume.jpg"\r\n      license: "own"\r\n      crop: { x: 40, y: 55, size: 80 }\r\n',
        '',
      ),
    );
    expect(() => setSpeciesPinPhoto(SPECIES, 'rose', null)).toThrow('not found');
    expect(() => setSpeciesPinPhoto('species: [unclosed\n', 'ume', null)).toThrow();
  });

  it('writes every species of the real species.yaml back unchanged', () => {
    const file = join(import.meta.dirname, '..', '..', 'data', 'species.yaml');
    const text = readFileSync(file, 'utf8');
    for (const sp of parse(text).species as { id: string; pin_photo?: never }[]) {
      const p = sp.pin_photo as
        { file: string; credit?: string; license: string; crop?: never } | undefined;
      expect(
        setSpeciesPinPhoto(text, sp.id, p ? { ...p, credit: p.credit ?? '' } : null),
        sp.id,
      ).toBe(text);
    }
  });
});

describe('speciesPhotoProblems', () => {
  it('checks the name, the folder, license, credit and crop', () => {
    const ok = { file: 'ume.jpg', credit: '', license: 'own', crop: { x: 40, y: 55, size: 80 } };
    expect(speciesPhotoProblems('ume', ok, ['ume.jpg'])).toEqual([]);
    expect(
      speciesPhotoProblems(
        'ume',
        { file: 'tulip.jpg', credit: '', license: 'x', crop: { x: 40.5, y: 0, size: 0 } },
        ['tulip.jpg'],
      ),
    ).toEqual([
      '"tulip.jpg": must be named after the species ("ume.jpg", .jpeg, .png or .webp)',
      'credit is empty',
      'crop: x and y must be whole numbers 0–100, size 1–100',
    ]);
    expect(speciesPhotoProblems('ume', ok, [])).toEqual(['"ume.jpg": not in photos/species/']);
  });
});

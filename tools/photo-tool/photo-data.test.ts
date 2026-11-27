import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { collectCreditPairs, photoListProblems, setPlacePhotos } from './photo-data.ts';

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
          '  - file: "gate.jpg"\n    credit: "R"\n    license: "own"\n    focus_y: 70\n' +
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
      photos: [{ file: 'a.jpg', credit: 'R', license: 'own' }],
    });
  });

  it('rejects broken YAML instead of overwriting it', () => {
    expect(() => setPlacePhotos('id: [unclosed\n', [])).toThrow();
  });

  it('changes nothing but photos in any real place file, and writes them back unchanged', () => {
    const photo = { file: 'a.jpg', credit: 'R "x"', license: 'own', focus_y: 40 };
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
});

describe('photoListProblems', () => {
  it('flags missing files, duplicates, empty fields and bad focus_y', () => {
    expect(photoListProblems([{ file: 'a.jpg', credit: 'R', license: 'own' }], ['a.jpg'])).toEqual(
      [],
    );
    const problems = photoListProblems(
      [
        { file: 'a.jpg', credit: '', license: 'own', focus_y: 50.5 },
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

// legendCells draws through pins.ts, which also holds drawPin (DOM types); the test only reads looks.
/// <reference lib="dom" />
import { describe, expect, it } from 'vitest';
import { legendCells, legendRows } from './legend';
import type { FeatureState } from './lib/status';

const planting = (kind: 'bloom' | 'foliage', level: 0 | 1 | 2 | 3 | 4, noRecentInfo = false) =>
  ({ type: 'planting', id: 'x', kind, level, noRecentInfo }) as FeatureState;
const illumination = (state: 'soon' | 'lit' | 'off') =>
  ({ type: 'illumination', id: 'x', state }) as FeatureState;
const place = (pin: FeatureState | undefined, festival = false) => ({
  pin,
  festivals: festival ? [{} as never] : [],
});

describe('legend rows', () => {
  it('has no rows when no place passes the filter', () => {
    expect(legendRows([]).size).toBe(0);
  });

  it('shows a stage row when some pin uses it, whatever its stage', () => {
    const rows = legendRows([place(planting('bloom', 0)), place(planting('foliage', 3))]);
    expect(rows).toEqual(new Set(['bloom', 'foliage']));
  });

  it('on 2027-04-05-like data: flowers only, no gold, no festival dot', () => {
    const rows = legendRows([place(planting('bloom', 1)), place(planting('bloom', 2))]);
    expect(rows.has('illumination')).toBe(false);
    expect(rows.has('festival')).toBe(false);
  });

  it('counts シーズン外 pins (すべて表示) for the シーズン外 row only', () => {
    const rows = legendRows([place(planting('foliage', 4)), place(illumination('off'))]);
    expect(rows).toEqual(new Set(['off']));
  });

  it('counts an illumination before its start or lit for the illumination row', () => {
    expect(legendRows([place(illumination('soon'))]).has('illumination')).toBe(true);
    expect(legendRows([place(illumination('lit'))]).has('illumination')).toBe(true);
  });

  it('gives "no recent info" no row (its look is still to be designed)', () => {
    expect(legendRows([place(planting('bloom', 2, true))]).size).toBe(0);
  });

  it('shows the festival row when some place has a festival on', () => {
    expect(legendRows([place(planting('bloom', 2), true)]).has('festival')).toBe(true);
  });
});

describe('legend cells', () => {
  it('shows a whole sequence in each stage row', () => {
    expect(legendCells('bloom', {}, 'ja').map((c) => c.label)).toEqual([
      'まもなく',
      '咲き始め',
      '見頃',
      '見頃過ぎ',
    ]);
    expect(legendCells('foliage', {}, 'en').map((c) => c.label)).toEqual([
      'Green',
      'Turning Color',
      'Peak',
      'Past Peak',
    ]);
  });

  it('draws まもなく in colour and シーズン外 grey, like the map', () => {
    expect(legendCells('bloom', {}, 'ja')[0]!.look.photoFilter).toBe('none');
    expect(legendCells('off', {}, 'ja')[0]!.look.photoFilter).toBe('grey');
  });

  it('uses the species close-up when there is one', () => {
    const cells = legendCells('bloom', { sakura: '/photos/pins/sakura.webp' }, 'ja');
    expect(cells[0]!.look.photo).toContain('sakura.webp');
  });

  it('puts the dot on the festival pin and the glow on the lit illumination', () => {
    expect(legendCells('festival', {}, 'ja')[0]!.look.festival).toBe(true);
    expect(legendCells('illumination', {}, 'ja').map((c) => c.look.glow)).toEqual([false, true]);
  });
});

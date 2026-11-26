import { describe, expect, it } from 'vitest';
import { clipLine, mergeLines, simplify } from './build-rail.ts';

describe('clipLine', () => {
  it('keeps a line that is fully inside', () => {
    expect(
      clipLine(
        [
          [1, 1],
          [5, 5],
          [9, 1],
        ],
        10,
      ),
    ).toEqual([
      [
        [1, 1],
        [5, 5],
        [9, 1],
      ],
    ]);
  });

  it('cuts the margin off a line crossing the edge', () => {
    expect(
      clipLine(
        [
          [-5, 5],
          [5, 5],
        ],
        10,
      ),
    ).toEqual([
      [
        [0, 5],
        [5, 5],
      ],
    ]);
  });

  it('splits a line that leaves and comes back', () => {
    expect(
      clipLine(
        [
          [2, 2],
          [2, 15],
          [8, 15],
          [8, 2],
        ],
        10,
      ),
    ).toEqual([
      [
        [2, 2],
        [2, 10],
      ],
      [
        [8, 10],
        [8, 2],
      ],
    ]);
  });

  it('drops a line entirely outside', () => {
    expect(
      clipLine(
        [
          [11, 1],
          [12, 2],
        ],
        10,
      ),
    ).toEqual([]);
  });
});

describe('mergeLines', () => {
  it('joins pieces that meet end to end, whichever way round they run', () => {
    const merged = mergeLines([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [3, 0],
      ],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.map((p) => p[0]).sort()).toEqual([0, 1, 2, 3]);
  });

  it('leaves separate lines apart', () => {
    expect(
      mergeLines([
        [
          [0, 0],
          [1, 0],
        ],
        [
          [5, 5],
          [6, 5],
        ],
      ]),
    ).toHaveLength(2);
  });
});

describe('simplify', () => {
  it('drops points within the tolerance and keeps real bends', () => {
    expect(
      simplify(
        [
          [0, 0],
          [1, 0.001],
          [2, 0],
          [2, 2],
        ],
        0.01,
      ),
    ).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
    ]);
  });
});

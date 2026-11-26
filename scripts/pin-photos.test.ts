import { describe, expect, it } from 'vitest';
import { cropBox } from './pin-photos.ts';

describe('cropBox', () => {
  it('no crop: the largest centred square', () => {
    expect(cropBox(400, 300, undefined)).toEqual({ left: 50, top: 0, side: 300 });
    expect(cropBox(300, 400, undefined)).toEqual({ left: 0, top: 50, side: 300 });
  });

  it('centre in % of width/height, side in % of the shorter side', () => {
    // side = 40% of 300 = 120; centre (200, 150) → left 140, top 90
    expect(cropBox(400, 300, { x: 50, y: 50, size: 40 })).toEqual({
      left: 140,
      top: 90,
      side: 120,
    });
  });

  it('a square that runs off the photo is an error', () => {
    expect(cropBox(400, 300, { x: 5, y: 95, size: 40 })).toEqual({
      error: 'crop runs off the left and bottom edge of the photo',
    });
  });
});

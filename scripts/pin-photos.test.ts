import { describe, expect, it } from 'vitest';
import { headerBand } from '../src/lib/photos.ts';
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

describe('headerBand (2:1)', () => {
  it('no focus: the middle of the photo, full width', () => {
    expect(headerBand(4000, 3000)).toEqual({ left: 0, top: 500, width: 4000, height: 2000 });
  });

  it('centres the band on focus_y', () => {
    // Portrait 3000×4000, subject 30% down: band 1500 tall, top 1200 − 750.
    expect(headerBand(3000, 4000, 30)).toEqual({ left: 0, top: 450, width: 3000, height: 1500 });
  });

  it('keeps the band inside the photo when the focus is near an edge', () => {
    // 75% down a 4:3 photo would put the band's top at 1250; it can go no lower than 1000.
    expect(headerBand(4000, 3000, 75).top).toBe(1000);
    expect(headerBand(4000, 3000, 0).top).toBe(0);
  });

  it('panoramas wider than 2:1: full height, centred left to right; focus_y has no effect', () => {
    expect(headerBand(6000, 2000, 90)).toEqual({ left: 1000, top: 0, width: 4000, height: 2000 });
  });
});

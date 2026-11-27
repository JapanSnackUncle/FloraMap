import { describe, expect, it } from 'vitest';
import { cropBox, fitCrop, isSpeciesPhotoName } from './photos';

describe('isSpeciesPhotoName', () => {
  it('accepts <id>.<image extension> only', () => {
    expect(isSpeciesPhotoName('ume', 'ume.jpg')).toBe(true);
    expect(isSpeciesPhotoName('kochia-red', 'kochia-red.webp')).toBe(true);
    expect(isSpeciesPhotoName('ume', 'tulip.jpg')).toBe(false);
    expect(isSpeciesPhotoName('ume', 'ume-yae.jpg')).toBe(false);
    expect(isSpeciesPhotoName('ume', 'ume.gif')).toBe(false);
  });
});

describe('fitCrop', () => {
  it('leaves a crop that fits alone (rounded to whole numbers)', () => {
    expect(fitCrop(4000, 3000, { x: 30.4, y: 80.2, size: 40 })).toEqual({ x: 30, y: 80, size: 40 });
  });

  it('moves the centre in so the square stays on the photo', () => {
    // 4000×3000, size 40 → side 1200: x from 15 to 85, y from 20 to 80.
    expect(fitCrop(4000, 3000, { x: 0, y: 100, size: 40 })).toEqual({ x: 15, y: 80, size: 40 });
  });

  it('keeps size within 1–100; 100 on the short side pins that axis to the middle', () => {
    expect(fitCrop(4000, 3000, { x: 10, y: 10, size: 150 })).toEqual({
      x: 38,
      y: 50,
      size: 100,
    });
    expect(fitCrop(4000, 3000, { x: 50, y: 50, size: 0 }).size).toBe(1);
  });

  it('always gives a crop cropBox accepts, odd sizes included', () => {
    for (const [w, h] of [
      [4031, 3023],
      [3023, 4031],
      [777, 777],
      [1001, 999],
    ] as const)
      for (let size = 1; size <= 100; size += 7)
        for (const x of [0, 33, 100])
          for (const y of [0, 67, 100]) {
            const c = fitCrop(w, h, { x, y, size });
            expect(cropBox(w, h, c), `${w}×${h} ${JSON.stringify(c)}`).not.toHaveProperty('error');
          }
  });
});

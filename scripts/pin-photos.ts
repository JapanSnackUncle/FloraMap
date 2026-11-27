// Photos -> small WebP files the app downloads instead of the originals:
// - species close-ups (photos-species/) -> squares in public/photos/pins/;
// - place header photos (photos/places/<place-id>/) -> HEADER_ASPECT bands, HEADER_WIDTH wide, in
//   public/photos/places/ (headerBand: where the band is cut).
//
// The originals are full-size phone photos (MBs each). Each output name carries a hash of the
// source bytes, the crop and the output settings, so an unchanged photo is never redone and a
// changed one gets a new URL (no stale copy in a browser cache).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import type { z } from 'zod';
import { HEADER_ASPECT } from '../src/lib/photos.ts';
import type { pinPhoto } from '../src/lib/schema.ts';

export type Crop = NonNullable<z.infer<typeof pinPhoto>['crop']>;

/** Output side in pixels: 38 px of photo in a 48 px pin, 1.3× when selected (about 49 px), on a 3–4× screen. */
export const PIN_SIZE = 192;
/** Header photo width in pixels: a 400 px panel on a 2× screen. Never enlarged. */
export const HEADER_WIDTH = 800;
const QUALITY = 80;
export const PIN_URL_DIR = '/photos/pins';
export const HEADER_URL_DIR = '/photos/places';

export interface PhotoJob {
  /** Absolute path of the original. */
  source: string;
  /** A pin square (cut by `crop`), or a header band (cut around `focusY`). */
  shape: 'pin' | 'header';
  crop?: Crop;
  /** Header photos: how far down the subject is, in % (default 50). */
  focusY?: number;
  /** Output file name inside the output folder. */
  out: string;
  /** Where the photo is named, for error messages. */
  where: string;
}

/** Output file name for a photo: `<stem>-<hash>.webp`. Reads the source to hash it. */
export function photoFileName(
  source: string,
  shape: PhotoJob['shape'],
  cut?: { crop?: Crop; focusY?: number },
): string {
  const settings =
    shape === 'pin'
      ? { crop: cut?.crop ?? null, PIN_SIZE }
      : { focusY: cut?.focusY ?? 50, HEADER_ASPECT, HEADER_WIDTH };
  const h = createHash('sha1')
    .update(readFileSync(source))
    .update(JSON.stringify({ ...settings, QUALITY }))
    .digest('hex')
    .slice(0, 10);
  return `${parse(source).name}-${h}.webp`;
}

/**
 * The square to cut, in pixels, or an error if it doesn't fit in the photo.
 * Crop: centre at x%, y% of width/height; side = size% of the shorter side.
 */
export function cropBox(
  width: number,
  height: number,
  crop: Crop | undefined,
): { left: number; top: number; side: number } | { error: string } {
  const short = Math.min(width, height);
  if (!crop) {
    return {
      left: Math.floor((width - short) / 2),
      top: Math.floor((height - short) / 2),
      side: short,
    };
  }
  const side = Math.round((short * crop.size) / 100);
  const left = Math.round((width * crop.x) / 100 - side / 2);
  const top = Math.round((height * crop.y) / 100 - side / 2);
  const off: string[] = [];
  if (left < 0) off.push('left');
  if (top < 0) off.push('top');
  if (left + side > width) off.push('right');
  if (top + side > height) off.push('bottom');
  if (off.length) return { error: `crop runs off the ${off.join(' and ')} edge of the photo` };
  return { left, top, side };
}

/**
 * The header band to cut, in pixels: the widest HEADER_ASPECT rectangle the photo holds.
 * - Narrower than HEADER_ASPECT (most photos): full width, moved up or down so the point `focusY`%
 *   down the photo is as near the band's middle as the photo's edges allow.
 * - Wider (panoramas): full height, centred left to right.
 */
export function headerBand(
  width: number,
  height: number,
  focusY = 50,
): { left: number; top: number; width: number; height: number } {
  if (width / height >= HEADER_ASPECT) {
    const w = Math.round(height * HEADER_ASPECT);
    return { left: Math.floor((width - w) / 2), top: 0, width: w, height };
  }
  const h = Math.round(width / HEADER_ASPECT);
  const ideal = Math.round((height * focusY) / 100 - h / 2);
  return { left: 0, top: Math.min(Math.max(ideal, 0), height - h), width, height: h };
}

/**
 * Write every missing output and delete outputs no job needs. With `checkOnly`, write nothing:
 * only check that each crop fits. Returns problems as "file: message" strings.
 */
export async function writePhotos(
  jobs: PhotoJob[],
  outDir: string,
  checkOnly = false,
): Promise<string[]> {
  const errors: string[] = [];
  if (!checkOnly) mkdirSync(outDir, { recursive: true });
  for (const job of jobs) {
    const target = join(outDir, job.out);
    if (!checkOnly && existsSync(target)) continue;
    // Apply the phone's rotation flag first, so width/height and the crop match the photo as seen.
    const upright = await sharp(job.source).rotate().toBuffer({ resolveWithObject: true });
    if (job.shape === 'header') {
      if (checkOnly) continue;
      const band = headerBand(upright.info.width, upright.info.height, job.focusY);
      await sharp(upright.data)
        .extract(band)
        .resize({ width: HEADER_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(target);
      continue;
    }
    const box = cropBox(upright.info.width, upright.info.height, job.crop);
    if ('error' in box) {
      errors.push(`${job.where}: ${box.error}`);
      continue;
    }
    if (checkOnly) continue;
    await sharp(upright.data)
      .extract({ left: box.left, top: box.top, width: box.side, height: box.side })
      .resize(PIN_SIZE, PIN_SIZE)
      .webp({ quality: QUALITY })
      .toFile(target);
  }
  if (!checkOnly && existsSync(outDir)) {
    const keep = new Set(jobs.map((j) => j.out));
    for (const f of readdirSync(outDir)) if (!keep.has(f)) rmSync(join(outDir, f));
  }
  return errors;
}

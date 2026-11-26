// Species close-ups (photos-species/) -> small square WebP files in public/photos/pins/.
//
// The originals are full-size phone photos (MBs each); pins and feature rows are about 44 px, so
// the app only ever downloads these squares. Each output name carries a hash of the source bytes,
// the crop and the output settings, so an unchanged photo is never redone and a changed one gets
// a new URL (no stale copy in a browser cache).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import type { z } from 'zod';
import type { pinPhoto } from '../src/lib/schema.ts';

export type Crop = NonNullable<z.infer<typeof pinPhoto>['crop']>;

/** Output side in pixels: 38 px of photo in a 48 px pin, 1.3× when selected (about 49 px), on a 3–4× screen. */
export const PIN_SIZE = 192;
const QUALITY = 80;
export const PIN_URL_DIR = '/photos/pins';

export interface PinJob {
  /** Absolute path of the original. */
  source: string;
  crop?: Crop;
  /** Output file name inside public/photos/pins/. */
  out: string;
  /** Where the photo is named, for error messages. */
  where: string;
}

/** Output file name for a photo: `<stem>-<hash>.webp`. Reads the source to hash it. */
export function pinFileName(source: string, crop: Crop | undefined): string {
  const h = createHash('sha1')
    .update(readFileSync(source))
    .update(JSON.stringify({ crop: crop ?? null, PIN_SIZE, QUALITY }))
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
 * Write every missing output and delete outputs no job needs. With `checkOnly`, write nothing:
 * only check that each crop fits. Returns problems as "file: message" strings.
 */
export async function writePinPhotos(
  jobs: PinJob[],
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

// Photos -> small WebP files the app downloads instead of the originals:
// - species close-ups (photos/species/) -> squares in public/photos/pins/;
// - place photos (photos/places/<prefecture>/<municipality>/<place-id>/) -> HEADER_ASPECT bands,
//   HEADER_WIDTH wide, in public/photos/places/ (headerBand in src/lib/photos.ts: where the band is cut).
//
// The originals are full-size phone photos (MBs each). Each output name carries a hash of the
// source bytes, the crop and the output settings, so an unchanged photo is never redone and a
// changed one gets a new URL (no stale copy in a browser cache).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import { cropBox, HEADER_ASPECT, headerBand, PIN_SIZE, type Crop } from '../src/lib/photos.ts';

export { cropBox, PIN_SIZE, type Crop };
/** Place photo strip width in pixels: a 400 px panel on a 2× screen. Never enlarged. */
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
  /** Place photos: how far down the subject is, in % (default 50). */
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

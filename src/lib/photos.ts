// Photo shapes shared by the build (scripts/pin-photos.ts cuts the files), the app (PlacePage
// shows them) and the photo tool (tools/photo-tool/ previews the cut), so they can't disagree. No Vite-only imports: scripts run under plain Node.

/** A place's header photo is a band this many times wider than tall (2 = 2:1). */
export const HEADER_ASPECT = 2;

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

/** File extensions a photo original may have (lower case). */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Side of a pin square in pixels: 38 px of photo in a 48 px pin, 1.3× when selected (about 49 px), on a 3–4× screen. */
export const PIN_SIZE = 192;

/**
 * A pin photo's square: its centre at x%, y% of the photo's width and height, its side size% of
 * the photo's shorter side (`crop` in the YAML).
 */
export interface Crop {
  x: number;
  y: number;
  size: number;
}

/** A species' pin photo is named after the species: `<id>.<one of IMAGE_EXTENSIONS>`. */
export function isSpeciesPhotoName(speciesId: string, file: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => file === `${speciesId}${ext}`);
}

/**
 * The square to cut, in pixels, or an error if it doesn't fit in the photo.
 * Without a crop: the largest centred square.
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
 * The nearest crop in whole numbers that cropBox accepts: size 1–100, and the centre moved in
 * just far enough that the square stays on the photo (the photo tool's circle can't leave it).
 */
export function fitCrop(width: number, height: number, crop: Crop): Crop {
  const size = Math.min(Math.max(Math.round(crop.size), 1), 100);
  const half = Math.round((Math.min(width, height) * size) / 100) / 2;
  const fit = (v: number, dim: number) => {
    const lo = Math.ceil((half / dim) * 100);
    const hi = Math.floor(100 - (half / dim) * 100);
    return lo > hi ? 50 : Math.min(Math.max(Math.round(v), lo), hi);
  };
  const out = { x: fit(crop.x, width), y: fit(crop.y, height), size };
  // Pixel rounding in cropBox can still leave the square one pixel over an edge: step inwards.
  for (let i = 0; i < 4; i++) {
    const box = cropBox(width, height, out);
    if (!('error' in box)) break;
    if (box.error.includes('left')) out.x++;
    if (box.error.includes('right')) out.x--;
    if (box.error.includes('top')) out.y++;
    if (box.error.includes('bottom')) out.y--;
  }
  return out;
}

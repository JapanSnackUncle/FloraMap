// Map settings in one place.

/**
 * Where the basemap tiles live. In `npm run dev` the dev server serves tiles/ at /tiles/.
 * For the live site set VITE_TILES_URL to the file on Cloudflare R2.
 */
export const TILES_URL: string = import.meta.env.VITE_TILES_URL ?? '/tiles/ibaraki.pmtiles';

/**
 * Label fonts (non-Japanese glyphs) and map icons for the Protomaps style.
 * Hosted by Protomaps for now; to self-host before launch (see plan.md).
 * Japanese text is drawn with the device's own fonts (localIdeographFontFamily), so no
 * large CJK font files are downloaded.
 */
export const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
export const SPRITE_URL = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';

export const JAPANESE_FONTS =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif';

/** The area covered by tiles/ibaraki.pmtiles (west, south, east, north). */
export const TILE_BOUNDS: [number, number, number, number] = [139.68, 35.73, 140.86, 36.96];

/** Ibaraki itself, for the opening view. */
export const IBARAKI_BOUNDS: [[number, number], [number, number]] = [
  [139.69, 35.74],
  [140.85, 36.95],
];

export const MAP_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

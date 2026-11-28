// Map settings in one place.

/**
 * Where the basemap tiles live. In `npm run dev` the dev server serves tiles/ at /tiles/.
 * The GitHub Pages test site has a copy beside the app. For the live site set VITE_TILES_URL
 * to the file on Cloudflare R2.
 *
 * BASE_URL is the folder the site is served from: "/" normally, "/FloraMap/" on GitHub Pages
 * (set by `vite build --base`). Every file the app loads from its own site starts with it.
 */
/** A file build-data wrote under public/ ("/photos/…"), as a URL on this site (BASE_URL ends in "/"). */
export const siteUrl = (path: string): string => `${import.meta.env.BASE_URL}${path.slice(1)}`;

export const TILES_URL: string =
  import.meta.env.VITE_TILES_URL ?? `${import.meta.env.BASE_URL}tiles/ibaraki.pmtiles`;

/**
 * Main railway lines, drawn at every zoom (the tiles have none below zoom 12). Made from the
 * tiles by scripts/build-rail.ts and committed.
 */
export const RAIL_URL = `${import.meta.env.BASE_URL}rail.geojson`;

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

/**
 * A map pin in CSS px: the photo circle (`size`) and the taper below it (`tipHalfW` each side,
 * `tipH` tall). Phones use smaller pins. App hands the one in use to the CSS as --pin-* (pins.ts
 * pinStyle), so the sizes live only here.
 */
export interface PinSize {
  size: number;
  tipHalfW: number;
  tipH: number;
}
export const PIN: PinSize = { size: 54, tipHalfW: 7, tipH: 11 };
export const PHONE_PIN: PinSize = { size: 44, tipHalfW: 6, tipH: 9 };
/** The taper tucks this far up under the circle. */
export const PIN_TIP_TUCK_PX = 3;
/** The selected pin is drawn this much larger, growing from its tip. */
export const PIN_SELECTED_SCALE = 1.3;

/**
 * Pin names (CLAUDE.md, "Place names"): the HTML label and the map's invisible collision copy
 * of it share these, so the copy's box is the label's box. Line height is in ems
 * (MapLibre's text-line-height; CSS line-height as a number).
 */
export const NAME_FONT_PX = 12;
export const NAME_LINE_HEIGHT = 1.2;
/** An English name longer than this many characters goes on two lines (labels.ts breakName). */
export const NAME_BREAK_CHARS = 16;

/**
 * Grouped pins (CLAUDE.md, "Grouped pins"): pins whose centres are closer than this many screen
 * pixels merge into one group pin. A bit under one pin width: pins may overlap slightly before
 * grouping, which keeps groups from forming too early between whole zoom levels (MapLibre only
 * regroups at whole levels). Phones keep the same share of their smaller pin.
 */
export const GROUP_RADIUS_PX = 45;
export const PHONE_GROUP_RADIUS_PX = Math.round((GROUP_RADIUS_PX * PHONE_PIN.size) / PIN.size);

/** The last zoom level with groups (MapLibre's clusterMaxZoom): from 17 every pin stands alone. */
export const GROUP_MAX_ZOOM = 16;

// ---------- phone layout (CLAUDE.md, "Phone layout")

/** Below this viewport width (CSS px) the list and place page sit in a bottom sheet. */
export const PHONE_MAX_WIDTH = 768;

/** The sheet at full height stops this far below the top of the map: under the chip row. */
export const SHEET_TOP_PX = 56;

/** The sheet's half height, as a share of the map's height. */
export const SHEET_HALF = 0.5;

/**
 * Opening a place on a phone pans the map when the pin is under the sheet or this close to an
 * edge of the map area above it.
 */
export const PAN_MARGIN_PX = 80;

export const MAP_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

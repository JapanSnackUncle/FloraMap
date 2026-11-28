// Where the basemap's fonts and icons sit under public/, as paths below the site's base folder.
// Kept apart from config.ts (which reads import.meta.env) so vite.config.ts can import it too:
// the build adds preload hints for these files to index.html (see preloadHints there).

/** MapLibre fills in {fontstack} (URL-encoded, e.g. "Noto%20Sans%20Medium") and {range}. */
export const GLYPHS_PATH = 'basemap/fonts/{fontstack}/{range}.pbf';
export const SPRITE_PATH = 'basemap/sprites/light';

/**
 * The font files the opening view needs (place names in Medium, water names in Italic; digits and
 * Latin letters are in range 0-255), so index.html can start them before the map asks. Matched to
 * the opening view: other views may need more (Noto Sans Regular for roads at higher zooms),
 * which then load as usual. If the network panel ever shows one of these preloaded but unused,
 * drop it from this list.
 */
export const PRELOAD_GLYPHS = ['Noto Sans Medium', 'Noto Sans Italic'].map((stack) =>
  GLYPHS_PATH.replace('{fontstack}', encodeURIComponent(stack)).replace('{range}', '0-255'),
);

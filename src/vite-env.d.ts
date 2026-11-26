/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basemap PMTiles URL for the live site (Cloudflare R2). Unset in dev. */
  readonly VITE_TILES_URL?: string;
  /** "true" turns on debug mode in a build (the test site's /debug/ copy only). */
  readonly VITE_DEBUG?: string;
}

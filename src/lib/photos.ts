// Photo shapes shared by the build (scripts/pin-photos.ts cuts the files) and the app (PlacePage
// shows them), so the two can't disagree. No Vite-only imports: scripts run under plain Node.

/** A place's header photo is a band this many times wider than tall (2 = 2:1). */
export const HEADER_ASPECT = 2;

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

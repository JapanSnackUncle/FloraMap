// tiles/ibaraki.pmtiles -> public/rail.geojson
//
//   node scripts/build-rail.ts
//
// Protomaps leaves railways out of its zoomed-out tiles (nothing below zoom 11), so at the
// prefecture-wide view the map would show no train lines. This copies the main railway lines
// out of the zoom-12 tiles into a small GeoJSON file the map draws at every zoom. Same
// OpenStreetMap data as the basemap; sidings, yards and crossovers (`service` tag) are left out.
//
// The output is committed (the build doesn't run this). Re-run it after downloading a new
// basemap.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles, type Source } from 'pmtiles';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TILES_FILE = join(ROOT, 'tiles', 'ibaraki.pmtiles');
export const OUT_FILE = join(ROOT, 'public', 'rail.geojson');

/** Zoom the lines are taken from: the lowest zoom whose tiles have the full rail network. */
const ZOOM = 12;
/** Simplification tolerance and output precision, in degrees (1e-5° ≈ 1 m). */
const TOLERANCE = 2e-5;
const DECIMALS = 5;

type Pt = [number, number];

/**
 * Clip a line to the square [0, size]. Tiles carry a margin of geometry from their
 * neighbours; without clipping, every tile edge would draw those bits twice.
 */
export function clipLine(line: Pt[], size: number): Pt[][] {
  const out: Pt[][] = [];
  let current: Pt[] = [];
  const inside = (p: Pt) => p[0] >= 0 && p[0] <= size && p[1] >= 0 && p[1] <= size;
  for (let i = 0; i + 1 < line.length; i++) {
    const seg = clipSegment(line[i]!, line[i + 1]!, size);
    if (!seg) {
      if (current.length > 1) out.push(current);
      current = [];
      continue;
    }
    const [a, b] = seg;
    const last = current[current.length - 1];
    if (!last || last[0] !== a[0] || last[1] !== a[1]) {
      if (current.length > 1) out.push(current);
      current = [a];
    }
    current.push(b);
    if (!inside(line[i + 1]!)) {
      out.push(current);
      current = [];
    }
  }
  if (current.length > 1) out.push(current);
  return out;
}

/** Liang–Barsky: the part of segment a→b inside [0, size]², or null. */
function clipSegment(a: Pt, b: Pt, size: number): [Pt, Pt] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, a[0]],
    [dx, size - a[0]],
    [-dy, a[1]],
    [dy, size - a[1]],
  ] as const) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

/**
 * Join lines that meet end to end (pieces of one railway split at tile edges), so the
 * dash pattern runs on smoothly. Points are compared after rounding to DECIMALS.
 */
export function mergeLines(lines: Pt[][]): Pt[][] {
  const key = (p: Pt) => `${p[0].toFixed(DECIMALS)},${p[1].toFixed(DECIMALS)}`;
  const pool = new Set(lines.map((l) => [...l]));
  const ends = new Map<string, Set<Pt[]>>();
  const addEnd = (k: string, l: Pt[]) => (ends.get(k) ?? ends.set(k, new Set()).get(k)!).add(l);
  const dropEnd = (k: string, l: Pt[]) => ends.get(k)?.delete(l);
  for (const l of pool) {
    addEnd(key(l[0]!), l);
    addEnd(key(l[l.length - 1]!), l);
  }
  const partner = (k: string, self: Pt[]) => [...(ends.get(k) ?? [])].find((l) => l !== self);
  const out: Pt[][] = [];
  for (const start of pool) {
    pool.delete(start);
    dropEnd(key(start[0]!), start);
    dropEnd(key(start[start.length - 1]!), start);
    const line = start;
    // Grow at the tail, then reverse and grow at the (old) head.
    for (let pass = 0; pass < 2; pass++) {
      for (;;) {
        const tail = key(line[line.length - 1]!);
        const next = partner(tail, line);
        if (!next) break;
        pool.delete(next);
        dropEnd(key(next[0]!), next);
        dropEnd(key(next[next.length - 1]!), next);
        const pts = key(next[0]!) === tail ? next : [...next].reverse();
        line.push(...pts.slice(1));
      }
      line.reverse();
    }
    out.push(line);
  }
  return out;
}

/** Douglas–Peucker: drop points closer than `tol` to the simplified line. */
export function simplify(line: Pt[], tol: number): Pt[] {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = line[i]!;
    const [bx, by] = line[j]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let worstD = tol * tol;
    for (let k = i + 1; k < j; k++) {
      const [px, py] = line[k]!;
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > worstD) {
        worstD = d;
        worst = k;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([i, worst], [worst, j]);
    }
  }
  return line.filter((_, k) => keep[k]);
}

function tileToLngLat(z: number, x: number, y: number, extent: number, p: Pt): Pt {
  const n = 2 ** z;
  const lng = ((x + p[0] / extent) / n) * 360 - 180;
  const merc = Math.PI * (1 - (2 * (y + p[1] / extent)) / n);
  return [lng, (Math.atan(Math.sinh(merc)) * 180) / Math.PI];
}

const lngToX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export async function buildRail(tilesFile = TILES_FILE): Promise<GeoJSON.FeatureCollection> {
  const bytes = readFileSync(tilesFile);
  const source: Source = {
    getKey: () => tilesFile,
    getBytes: async (offset, length) => ({
      data: bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length),
    }),
  };
  const archive = new PMTiles(source);
  const h = await archive.getHeader();
  if (h.maxZoom < ZOOM) throw new Error(`${tilesFile} stops at zoom ${h.maxZoom}; need ${ZOOM}`);

  const lines: Pt[][] = [];
  for (let x = lngToX(h.minLon, ZOOM); x <= lngToX(h.maxLon, ZOOM); x++) {
    for (let y = latToY(h.maxLat, ZOOM); y <= latToY(h.minLat, ZOOM); y++) {
      const tile = await archive.getZxy(ZOOM, x, y);
      if (!tile) continue;
      const roads = new VectorTile(new PbfReader(new Uint8Array(tile.data))).layers.roads;
      if (!roads) continue;
      for (let i = 0; i < roads.length; i++) {
        const f = roads.feature(i);
        if (f.properties.kind !== 'rail' || 'service' in f.properties || f.type !== 2) continue;
        for (const part of f.loadGeometry()) {
          const pts = part.map((p): Pt => [p.x, p.y]);
          for (const piece of clipLine(pts, f.extent)) {
            lines.push(piece.map((p) => tileToLngLat(ZOOM, x, y, f.extent, p)));
          }
        }
      }
    }
  }

  const round = (n: number) => Number(n.toFixed(DECIMALS));
  const features: GeoJSON.Feature[] = mergeLines(lines).map((line) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: simplify(line, TOLERANCE).map(([lng, lat]) => [round(lng), round(lat)]),
    },
  }));
  return { type: 'FeatureCollection', features };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fc = await buildRail();
  const json = JSON.stringify(fc);
  writeFileSync(OUT_FILE, json + '\n');
  console.log(
    `wrote ${OUT_FILE}: ${fc.features.length} lines, ${(json.length / 1024).toFixed(0)} KB`,
  );
}

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre decodes tiles in a background worker. Importing the worker file's URL makes Vite
// copy it into the build; MapLibre's own runtime lookup is invisible to the bundler.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import {
  GLYPHS_URL,
  IBARAKI_BOUNDS,
  JAPANESE_FONTS,
  MAP_ATTRIBUTION,
  SPRITE_URL,
  TILE_BOUNDS,
  TILES_URL,
} from '../config';
import type { Lang } from '../i18n';
import type { PlaceStatus } from '../lib/status';
import { drawPin, pinLook } from '../pins';

// MapLibre reads "pmtiles://..." URLs through this protocol handler. Register it once per page.
let protocolRegistered = false;
function registerPmtiles() {
  if (protocolRegistered) return;
  maplibregl.setWorkerUrl(workerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

/**
 * The view (#zoom/lat/lng) in the address bar when the page opened, if any. Read once: in dev,
 * React mounts the map twice, and removing the first map clears the hash.
 */
const OPENED_WITH_VIEW = parseView(window.location.hash);

function parseView(hash: string): { zoom: number; center: [number, number] } | null {
  const [z, lat, lng] = hash.replace(/^#/, '').split('/').map(Number);
  if ([z, lat, lng].some((n) => n === undefined || Number.isNaN(n))) return null;
  return { zoom: z!, center: [lng!, lat!] };
}

/** Let the map pan and zoom out past the tiles (grey beyond them) so all of Ibaraki fits any screen. */
const PAN_MARGIN = 1.5;
const [w, s, e, n] = TILE_BOUNDS;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [w - PAN_MARGIN, s - PAN_MARGIN],
  [e + PAN_MARGIN, n + PAN_MARGIN],
];

interface Props {
  statuses: PlaceStatus[];
  lang: Lang;
  /** Fly to this place; `n` changes on every request so the same place can be chosen twice. */
  focus?: { id: string; n: number } | null;
}

export default function MapView({ statuses, lang, focus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const markers = useRef(new Map<string, maplibregl.Marker>());

  useEffect(() => {
    if (!container.current) return;
    registerPmtiles();
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        glyphs: GLYPHS_URL,
        sprite: SPRITE_URL,
        sources: {
          protomaps: {
            type: 'vector',
            url: `pmtiles://${new URL(TILES_URL, window.location.href).href}`,
            attribution: MAP_ATTRIBUTION,
          },
        },
        layers: layers('protomaps', namedFlavor('light'), { lang: 'ja' }),
      },
      // Open on all of Ibaraki, unless the address bar already holds a view.
      ...(OPENED_WITH_VIEW ?? { bounds: IBARAKI_BOUNDS, fitBoundsOptions: { padding: 16 } }),
      maxBounds: MAX_BOUNDS,
      minZoom: 6,
      maxZoom: 18,
      localIdeographFontFamily: JAPANESE_FONTS,
      attributionControl: { compact: true },
      // Keep the view in the address bar (#zoom/lat/lng) so a view can be bookmarked or shared.
      hash: true,
      // North always up: no rotating or tilting the map.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      setLoaded(false);
      map.remove();
    };
  }, []);

  // One ring pin per place (HTML markers), redrawn whenever the date, data or language changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const seen = new Set<string>();
    for (const ps of statuses) {
      const look = pinLook(ps, lang);
      if (!look) continue;
      seen.add(ps.place.id);
      let marker = markers.current.get(ps.place.id);
      if (!marker) {
        marker = new maplibregl.Marker({ element: document.createElement('div') })
          .setLngLat([ps.place.lng, ps.place.lat])
          .addTo(map);
        markers.current.set(ps.place.id, marker);
      }
      marker.setLngLat([ps.place.lng, ps.place.lat]);
      drawPin(marker.getElement(), look, (lang === 'en' && ps.place.name_en) || ps.place.name_ja);
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [loaded, statuses, lang]);

  // The map is recreated on remount (dev); drop the old markers with it.
  useEffect(() => {
    const all = markers.current;
    return () => {
      for (const m of all.values()) m.remove();
      all.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const p = focus && statuses.find((x) => x.place.id === focus.id)?.place;
    if (!map || !p) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 13) });
  }, [focus, statuses]);

  return <div ref={container} className="map" />;
}

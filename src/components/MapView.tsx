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
import type { FeatureCollection, Point } from 'geojson';
import type { PublicPlace } from '../lib/schema';

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

const PLACES_SOURCE = 'places';
const PLACES_LAYER = 'places-dots';

function placesGeoJson(places: PublicPlace[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name_ja: p.name_ja,
        name_en: p.name_en ?? '',
        municipality: p.municipality,
        lat: p.lat,
        lng: p.lng,
      },
    })),
  };
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export default function MapView({ places }: { places: PublicPlace[] | null }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      setLoaded(false);
      map.remove();
    };
  }, []);

  // Plain dots, one per place, with the name on hover (step 5.2; ring pins replace these in 5.4).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !places) return;
    const data = placesGeoJson(places);
    const existing = map.getSource<maplibregl.GeoJSONSource>(PLACES_SOURCE);
    if (existing) {
      existing.setData(data);
      return;
    }
    map.addSource(PLACES_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: PLACES_LAYER,
      type: 'circle',
      source: PLACES_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 5, 14, 8],
        'circle-color': '#B0245C',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    const show = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, string | number>;
      map.getCanvas().style.cursor = 'pointer';
      popup
        .setLngLat((f.geometry as Point).coordinates as [number, number])
        .setHTML(
          `<strong>${escapeHtml(String(p.name_ja))}</strong>` +
            (p.name_en ? `<br>${escapeHtml(String(p.name_en))}` : '') +
            `<br><small>${escapeHtml(String(p.municipality))} · ${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</small>`,
        )
        .addTo(map);
    };
    const hide = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    };
    map.on('mousemove', PLACES_LAYER, show);
    map.on('click', PLACES_LAYER, show); // touch screens have no hover
    map.on('mouseleave', PLACES_LAYER, hide);
  }, [loaded, places]);

  return <div ref={container} className="map" />;
}

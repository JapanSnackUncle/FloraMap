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
  RAIL_URL,
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

/**
 * Protomaps' light style, with railway lines made easy to see (people orient by stations).
 * Main lines come from public/rail.geojson (scripts/build-rail.ts), because the tiles have no
 * railways below zoom 12; they get the Japanese paper-map look: a dark line with a white dash
 * inside. Sidings, yards and crossovers (`service` tag) stay faint, drawn from the tiles.
 */
function basemapLayers(): maplibregl.LayerSpecification[] {
  const base = layers('protomaps', namedFlavor('light'), { lang: 'ja' });
  const i = base.findIndex((l) => l.id === 'roads_rail');
  const original = base[i] as maplibregl.LineLayerSpecification;
  const width = (scale: number): maplibregl.ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    6,
    0.8 * scale,
    8,
    1.2 * scale,
    12,
    2.5 * scale,
    15,
    4 * scale,
    18,
    7 * scale,
  ];
  const rail: maplibregl.LayerSpecification[] = [
    {
      ...original,
      id: 'roads_rail_service',
      filter: ['all', ['==', ['get', 'kind'], 'rail'], ['has', 'service']],
    },
    {
      id: 'rail_main',
      type: 'line',
      source: 'rail',
      paint: { 'line-color': '#7f898d', 'line-width': width(1) },
    },
    {
      id: 'rail_main_dash',
      type: 'line',
      source: 'rail',
      paint: { 'line-color': '#ffffff', 'line-width': width(0.5), 'line-dasharray': [3, 3] },
    },
  ];
  return [...base.slice(0, i), ...rail, ...base.slice(i + 1)];
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
  /**
   * Fly here; `n` changes on every request so the same point can be chosen twice. Only a new
   * request moves the map: filter or date changes never do.
   */
  focus?: { lng: number; lat: number; n: number } | null;
  /** Called with the visible area [west, south, east, north] once the map stops moving. */
  onViewChange?: (bounds: ViewBounds) => void;
}

export type ViewBounds = [number, number, number, number];

export default function MapView({ statuses, lang, focus, onViewChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  // Latest callback in a ref, so the map's event listener never needs re-attaching.
  const onView = useRef(onViewChange);
  useEffect(() => {
    onView.current = onViewChange;
  }, [onViewChange]);
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
          rail: { type: 'geojson', data: RAIL_URL },
        },
        layers: basemapLayers(),
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
    const reportView = () => {
      const b = map.getBounds();
      onView.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on('load', () => {
      setLoaded(true);
      reportView();
    });
    // "moveend" fires once a pan, zoom or fly-to finishes, not on every frame.
    map.on('moveend', reportView);
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
        // Anchored at the bottom: the taper's tip sits on the point.
        marker = new maplibregl.Marker({ element: document.createElement('div'), anchor: 'bottom' })
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
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 13) });
  }, [focus]);

  return <div ref={container} className="map" />;
}

// The basemap: Protomaps' light style from our PMTiles file, plus railway lines. Shared by the
// map (components/MapView.tsx) and the photo tool's Pins tab, so both draw the same map.

import * as maplibregl from 'maplibre-gl';
// MapLibre decodes tiles in a background worker. Importing the worker file's URL makes Vite
// copy it into the build; MapLibre's own runtime lookup is invisible to the bundler.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { GLYPHS_URL, MAP_ATTRIBUTION, RAIL_URL, SPRITE_URL, TILES_URL } from './config';
import type { Lang } from './i18n';

// MapLibre reads "pmtiles://..." URLs through this protocol handler. Register it once per page.
let protocolRegistered = false;
export function registerPmtiles() {
  if (protocolRegistered) return;
  maplibregl.setWorkerUrl(workerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

/**
 * Protomaps' light style, with railway lines made easy to see (people orient by stations).
 * Main lines come from public/rail.geojson (scripts/build-rail.ts), because the tiles have no
 * railways below zoom 12; they get the Japanese paper-map look: a dark line with a white dash
 * inside. Sidings, yards and crossovers (`service` tag) stay faint, drawn from the tiles.
 */
export function basemapLayers(lang: Lang): maplibregl.LayerSpecification[] {
  // `lang` picks the label language: OSM's name:en where it exists (with the local name on a
  // second line), else the Japanese name.
  const base = layers('protomaps', namedFlavor('light'), { lang });
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

/** The whole map style: our tiles, the railway lines and the layers above. */
export function basemapStyle(lang: Lang): maplibregl.StyleSpecification {
  return {
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
    layers: basemapLayers(lang),
  };
}

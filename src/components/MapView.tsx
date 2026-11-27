import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre decodes tiles in a background worker. Importing the worker file's URL makes Vite
// copy it into the build; MapLibre's own runtime lookup is invisible to the bundler.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import {
  GLYPHS_URL,
  GROUP_MAX_ZOOM,
  GROUP_RADIUS_PX,
  IBARAKI_BOUNDS,
  JAPANESE_FONTS,
  MAP_ATTRIBUTION,
  PAN_MARGIN_PX,
  PHONE_GROUP_RADIUS_PX,
  PHONE_PIN,
  PIN,
  PIN_SELECTED_SCALE,
  PIN_TIP_TUCK_PX,
  RAIL_URL,
  SHEET_HALF,
  SPRITE_URL,
  TILE_BOUNDS,
  TILES_URL,
} from '../config';
import type { Feature, Point } from 'geojson';
import { t, type Lang } from '../i18n';
import { compareFeatures, type PlaceStatus } from '../lib/status';
import { drawPin, groupLook, pinLook, type PinLook } from '../pins';

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
function basemapLayers(lang: Lang): maplibregl.LayerSpecification[] {
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

/** Let the map pan and zoom out past the tiles (grey beyond them) so all of Ibaraki fits any screen. */
const BOUNDS_MARGIN_DEG = 1.5;
const [w, s, e, n] = TILE_BOUNDS;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [w - BOUNDS_MARGIN_DEG, s - BOUNDS_MARGIN_DEG],
  [e + BOUNDS_MARGIN_DEG, n + BOUNDS_MARGIN_DEG],
];

/**
 * Phones: how much of the map is covered at the top (the chip row) and bottom (the sheet at
 * rest), in CSS px. "Centre" then means the middle of the part between them.
 */
export interface MapInsets {
  top: number;
  bottom: number;
}

/** A map pin's outline in CSS px: the circle plus the part of its taper below it. */
function pinBox(phone: boolean): [number, number] {
  const pin = phone ? PHONE_PIN : PIN;
  return [pin.size, pin.size + pin.tipH - PIN_TIP_TUCK_PX];
}

const groupRadius = (phone: boolean) => (phone ? PHONE_GROUP_RADIUS_PX : GROUP_RADIUS_PX);

/** easeTo/flyTo `offset` that puts the target in the middle of the uncovered area. */
const centreOffset = (ins: MapInsets | null | undefined): [number, number] =>
  ins ? [0, (ins.top - ins.bottom) / 2] : [0, 0];

/**
 * Phones (CLAUDE.md, "Phone layout"): after opening a place, the sheet is at half height. If
 * the pin is under it or within PAN_MARGIN_PX of an edge of the part above it, pan (no zoom
 * change) to put the pin in the middle of that part.
 */
function revealPin(map: maplibregl.Map, lngLat: [number, number], top: number, phone: boolean) {
  // The pin's middle sits half its height above its point (the tip).
  const middle = pinBox(phone)[1] / 2;
  const W = map.getContainer().clientWidth;
  const H = map.getContainer().clientHeight;
  const bottom = Math.round(H * SHEET_HALF);
  const p = map.project(lngLat);
  const y = p.y - middle;
  const m = PAN_MARGIN_PX;
  const clear = p.x >= m && p.x <= W - m && y >= top + m && y <= H - bottom - m;
  if (clear) return;
  map.panBy([p.x - W / 2, y - (top + (H - top - bottom) / 2)]);
}

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
  /** The place whose page is open: its pin is drawn larger, on top, with its name. */
  selectedId?: string | null;
  onPinClick?: (placeId: string) => void;
  /** A click on the map that hit no pin. */
  onEmptyClick?: () => void;
  /** Read once: where to open when the address has a place but no map view (shared link). */
  initialCenter?: { lng: number; lat: number } | null;
  /** Phones only: the parts of the map covered by the chips and the sheet. */
  insets?: MapInsets | null;
  /** Phone layout: smaller pins and a matching group radius. */
  phone?: boolean;
}

/** A map click this soon after a pin click is that same click, not a click on empty map. */
const PIN_CLICK_MS = 300;

/** Zoom for a shared place link without a map view: the town around the place. */
const PLACE_LINK_ZOOM = 12;

/** MapLibre's own #zoom/lat/lng format (same rounding), so writing it back doesn't move the map. */
function viewHash(map: maplibregl.Map): string {
  const zoom = map.getZoom();
  const precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10);
  const m = 10 ** precision;
  const c = map.getCenter();
  return `#${Math.round(zoom * 100) / 100}/${Math.round(c.lat * m) / m}/${Math.round(c.lng * m) / m}`;
}

export type ViewBounds = [number, number, number, number];

// ---------- place names (CLAUDE.md, "Place names")

const NAMES_SOURCE = 'pin-names';

/**
 * MapLibre can't see the HTML pins, so each name feature carries an invisible image the size of
 * its pin (pinBox, scaled for the selected pin) above its point: names then avoid pins. One pair
 * for desktop pins, one for the smaller phone pins.
 */
const holeImage = (selected: boolean, phone: boolean): string =>
  `hole-${phone ? 'phone-' : ''}pin${selected ? '-sel' : ''}`;

function holeSize(selected: boolean, phone: boolean): [number, number] {
  const k = selected ? PIN_SELECTED_SCALE : 1;
  const [w, h] = pinBox(phone);
  return [Math.round(w * k), Math.round(h * k)];
}

/** The map's name layers: pin outlines and names. Neither is visible (see addNameLayers). */
const HOLES_LAYER = 'pin-holes';
const TEXT_LAYER = 'pin-name-text';

/**
 * Every name on the map is the pin's own HTML label (pins.ts, styles.css .pin-label): one
 * renderer, so a name looks and sits the same whether it's showing on its own, on hover or for
 * the selected pin. MapLibre only decides which names fit, using these two invisible layers on
 * one source, placed top-down: every pin's outline is always placed and blocks names (holes);
 * then each name is dropped if it would collide, better rank first (text). The text layer
 * matches the HTML label (12 px, one line) so its collision box is the label's box.
 */
function addNameLayers(map: maplibregl.Map) {
  for (const phone of [false, true]) {
    for (const selected of [false, true]) {
      const [width, height] = holeSize(selected, phone);
      const data = new Uint8Array(width * height * 4);
      map.addImage(holeImage(selected, phone), { width, height, data });
    }
  }
  map.addSource(NAMES_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: TEXT_LAYER,
    type: 'symbol',
    source: NAMES_SOURCE,
    layout: {
      'symbol-sort-key': ['get', 'sort'],
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.3],
      'text-max-width': 100, // never wrap: the HTML label is one line too
      'text-padding': 2,
    },
    paint: { 'text-opacity': 0 },
  });
  map.addLayer({
    id: HOLES_LAYER,
    type: 'symbol',
    source: NAMES_SOURCE,
    layout: {
      'icon-image': ['get', 'hole'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
      // Ends exactly at the point, so it never blocks its own name just below it.
      'icon-padding': 0,
    },
  });
}

/** IDs of the places whose names MapLibre placed (not dropped in a collision) right now. */
function placedNames(map: maplibregl.Map): Set<string> {
  return new Set(
    map.queryRenderedFeatures({ layers: [TEXT_LAYER] }).map((f) => String(f.properties.pid)),
  );
}

// ---------- grouped pins (CLAUDE.md, "Grouped pins")

/** The places, clustered by MapLibre. Its only layer is invisible: the pins are HTML. */
const CLUSTER_SOURCE = 'pin-clusters';

function addClusterSource(map: maplibregl.Map, radius: number) {
  map.addSource(CLUSTER_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    // MapLibre's tiles are 512 px and clusterRadius is in 1/512ths of a tile: screen pixels.
    clusterRadius: radius,
    clusterMaxZoom: GROUP_MAX_ZOOM,
    // Per group: its best place (lowest rank index) and whether any place has a festival on.
    clusterProperties: {
      best: ['min', ['get', 'rank']],
      fest: ['max', ['get', 'fest']],
    },
  });
  // A source only loads while a layer uses it.
  map.addLayer({
    id: CLUSTER_SOURCE,
    type: 'circle',
    source: CLUSTER_SOURCE,
    paint: { 'circle-radius': 0, 'circle-opacity': 0 },
  });
}

interface ClusterGroup {
  /** The best-ranked place: its pin stands for the group. */
  leader: string;
  count: number;
  festival: boolean;
  /** Where MapLibre puts the group (the middle of its places). */
  lng: number;
  lat: number;
  clusterId: number;
}

interface ClusterView {
  singles: string[];
  groups: ClusterGroup[];
}

const viewKey = (v: ClusterView) =>
  [...v.singles].sort().join(',') +
  '|' +
  v.groups
    .map((g) => `${g.leader}:${g.count}:${g.festival}:${g.lng}:${g.lat}`)
    .sort()
    .join(',');

/**
 * Single places and groups at the current zoom, from the loaded part of the clustered source.
 * `ids` maps a place's rank index (a group's `best`) back to its ID. Null while the source is
 * still processing new data.
 */
function readClusters(map: maplibregl.Map, ids: string[]): ClusterView | null {
  if (!map.isSourceLoaded(CLUSTER_SOURCE)) return null;
  const singles = new Set<string>();
  const groups = new Map<number, ClusterGroup>();
  for (const f of map.querySourceFeatures(CLUSTER_SOURCE)) {
    const p = f.properties;
    if (!p.cluster) {
      singles.add(String(p.pid));
      continue;
    }
    const clusterId = Number(p.cluster_id);
    const leader = ids[Number(p.best)];
    if (!leader || groups.has(clusterId)) continue;
    const [lng, lat] = (f.geometry as Point).coordinates as [number, number];
    groups.set(clusterId, {
      leader,
      count: Number(p.point_count),
      festival: Number(p.fest) > 0,
      lng,
      lat,
      clusterId,
    });
  }
  return { singles: [...singles], groups: [...groups.values()] };
}

export default function MapView({
  statuses,
  lang,
  focus,
  onViewChange,
  selectedId,
  onPinClick,
  onEmptyClick,
  initialCenter,
  insets,
  phone = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  // Latest callbacks in refs, so the map's event listeners never need re-attaching.
  const onView = useRef(onViewChange);
  const onPin = useRef(onPinClick);
  const onEmpty = useRef(onEmptyClick);
  useEffect(() => {
    onView.current = onViewChange;
    onPin.current = onPinClick;
    onEmpty.current = onEmptyClick;
  }, [onViewChange, onPinClick, onEmptyClick]);
  const startCenter = useRef(initialCenter);
  const phoneRef = useRef(phone);
  const langRef = useRef(lang);
  const insetsRef = useRef(insets);
  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);
  const lastPinClick = useRef(-Infinity);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const markers = useRef(new Map<string, maplibregl.Marker>());
  // True from replacing the names data until the map is idle again (see the name sync below).
  const namesSettling = useRef(false);
  const namesSelected = useRef<string | null | undefined>(null);
  const heldPin = useRef<{ id: string; view: ClusterView } | null>(null);

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
        layers: basemapLayers(langRef.current),
      },
      // Open on all of Ibaraki, unless the address bar already holds a view.
      ...(OPENED_WITH_VIEW ??
        (startCenter.current
          ? {
              center: [startCenter.current.lng, startCenter.current.lat] as [number, number],
              zoom: PLACE_LINK_ZOOM,
            }
          : {
              bounds: IBARAKI_BOUNDS,
              // Phones: all of Ibaraki between the chips and the sheet at peek.
              fitBoundsOptions: {
                padding: insetsRef.current
                  ? {
                      top: insetsRef.current.top + 8,
                      bottom: insetsRef.current.bottom + 8,
                      left: 16,
                      right: 16,
                    }
                  : 16,
              },
            })),
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
    // Phones: a place link opens with the sheet at half, so its place goes in the middle of
    // the part above the sheet, not the middle of the screen.
    if (!OPENED_WITH_VIEW && startCenter.current && insetsRef.current) {
      const half = Math.round(container.current.clientHeight * SHEET_HALF);
      map.panBy([0, (half - insetsRef.current.top) / 2], { animate: false });
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const reportView = () => {
      const b = map.getBounds();
      onView.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on('load', () => {
      addClusterSource(map, groupRadius(phoneRef.current));
      addNameLayers(map);
      setLoaded(true);
      reportView();
    });
    // "moveend" fires once a pan, zoom or fly-to finishes, not on every frame.
    map.on('moveend', reportView);
    map.on('click', () => {
      // MapLibre reports the same click on the map right after the pin's own listener ran
      // (by then the redraw may have removed the clicked element, so its target can't tell).
      if (performance.now() - lastPinClick.current > PIN_CLICK_MS) onEmpty.current?.();
    });
    // Browser Back/Forward restores the hash saved with that history entry, and MapLibre would
    // jump to it. Write the current view over it first: history steps never move the map.
    const keepView = () => {
      const url = new URL(window.location.href);
      url.hash = viewHash(map);
      window.history.replaceState(window.history.state, '', url);
    };
    window.addEventListener('popstate', keepView);
    mapRef.current = map;
    return () => {
      window.removeEventListener('popstate', keepView);
      mapRef.current = null;
      setLoaded(false);
      map.remove();
    };
  }, []);

  // Language switch: swap the basemap's label text in place (setStyle would drop our own
  // sources and layers).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || langRef.current === lang) return;
    langRef.current = lang;
    for (const l of basemapLayers(lang)) {
      const field = l.type === 'symbol' ? l.layout?.['text-field'] : undefined;
      if (field !== undefined && map.getLayer(l.id))
        map.setLayoutProperty(l.id, 'text-field', field);
    }
  }, [lang, loaded]);

  // Every place with a pin, best-ranked first (Pin choice order): the order for grouping
  // (best place leads its group) and for names (best place keeps its name in a collision).
  const ranked = useMemo(
    () =>
      statuses
        .map((ps) => ({ ps, look: pinLook(ps, lang) }))
        .filter((x): x is { ps: PlaceStatus; look: PinLook } => x.look !== null)
        .sort((a, b) => compareFeatures(a.ps.pin!, b.ps.pin!)),
    [statuses, lang],
  );
  // Grouping is MapLibre's own point clustering (Supercluster) on CLUSTER_SOURCE. It builds
  // groups from the most zoomed-in level outwards, so zooming out only merges whole groups:
  // no place moves from one group to another, and no long chains form. The selected place
  // never joins a group (CLAUDE.md): it's left out of the clustered points.
  const clusterIds = useMemo(
    () => ranked.map((x) => x.ps.place.id).filter((id) => id !== selectedId),
    [ranked, selectedId],
  );
  // The IDs behind the source's current data: a group names its best place by its index here.
  const clusterIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const byId = new Map(ranked.map((x) => [x.ps.place.id, x.ps]));
    clusterIdsRef.current = clusterIds;
    (map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: clusterIds.map((id, i) => {
        const ps = byId.get(id)!;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [ps.place.lng, ps.place.lat] },
          properties: { pid: id, rank: i, fest: ps.festivals.length > 0 ? 1 : 0 },
        };
      }),
    });
  }, [loaded, ranked, clusterIds]);

  // Crossing the phone breakpoint (rotating a tablet, resizing a window): regroup with the
  // radius that matches the new pin size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || phoneRef.current === phone) return;
    phoneRef.current = phone;
    // `cluster` must be passed again: MapLibre turns clustering off when it's left out.
    void (map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource).setClusterOptions({
      cluster: true,
      clusterRadius: groupRadius(phone),
    });
  }, [loaded, phone]);

  // What the clustering shows at the current zoom, read back after each render; only replaced
  // when it changes, so zooming within one grouping doesn't redraw the pins.
  const [view, setView] = useState<ClusterView>({ singles: [], groups: [] });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = readClusters(map, clusterIdsRef.current);
      if (next) setView((prev) => (viewKey(prev) === viewKey(next) ? prev : next));
    };
    const onRender = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    map.on('render', onRender);
    map.on('sourcedata', onRender);
    onRender();
    return () => {
      map.off('render', onRender);
      map.off('sourcedata', onRender);
      cancelAnimationFrame(frame);
    };
  }, [loaded]);

  // Tapping a group: centre on it and zoom in one level past where MapLibre splits it.
  const zoomIntoGroup = (leader: string) => {
    const map = mapRef.current;
    const g = viewRef.current.groups.find((x) => x.leader === leader);
    if (!map || !g) return;
    void (map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource)
      .getClusterExpansionZoom(g.clusterId)
      .then((zoom) =>
        map.easeTo({
          center: [g.lng, g.lat],
          zoom: zoom + 1,
          offset: centreOffset(insetsRef.current),
        }),
      );
  };
  const zoomInto = useRef(zoomIntoGroup);
  useEffect(() => {
    zoomInto.current = zoomIntoGroup;
  });

  // One HTML ring pin per place. A group shows only its best place's pin, drawn as a group at
  // the group's position; the other members are hidden. Each shown pin's name goes into the
  // invisible name layers, which decide whose name fits.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const name = (ps: PlaceStatus) => (lang === 'en' && ps.place.name_en) || ps.place.name_ja;
    const groupOf = new Map(view.groups.map((g) => [g.leader, g]));
    const shown = new Set([...view.singles, ...groupOf.keys()]);
    if (selectedId) shown.add(selectedId);
    // A just-deselected place isn't in the grouping yet (it's redone a frame later): keep its
    // pin until the new grouping arrives, so it doesn't blink.
    const was = namesSelected.current;
    if (was && was !== selectedId) heldPin.current = { id: was, view };
    else if (heldPin.current && heldPin.current.view !== view) heldPin.current = null;
    if (heldPin.current) shown.add(heldPin.current.id);
    const labels: Feature<Point>[] = [];
    const seen = new Set<string>();
    ranked.forEach(({ ps, look }, i) => {
      const id = ps.place.id;
      seen.add(id);
      let marker = markers.current.get(id);
      if (!marker) {
        // Anchored at the bottom: the taper's tip sits on the point.
        const el = document.createElement('div');
        el.addEventListener('click', () => {
          lastPinClick.current = performance.now();
          if (el.classList.contains('group')) zoomInto.current(id);
          else onPin.current?.(id);
        });
        // End of a name's fade-out (name sync below); cancelled when the pin is hidden.
        const faded = () => {
          if (el.classList.contains('name-fading'))
            el.classList.remove('name-fading', 'name-shown');
        };
        el.addEventListener('animationend', faded);
        el.addEventListener('animationcancel', faded);
        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([ps.place.lng, ps.place.lat])
          .addTo(map);
        markers.current.set(id, marker);
      }
      const el = marker.getElement();
      const selected = id === selectedId;
      // Just deselected: its name was showing (as the selected pin's), so it stays until the
      // names settle and the map says whether it fits (name sync below).
      if (el.classList.contains('selected') && !selected) el.classList.add('name-shown');
      if (selected) el.classList.remove('name-fading');
      el.classList.toggle('selected', selected);
      // Not shown: a group member other than its best place, or outside the loaded area.
      el.style.display = shown.has(id) ? '' : 'none';
      if (!shown.has(id)) return;
      const g = selected ? undefined : groupOf.get(id);
      const at: [number, number] = g ? [g.lng, g.lat] : [ps.place.lng, ps.place.lat];
      marker.setLngLat(at);
      if (g) {
        const label = t('groupMore', lang)
          .replace('{name}', name(ps))
          .replace('{n}', String(g.count - 1));
        drawPin(el, groupLook(look, g.festival, label), label, g.count);
      } else {
        drawPin(el, look, name(ps));
      }
      labels.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: at },
        properties: {
          pid: id,
          // Group pins have no name below them, but still keep other names off their pin.
          name: g ? '' : name(ps),
          hole: holeImage(selected, phone),
          // Lower keys are placed first and win collisions: the selected place, then by rank.
          sort: selected ? -1 : i,
        },
      });
    });
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    // Only on a selection change: while zooming, names keep following the map.
    if (selectedId !== namesSelected.current) namesSettling.current = true;
    namesSelected.current = selectedId;
    (map.getSource(NAMES_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: labels,
    });
  }, [loaded, ranked, view, lang, selectedId, phone]);

  // After each placement, show the names MapLibre placed (class name-shown) and hide the rest.
  // Hover and the selected pin show a name regardless (styles.css). Checked at most once per
  // frame, on every render, so names follow zooming and panning.
  // Replacing the names data (e.g. on deselect) makes MapLibre place every name again, and until
  // the map is idle it reports wrong placements (names missing, or fitting for a moment). So
  // while that settles every name stays as it is; once idle, names follow the map again.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    // A name hidden right after a hold fades out (.name-fading, styles.css) instead of vanishing;
    // the pin's animationend/animationcancel listener then hides it.
    let frame = 0;
    let fadeHidden = false;
    const sync = () => {
      frame = 0;
      if (namesSettling.current) return;
      const fade = fadeHidden;
      fadeHidden = false;
      const placed = placedNames(map);
      for (const [id, marker] of markers.current) {
        const el = marker.getElement();
        if (placed.has(id)) {
          el.classList.add('name-shown');
          el.classList.remove('name-fading');
        } else if (el.classList.contains('name-fading')) {
          // Fading: the animation's end hides it.
        } else if (fade && el.classList.contains('name-shown') && el.style.display !== 'none') {
          el.classList.add('name-fading');
        } else {
          el.classList.remove('name-shown');
        }
      }
    };
    const onRender = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    const onIdle = () => {
      if (!namesSettling.current) return;
      namesSettling.current = false;
      fadeHidden = true;
      onRender();
    };
    map.on('render', onRender);
    map.on('idle', onIdle);
    onRender();
    return () => {
      map.off('render', onRender);
      map.off('idle', onIdle);
      cancelAnimationFrame(frame);
    };
  }, [loaded]);

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
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(map.getZoom(), 13),
      offset: centreOffset(insetsRef.current),
    });
  }, [focus]);

  // Phones: opening a place (or switching to another) may pan the map so its pin isn't hidden
  // by the sheet. Desktop never moves the map on open (CLAUDE.md).
  const prevSelected = useRef(selectedId);
  useEffect(() => {
    const was = prevSelected.current;
    prevSelected.current = selectedId;
    const map = mapRef.current;
    const ins = insetsRef.current;
    if (!map || !ins || !selectedId || selectedId === was) return;
    const ps = statuses.find((x) => x.place.id === selectedId);
    if (ps) revealPin(map, [ps.place.lng, ps.place.lat], ins.top, phone);
  }, [selectedId, statuses, phone]);

  return <div ref={container} className="map" />;
}

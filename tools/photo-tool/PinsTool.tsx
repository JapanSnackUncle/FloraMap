// The photo tool's Pins tab: pin colours and styles side by side, today's look against a
// candidate, on two copies of the real map that move together. For choosing a new look before
// changing the app (the current one was picked here on 2026-11-28); it saves nothing. Pins are drawn by the app's own drawPin and
// pin.css, so only the colours, photo treatment, ring width and glow below are the candidate's.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { basemapStyle, registerPmtiles } from '../../src/basemap.ts';
import { FESTIVAL_COLOR, PHONE_PIN, PIN, PIN_RING_PX, type PinSize } from '../../src/config.ts';
import { RING_COLORS } from '../../src/lib/status.ts';
import { drawPin, pinStyle, type PinLook } from '../../src/pins.ts';
import { placeholderPhoto } from '../../src/placeholders.ts';
import { PINS_HASH } from './shared.ts';

/** One pin look: everything this tab lets a candidate change. */
interface Look {
  /** 咲き始め ring (flowers). */
  starting: string;
  /** 見頃過ぎ ring (leaves). */
  leafPast: string;
  lit: string;
  litGlow: boolean;
  festival: string;
  /** まもなく (and an illumination before it starts): greyed photo, or the photo in colour. */
  soon: 'grey' | 'colour';
  ringPx: number;
}

/** The app's look today (pins.ts, pin.css, config.ts). */
const CURRENT: Look = {
  starting: RING_COLORS.bloom[1],
  leafPast: RING_COLORS.foliage[3],
  lit: RING_COLORS.lit,
  litGlow: true,
  festival: FESTIVAL_COLOR,
  soon: 'colour',
  ringPx: PIN_RING_PX,
};

/** Colours from before 2026-11-28, to compare against. */
const EARLIER = { starting: '#E58FAD', leafPast: '#8C6A4F', festival: '#F97316' };

const STARTING_PRESETS = [
  { name: 'Today', color: RING_COLORS.bloom[1] },
  { name: 'Earlier pale pink', color: EARLIER.starting },
  { name: 'Bud green', color: '#4A9D5B' },
];

/** Map views to judge the pins against: the parts of the basemap a pin's ring has to stand out on. */
const BACKDROPS: { name: string; center: [number, number]; zoom: number }[] = [
  { name: 'Wide (towns, fields)', center: [140.3, 36.35], zoom: 9.5 },
  { name: 'Park and town (Mito)', center: [140.465, 36.372], zoom: 14 },
  { name: 'Lake (Kasumigaura)', center: [140.38, 36.05], zoom: 11 },
  { name: 'Mountains (Tsukuba)', center: [140.1, 36.22], zoom: 12 },
  { name: 'Coast (Hitachinaka)', center: [140.6, 36.4], zoom: 12.5 },
];

/** Colour-vision previews (Machado et al. 2009, full severity), applied to the whole pane. */
const VISION: { id: string; name: string; matrix?: string }[] = [
  { id: 'normal', name: 'Normal vision' },
  {
    id: 'deut',
    name: 'Deuteranopia (red-green, most common)',
    matrix: '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
  },
  {
    id: 'prot',
    name: 'Protanopia (red-green)',
    matrix: '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
  },
  {
    id: 'trit',
    name: 'Tritanopia (blue-yellow, rare)',
    matrix: '1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
  },
  {
    id: 'grey',
    name: 'Greyscale (lightness only)',
    matrix:
      '0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0',
  },
];

type Spec =
  | { type: 'planting'; kind: 'bloom' | 'foliage'; level: 0 | 1 | 2 | 3 | 4; pct?: number }
  | { type: 'illumination'; state: 'soon' | 'lit' | 'off' };

interface Cell {
  label: string;
  spec: Spec;
  festival?: boolean;
}

/** The board: one row per palette, each stage once, spread down the map. */
const ROWS: { title: string; cells: Cell[] }[] = [
  {
    title: 'Flowers',
    cells: [
      { label: 'まもなく', spec: { type: 'planting', kind: 'bloom', level: 0 } },
      { label: '咲き始め 2分', spec: { type: 'planting', kind: 'bloom', level: 1, pct: 20 } },
      { label: '5分', spec: { type: 'planting', kind: 'bloom', level: 1, pct: 50 } },
      { label: '見頃', spec: { type: 'planting', kind: 'bloom', level: 2 } },
      { label: '見頃過ぎ', spec: { type: 'planting', kind: 'bloom', level: 3 } },
      { label: 'シーズン外', spec: { type: 'planting', kind: 'bloom', level: 4 } },
    ],
  },
  {
    title: 'Leaves',
    cells: [
      { label: '青葉', spec: { type: 'planting', kind: 'foliage', level: 0 } },
      { label: '色づき始め', spec: { type: 'planting', kind: 'foliage', level: 1, pct: 50 } },
      { label: '見頃', spec: { type: 'planting', kind: 'foliage', level: 2 } },
      { label: '見頃過ぎ', spec: { type: 'planting', kind: 'foliage', level: 3 } },
      { label: 'シーズン外', spec: { type: 'planting', kind: 'foliage', level: 4 } },
    ],
  },
  {
    title: 'Illuminations',
    cells: [
      { label: 'まもなく', spec: { type: 'illumination', state: 'soon' } },
      { label: '点灯中', spec: { type: 'illumination', state: 'lit' } },
      { label: 'シーズン外', spec: { type: 'illumination', state: 'off' } },
    ],
  },
  {
    title: 'Festival on',
    cells: [
      { label: '花 見頃', spec: { type: 'planting', kind: 'bloom', level: 2 }, festival: true },
      { label: '葉 見頃', spec: { type: 'planting', kind: 'foliage', level: 2 }, festival: true },
      {
        label: '色づき',
        spec: { type: 'planting', kind: 'foliage', level: 1, pct: 50 },
        festival: true,
      },
      { label: '点灯中', spec: { type: 'illumination', state: 'lit' }, festival: true },
    ],
  },
];

interface Photos {
  bloom: string;
  foliage: string;
  illumination: string;
}

/** A pin's look under `L`, built the way pins.ts pinLook builds it from a status. */
function lookFor(cell: Cell, L: Look, photos: Photos): PinLook {
  const { spec } = cell;
  const track: string = RING_COLORS.track;
  let color: string = track;
  let pct: number | null = null;
  let filter: PinLook['photoFilter'] = 'none';
  let photo: string;
  if (spec.type === 'illumination') {
    photo = photos.illumination;
    if (spec.state === 'lit') color = L.lit;
    else filter = spec.state === 'soon' && L.soon === 'colour' ? 'none' : 'grey';
  } else {
    photo = photos[spec.kind];
    const ramp =
      spec.kind === 'bloom'
        ? { 1: L.starting, 2: RING_COLORS.bloom[2], 3: RING_COLORS.bloom[3] }
        : { 1: RING_COLORS.foliage[1], 2: RING_COLORS.foliage[2], 3: L.leafPast };
    if (spec.level === 0) filter = L.soon === 'colour' ? 'none' : 'grey';
    else if (spec.level === 4) filter = 'grey';
    else {
      color = ramp[spec.level];
      if (spec.level === 1) pct = spec.pct ?? 50;
      if (spec.level === 3) filter = 'faded';
    }
  }
  return {
    photo,
    ring: pct === null ? color : `conic-gradient(${color} 0 ${pct}%, ${track} ${pct}% 100%)`,
    tip: color,
    photoFilter: filter,
    glow: L.litGlow && spec.type === 'illumination' && spec.state === 'lit',
    festival: !!cell.festival,
    zIndex: 0,
    ariaLabel: cell.label,
  };
}

function Pin({ look, size }: { look: PinLook; size: PinSize }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) drawPin(ref.current, look, '');
  }, [look]);
  return <div ref={ref} style={pinStyle(size)} />;
}

/** One pane: a map with the board of pins over it (the board lets drags through to the map). */
function Pane(props: {
  title: string;
  look: Look;
  photos: Photos;
  size: PinSize;
  vision: string;
  width: number;
  onMap: (m: maplibregl.Map | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { onMap } = props;
  useEffect(() => {
    if (!box.current) return;
    registerPmtiles();
    const b = BACKDROPS[0]!;
    const map = new maplibregl.Map({
      container: box.current,
      style: basemapStyle('ja'),
      center: b.center,
      zoom: b.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    onMap(map);
    return () => {
      onMap(null);
      map.remove();
    };
  }, [onMap]);
  const L = props.look;
  // A wider ring grows the pin outwards instead of shrinking the photo: the pin's size (ring
  // included) gains the extra ring on both sides. CURRENT.ringPx is the app's ring.
  const size = { ...props.size, size: props.size.size + 2 * (L.ringPx - CURRENT.ringPx) };
  const vars = {
    '--cmp-ring': `${L.ringPx}px`,
    '--cmp-fest': L.festival,
    width: props.width,
    filter: props.vision === 'normal' ? undefined : `url(#cmp-${props.vision})`,
  } as CSSProperties;
  return (
    <section className="cmp-pane">
      <h3>{props.title}</h3>
      <div className="cmp-frame" style={vars}>
        <div ref={box} className="cmp-map" />
        <div className="cmp-board">
          {ROWS.map((row) => (
            <div key={row.title} className="cmp-row">
              <div className="cmp-row-title">{row.title}</div>
              <div className="cmp-cells">
                {row.cells.map((cell, i) => (
                  <div key={i} className="cmp-cell">
                    <Pin look={lookFor(cell, L, props.photos)} size={size} />
                    <span className="cmp-label">{cell.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The two panes' maps (one Pins tab per page), kept in step: moving one moves the other. */
const maps: (maplibregl.Map | null)[] = [null, null];
const onMaps = [0, 1].map((i) => (m: maplibregl.Map | null) => {
  maps[i] = m;
  m?.on('move', (e) => {
    if ((e as { cmpSync?: boolean }).cmpSync) return;
    maps[1 - i]?.jumpTo({ center: m.getCenter(), zoom: m.getZoom() }, { cmpSync: true });
  });
});

const SPECIES_CHOICES = {
  bloom: ['sakura', 'ume', 'nemophila', 'nanohana', 'tulip', 'azalea', 'hydrangea', 'cosmos'],
  foliage: ['momiji', 'ginkgo', 'kochia-red'],
};

export function PinsTool({ tabs }: { tabs: ReactNode }) {
  const [look, setLook] = useState<Look>(CURRENT);
  const [phone, setPhone] = useState(true);
  const [vision, setVision] = useState('normal');
  const [bloomSp, setBloomSp] = useState('sakura');
  const [leafSp, setLeafSp] = useState('momiji');
  const [pinSrc, setPinSrc] = useState<Record<string, string>>({});

  useEffect(() => {
    history.replaceState(null, '', `#${PINS_HASH}`);
    // Each species' pin close-up as the app shows it (the build's 192 px crops).
    fetch('/data/places.json')
      .then((r) => r.json())
      .then((d: { places: { plantings: { species: string; pin_src?: string }[] }[] }) => {
        const out: Record<string, string> = {};
        for (const p of d.places)
          for (const pl of p.plantings)
            if (pl.pin_src && !out[pl.species]) out[pl.species] = pl.pin_src;
        setPinSrc(out);
      })
      .catch(() => {});
  }, []);

  const photos: Photos = {
    bloom:
      pinSrc[bloomSp] ?? placeholderPhoto({ type: 'planting', species: bloomSp, kind: 'bloom' }),
    foliage:
      pinSrc[leafSp] ?? placeholderPhoto({ type: 'planting', species: leafSp, kind: 'foliage' }),
    illumination: placeholderPhoto({ type: 'illumination' }),
  };
  const set = <K extends keyof Look>(k: K, v: Look[K]) => setLook((l) => ({ ...l, [k]: v }));
  const size = phone ? PHONE_PIN : PIN;
  const width = phone ? 390 : 480;

  return (
    <div className="tool">
      <header>{tabs}</header>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        {VISION.filter((v) => v.matrix).map((v) => (
          <filter key={v.id} id={`cmp-${v.id}`} colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values={v.matrix} />
          </filter>
        ))}
      </svg>
      <div className="cmp">
        <aside className="cmp-controls">
          <h3>Candidate</h3>
          <label>
            咲き始め (flowers)
            <span className="cmp-swatches">
              {STARTING_PRESETS.map((p) => (
                <button
                  key={p.color}
                  className={look.starting.toLowerCase() === p.color.toLowerCase() ? 'on' : ''}
                  onClick={() => set('starting', p.color)}
                >
                  <i style={{ background: p.color }} /> {p.name}
                </button>
              ))}
              <input
                type="color"
                value={look.starting}
                onChange={(e) => set('starting', e.target.value)}
              />
            </span>
          </label>
          <label>
            まもなく photo
            <select value={look.soon} onChange={(e) => set('soon', e.target.value as Look['soon'])}>
              <option value="colour">In colour, empty ring</option>
              <option value="grey">Greyed (today)</option>
            </select>
          </label>
          <label>
            見頃過ぎ (leaves)
            <span className="cmp-swatches">
              <button onClick={() => set('leafPast', RING_COLORS.foliage[3])}>
                <i style={{ background: RING_COLORS.foliage[3] }} /> Today
              </button>
              <button onClick={() => set('leafPast', EARLIER.leafPast)}>
                <i style={{ background: EARLIER.leafPast }} /> Earlier
              </button>
              <input
                type="color"
                value={look.leafPast}
                onChange={(e) => set('leafPast', e.target.value)}
              />
            </span>
          </label>
          <label>
            Lit illumination
            <span className="cmp-swatches">
              <input type="color" value={look.lit} onChange={(e) => set('lit', e.target.value)} />
              <span>
                <input
                  type="checkbox"
                  checked={look.litGlow}
                  onChange={(e) => set('litGlow', e.target.checked)}
                />{' '}
                Glow
              </span>
            </span>
          </label>
          <label>
            Festival dot
            <span className="cmp-swatches">
              <button onClick={() => set('festival', CURRENT.festival)}>
                <i style={{ background: CURRENT.festival }} /> Today
              </button>
              <button onClick={() => set('festival', EARLIER.festival)}>
                <i style={{ background: EARLIER.festival }} /> Earlier orange
              </button>
              <input
                type="color"
                value={look.festival}
                onChange={(e) => set('festival', e.target.value)}
              />
            </span>
          </label>
          <label>
            Ring width
            <select value={look.ringPx} onChange={(e) => set('ringPx', +e.target.value)}>
              {[3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} px: pin {size.size + 2 * (n - CURRENT.ringPx)} px
                  {n === CURRENT.ringPx ? ' (today)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setLook(CURRENT)}>Reset candidate</button>

          <h3>View</h3>
          <label>
            Map
            <span className="cmp-swatches">
              {BACKDROPS.map((b) => (
                <button
                  key={b.name}
                  onClick={() => maps[0]?.jumpTo({ center: b.center, zoom: b.zoom })}
                >
                  {b.name}
                </button>
              ))}
            </span>
          </label>
          <label>
            Pin size
            <select
              value={phone ? 'phone' : 'desktop'}
              onChange={(e) => setPhone(e.target.value === 'phone')}
            >
              <option value="phone">Phone ({PHONE_PIN.size} px)</option>
              <option value="desktop">Desktop ({PIN.size} px)</option>
            </select>
          </label>
          <label>
            Colour vision
            <select value={vision} onChange={(e) => setVision(e.target.value)}>
              {VISION.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Flower photo
            <select value={bloomSp} onChange={(e) => setBloomSp(e.target.value)}>
              {SPECIES_CHOICES.bloom.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Leaf photo
            <select value={leafSp} onChange={(e) => setLeafSp(e.target.value)}>
              {SPECIES_CHOICES.foliage.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <p className="cmp-note">
            Drag or zoom either map; both follow. Pins here sit at fixed screen spots, not on
            places. Nothing on this tab is saved.
          </p>
        </aside>
        <Pane
          title="Today"
          look={CURRENT}
          photos={photos}
          size={size}
          vision={vision}
          width={width}
          onMap={onMaps[0]!}
        />
        <Pane
          title="Candidate"
          look={look}
          photos={photos}
          size={size}
          vision={vision}
          width={width}
          onMap={onMaps[1]!}
        />
      </div>
    </div>
  );
}

// The photo tool's Species tab: each species' pin close-up (`pin_photo` in data/species.yaml).
// The file is found by name (photos/species/<species id>.jpg, checked by the build). Drag the
// circle to move it and its handle to resize it: the circle is exactly what the round pin shows.
// Real-size pins beside it are drawn by the app's own pin code (pinLook, drawPin, pin.css).
// Saving rewrites only that species' `pin_photo:` block via server.ts, then runs the data check.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHONE_PIN, PIN, type PinSize } from '../../src/config.ts';
import { cropBox, fitCrop, PIN_SIZE, type Crop } from '../../src/lib/photos.ts';
import { OWN_LICENSE } from '../../src/lib/schema.ts';
import {
  STAGE_LABELS,
  type Level,
  type PlaceStatus,
  type PlantingState,
} from '../../src/lib/status.ts';
import { drawPin, pinLook, pinStyle } from '../../src/pins.ts';
import {
  DATA_REBUILT_EVENT,
  type SaveResponse,
  type SpeciesPhoto,
  type SpeciesResponse,
  type ToolSpecies,
} from './api.ts';
import { speciesPhotoProblems } from './photo-data.ts';
import {
  MAX_SIDE,
  saveResultText,
  SPECIES_HASH,
  startingPair,
  usePairOptions,
  withPairChange,
  type Dims,
} from './shared.ts';
import { CreditLicenseFields, SaveBar } from './fields.tsx';

/** What the build cuts without a crop (the largest centred square), as a circle to show. */
const DEFAULT_CIRCLE: Crop = { x: 50, y: 50, size: 100 };
/** The stages a pin preview shows (シーズン外 looks the same as まもなく). */
const PREVIEW_LEVELS: Level[] = [0, 1, 2, 3];
/** Where the resize handle sits on the circle: its lower right, 45° (50% + 50%·cos 45°). */
const HANDLE_AT = `${50 + 50 * Math.SQRT1_2}%`;

const imgUrl = (file: string) => `/__photo-tool/species-img/${encodeURIComponent(file)}`;

/** Draft and saved compare equal when they'd write the same YAML. */
const norm = (p: SpeciesPhoto | null | undefined) =>
  p ? [p.file, p.license === OWN_LICENSE ? '' : p.credit, p.license, p.crop ?? null] : null;
const samePhoto = (a: SpeciesPhoto | null | undefined, b: SpeciesPhoto | null | undefined) =>
  JSON.stringify(norm(a)) === JSON.stringify(norm(b));

async function fetchSpecies(): Promise<SpeciesResponse> {
  const r = await fetch('/__photo-tool/species');
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as SpeciesResponse;
}

function stateText(s: ToolSpecies): string {
  if (s.pin_photo) return s.pin_photo.crop ? 'set, cropped' : 'set, default square';
  if (s.files.length > 1) return `${s.files.length} files!`;
  return s.files.length ? 'file not in the YAML' : 'no file';
}

export function SpeciesTool({ tabs, active }: { tabs: ReactNode; active: boolean }) {
  const [data, setData] = useState<SpeciesResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [id, setId] = useState(() => {
    const [head, rest] = decodeURIComponent(location.hash.slice(1)).split('/');
    return head === SPECIES_HASH ? (rest ?? '') : '';
  });
  /** Unsaved changes by species id; null = remove its pin_photo. */
  const [drafts, setDrafts] = useState<Record<string, SpeciesPhoto | null>>({});
  const [dims, setDims] = useState<Record<string, Dims>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(
    () =>
      fetchSpecies().then(
        (r) => {
          setData(r);
          setLoadError('');
        },
        (e: unknown) =>
          setLoadError(`Couldn't load the species: ${String(e)}. Is "npm run dev" running?`),
      ),
    [],
  );

  useEffect(() => {
    void load();
    import.meta.hot?.on(DATA_REBUILT_EVENT, () => void load());
  }, [load]);

  useEffect(() => {
    if (active) history.replaceState(null, '', `#${SPECIES_HASH}${id ? `/${id}` : ''}`);
  }, [active, id]);

  const isDirty = (s: ToolSpecies) => s.id in drafts && !samePhoto(drafts[s.id], s.pin_photo);
  const anyDirty = data?.species.some(isDirty);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (anyDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const pairs = useMemo(() => data?.credits ?? [], [data]);
  const pairOptions = usePairOptions(pairs);

  const sp = data?.species.find((s) => s.id === id);
  const saved = sp?.pin_photo ?? null;
  const photo = id in drafts ? drafts[id]! : saved;
  const dirty = sp ? isDirty(sp) : false;
  const setPhoto = (next: SpeciesPhoto | null) => setDrafts((d) => ({ ...d, [id]: next }));
  const problems = sp && photo ? speciesPhotoProblems(sp.id, photo, sp.files) : [];

  const choose = (next: string) => {
    setId(next);
    setResult(null);
  };

  const add = (file: string) => {
    const pair = startingPair(pairs);
    setPhoto({
      file,
      credit: pair.license === OWN_LICENSE ? '' : pair.credit,
      license: pair.license,
    });
  };

  const save = async () => {
    if (!sp) return;
    setSaving(true);
    setResult(null);
    try {
      const r = await fetch('/__photo-tool/save-species', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sp.id, pin_photo: photo }),
      });
      const res = (await r.json()) as SaveResponse;
      if (!res.ok) setResult({ ok: false, text: `Not saved:\n${res.error}` });
      else {
        setDrafts((d) => {
          const rest = { ...d };
          delete rest[sp.id];
          return rest;
        });
        setResult(saveResultText(res));
        await load();
      }
    } catch (e) {
      setResult({ ok: false, text: `Not saved: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <p className="error">{loadError}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const revert = () =>
    setDrafts((d) => {
      const rest = { ...d };
      delete rest[id];
      return rest;
    });
  const fileHere = !!photo && sp?.files.includes(photo.file);
  const d = photo ? dims[imgUrl(photo.file)] : undefined;
  const box = d && photo ? cropBox(d.w, d.h, photo.crop) : undefined;

  return (
    <div className="tool">
      <header>
        {tabs}
        <select value={sp ? id : ''} onChange={(e) => choose(e.target.value)}>
          <option value="" disabled>
            Choose a species…
          </option>
          {data.species.map((s) => (
            <option key={s.id} value={s.id}>
              {isDirty(s) ? '✎ ' : ''}
              {s.name_ja} · {s.id} — {stateText(s)}
            </option>
          ))}
        </select>
        {anyDirty && <span className="warn">Unsaved changes (✎)</span>}
      </header>

      {!sp ? (
        <div className="tool-intro">
          <p className="muted">
            Pick a species. Its close-up goes in <code>photos/species/</code>, named after the
            species: <code>&lt;species id&gt;.jpg</code> (or .jpeg, .png, .webp). This tool only
            lists files; it doesn't move, rename or delete them.
          </p>
          <Unmatched files={data.unmatched} />
        </div>
      ) : (
        <main>
          <section className="lists">
            <h2>
              {sp.name_ja} <span className="muted">{sp.name_en}</span>
            </h2>
            <p className="muted small">
              <code>data/species.yaml</code> · {sp.id} · {sp.kind}
            </p>
            {sp.files.length > 1 && (
              <p className="error small">
                More than one file is named after {sp.id} ({sp.files.join(', ')}): keep one.
              </p>
            )}

            {!photo ? (
              sp.files.length === 0 ? (
                <p className="muted">
                  No photo yet. Put one named <code>{sp.id}.jpg</code> (or .jpeg, .png, .webp) in{' '}
                  <code>photos/species/</code>; the tool picks it up by itself.
                </p>
              ) : (
                <p>
                  {sp.files.map((f) => (
                    <button key={f} onClick={() => add(f)}>
                      Add {f}
                    </button>
                  ))}{' '}
                  <span className="muted small">
                    {saved ? '(removed: Save to remove it from the YAML)' : '(not in the YAML yet)'}
                  </span>
                </p>
              )
            ) : (
              <>
                <div className="field">
                  <span>file</span>
                  <span>
                    {photo.file}
                    {!fileHere && <span className="error"> (not in photos/species/)</span>}
                  </span>
                </div>
                <div className="field">
                  <span>crop</span>
                  <span>
                    {photo.crop ? (
                      <strong>
                        x {photo.crop.x} · y {photo.crop.y} · size {photo.crop.size}
                      </strong>
                    ) : (
                      <span className="muted">default (the largest centred square)</span>
                    )}
                    {photo.crop && (
                      <button
                        className="link"
                        onClick={() => setPhoto({ ...photo, crop: undefined })}
                      >
                        use default
                      </button>
                    )}
                  </span>
                </div>
                <CreditLicenseFields
                  credit={photo.credit}
                  license={photo.license}
                  options={pairOptions}
                  onChange={(change) => setPhoto(withPairChange(photo, change, pairs))}
                />
                {d && Math.max(d.w, d.h) > MAX_SIDE && (
                  <p className="small warn">
                    {d.w}×{d.h}: shrink to about {MAX_SIDE} px before committing
                  </p>
                )}
                {box && 'side' in box && box.side < PIN_SIZE && (
                  <p className="small warn">
                    The circle covers {box.side} px of the photo, less than the {PIN_SIZE} px pin
                    image: it will look blurry.
                  </p>
                )}
                <p>
                  <button onClick={() => setPhoto(null)}>Remove from the YAML</button>{' '}
                  <span className="muted small">(the file stays)</span>
                </p>
              </>
            )}

            <SaveBar
              dirty={dirty}
              saving={saving}
              problems={problems}
              result={result}
              onSave={save}
              onRevert={revert}
            />
            <Unmatched files={data.unmatched} />
          </section>

          <section className="editor">
            {photo && fileHere ? (
              <CircleEditor
                key={photo.file}
                src={imgUrl(photo.file)}
                crop={photo.crop}
                dims={d}
                onDims={(dd) =>
                  setDims((all) =>
                    all[imgUrl(photo.file)]?.w === dd.w && all[imgUrl(photo.file)]?.h === dd.h
                      ? all
                      : { ...all, [imgUrl(photo.file)]: dd },
                  )
                }
                onCrop={(crop) => setPhoto({ ...photo, crop })}
                kind={sp.kind}
              />
            ) : (
              <p className="muted">The photo shows here once the species has one.</p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

function Unmatched({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <>
      <h3>Files matching no species ({files.length})</h3>
      <p className="muted small">
        Fine for a planting&apos;s own pin photo (河津桜…); otherwise rename the file to a species
        id.
      </p>
      <ul className="small">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * The photo with the pin's circle on it: drag inside to move, drag the handle to resize. The
 * circle can't leave the photo (fitCrop). Without a crop it shows the build's default square.
 */
function CircleEditor(props: {
  src: string;
  crop?: Crop;
  dims?: Dims;
  onDims: (d: Dims) => void;
  onCrop: (crop: Crop) => void;
  kind: 'bloom' | 'foliage';
}) {
  const { src, dims } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const drag = useRef<{ mode: 'move' | 'size'; x: number; y: number; start: Crop } | null>(null);
  const shown = props.crop ?? DEFAULT_CIRCLE;

  const begin = (mode: 'move' | 'size', e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: shown };
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !dims || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    if (d.mode === 'move') {
      const x = d.start.x + ((e.clientX - d.x) / r.width) * 100;
      const y = d.start.y + ((e.clientY - d.y) / r.height) * 100;
      props.onCrop(fitCrop(dims.w, dims.h, { ...d.start, x, y }));
    } else {
      // The circle's radius is the pointer's distance from its centre.
      const cx = r.left + (d.start.x / 100) * r.width;
      const cy = r.top + (d.start.y / 100) * r.height;
      const radius = Math.hypot(e.clientX - cx, e.clientY - cy);
      const size = ((2 * radius) / Math.min(r.width, r.height)) * 100;
      props.onCrop(fitCrop(dims.w, dims.h, { ...d.start, size }));
    }
  };
  const end = () => {
    drag.current = null;
  };

  // The pin image as the build cuts it: the crop square, scaled to PIN_SIZE.
  const pinImage = useMemo(() => {
    if (!img || !dims) return '';
    const box = cropBox(dims.w, dims.h, props.crop);
    if ('error' in box) return '';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PIN_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, box.left, box.top, box.side, box.side, 0, 0, PIN_SIZE, PIN_SIZE);
    return canvas.toDataURL('image/webp', 0.8);
  }, [img, dims, props.crop]);

  const short = dims ? Math.min(dims.w, dims.h) : 0;
  const w = dims ? (shown.size * short) / dims.w : 0;
  const h = dims ? (shown.size * short) / dims.h : 0;

  return (
    <div>
      <p className="muted small">
        Drag inside the circle to move it, drag its handle to resize it. The circle is exactly what
        the round pin shows.
      </p>
      <div ref={wrap} className="stage crop-stage">
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setImg(el);
            props.onDims({ w: el.naturalWidth, h: el.naturalHeight });
          }}
        />
        {dims && (
          <div
            className="crop-circle"
            style={{
              left: `${shown.x - w / 2}%`,
              top: `${shown.y - h / 2}%`,
              width: `${w}%`,
              height: `${h}%`,
            }}
            onPointerDown={(e) => begin('move', e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <span
              className="crop-handle"
              style={{ left: HANDLE_AT, top: HANDLE_AT }}
              onPointerDown={(e) => begin('size', e)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          </div>
        )}
      </div>
      {pinImage && (
        <>
          <h4>Pins at real size</h4>
          <div className="pin-previews">
            {[PIN, PHONE_PIN].map((size) => (
              <div key={size.size} className="pin-preview-row">
                <span className="muted small">{size === PIN ? 'desktop' : 'phone'}</span>
                {PREVIEW_LEVELS.map((level) => (
                  <figure key={level}>
                    <PinPreview photo={pinImage} kind={props.kind} level={level} size={size} />
                    <figcaption className="small muted">
                      {STAGE_LABELS[props.kind][level].ja}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One pin drawn by the app's own code (pinLook, drawPin), for a planting at `level`. */
function PinPreview(props: {
  photo: string;
  kind: 'bloom' | 'foliage';
  level: Level;
  size: PinSize;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { photo, kind, level } = props;
  useLayoutEffect(() => {
    const pin: PlantingState = {
      type: 'planting',
      id: 'preview',
      kind,
      level,
      confirmed: true,
      basis: 'report',
      noRecentInfo: false,
      peakSoon: false,
      featured: false,
      why: '',
    };
    // pinLook only reads the pin, the place's name and plantings, and festivals.
    const ps = {
      place: { name_ja: '', plantings: [] },
      pin,
      features: [pin],
      festivals: [],
      closed: false,
    } as unknown as PlaceStatus;
    const look = pinLook(ps, 'ja');
    if (look && ref.current) drawPin(ref.current, { ...look, photo }, '');
  }, [photo, kind, level]);
  return <div ref={ref} style={pinStyle(props.size)} />;
}

// The photo tool's page, in two tabs:
// - Places: pick a place, manage its `photos` list (order, credit, license) and click where each
//   photo's 2:1 strip should sit (focus_y). Saving rewrites only the `photos` block of
//   data/places/<path>.yaml via server.ts, then runs the data check.
// - Species: each species' pin close-up (SpeciesTool.tsx).
// - Pins: pin colour and style candidates side by side on the map (PinsTool.tsx). Saves nothing.
// Both tabs stay mounted, so switching keeps unsaved edits.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HEADER_ASPECT, headerBand } from '../../src/lib/photos.ts';
import { OWN_LICENSE } from '../../src/lib/schema.ts';
import {
  DATA_REBUILT_EVENT,
  type PhotoEntry,
  type PlacesResponse,
  type SaveResponse,
  type ToolPlace,
} from './api.ts';
import { photoListProblems } from './photo-data.ts';
import {
  MAX_SIDE,
  saveResultText,
  setDimsFor,
  PINS_HASH,
  SPECIES_HASH,
  startingPair,
  usePairOptions,
  withPairChange,
  type Dims,
} from './shared.ts';
import { CreditLicenseFields, SaveBar } from './fields.tsx';
import { SpeciesTool } from './SpeciesTool.tsx';
import { PinsTool } from './PinsTool.tsx';

type Tab = 'places' | 'species' | 'pins';
const TAB_NAMES: Record<Tab, string> = { places: 'Places', species: 'Species', pins: 'Pins' };

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const head = location.hash.slice(1).split('/')[0];
    return head === SPECIES_HASH ? 'species' : head === PINS_HASH ? 'pins' : 'places';
  });
  const tabs = (
    <nav className="tabs">
      <h1>Photo tool</h1>
      {(['places', 'species', 'pins'] as const).map((t) => (
        <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
          {TAB_NAMES[t]}
        </button>
      ))}
    </nav>
  );
  return (
    <>
      <div hidden={tab !== 'places'}>
        <PlacesTool tabs={tabs} active={tab === 'places'} />
      </div>
      <div hidden={tab !== 'species'}>
        <SpeciesTool tabs={tabs} active={tab === 'species'} />
      </div>
      {/* Mounted only while showing: its two maps would draw at zero size while hidden. */}
      {tab === 'pins' && <PinsTool tabs={tabs} />}
    </>
  );
}

const imgUrl = (path: string, file: string) =>
  `/__photo-tool/img/${path}/${encodeURIComponent(file)}`;

const samePhotos = (a: PhotoEntry[], b: PhotoEntry[]) =>
  JSON.stringify(a.map(norm)) === JSON.stringify(b.map(norm));
const norm = (p: PhotoEntry) => [p.file, p.credit, p.license, p.focus_y ?? null];

const isWide = (d: Dims) => d.w / d.h >= HEADER_ASPECT;

async function fetchPlaces(): Promise<PlacesResponse> {
  const r = await fetch('/__photo-tool/places');
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as PlacesResponse;
}

function PlacesTool({ tabs, active }: { tabs: ReactNode; active: boolean }) {
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [path, setPath] = useState(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const head = hash.split('/')[0];
    return head === SPECIES_HASH || head === PINS_HASH ? '' : hash;
  });
  const [drafts, setDrafts] = useState<Record<string, PhotoEntry[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<string, Dims>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(
    () =>
      fetchPlaces().then(
        (r) => {
          setData(r);
          setLoadError('');
        },
        (e: unknown) =>
          setLoadError(`Couldn't load the places: ${String(e)}. Is "npm run dev" running?`),
      ),
    [],
  );

  useEffect(() => {
    void load();
    // A file in data/ or photos/ changed (a photo added to a folder, a YAML edited): refresh the
    // lists. Unsaved edits are kept.
    import.meta.hot?.on(DATA_REBUILT_EVENT, () => void load());
  }, [load]);

  const place: ToolPlace | undefined = data?.places.find((p) => p.path === path);
  const saved = place?.photos ?? [];
  const draft = drafts[path];
  const photos = draft ?? saved;
  const dirty = draft !== undefined && !samePhotos(draft, saved);
  const anyDirty = data?.places.some(
    (p) => drafts[p.path] && !samePhotos(drafts[p.path]!, p.photos),
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (anyDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  // The address shows the open place while this tab is showing.
  useEffect(() => {
    if (active) history.replaceState(null, '', path ? `#${path}` : location.pathname);
  }, [active, path]);

  const choosePlace = (p: string) => {
    setPath(p);
    setSelected(null);
    setResult(null);
  };

  const setPhotos = (next: PhotoEntry[]) => setDrafts((d) => ({ ...d, [path]: next }));
  const update = (file: string, change: Partial<PhotoEntry>) =>
    setPhotos(photos.map((p) => (p.file === file ? { ...p, ...change } : p)));

  const creditPairs = useMemo(() => data?.credits ?? [], [data]);
  const pairOptions = usePairOptions(creditPairs);

  const addFile = (file: string) => {
    const pair = startingPair(creditPairs);
    setPhotos([...photos, { file, credit: pair.credit, license: pair.license }]);
    setSelected(file);
  };

  const move = (i: number, by: number) => {
    const next = [...photos];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    setPhotos(next);
  };

  const problems = place ? photoListProblems(photos, place.files) : [];

  const save = async () => {
    if (!place) return;
    setSaving(true);
    setResult(null);
    try {
      const r = await fetch('/__photo-tool/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: place.path, photos }),
      });
      const res = (await r.json()) as SaveResponse;
      if (!res.ok) setResult({ ok: false, text: `Not saved:\n${res.error}` });
      else {
        setDrafts((d) => {
          const rest = { ...d };
          delete rest[place.path];
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
      delete rest[path];
      return rest;
    });
  const byMunicipality = groupBy(data.places, (p) => p.path.split('/').slice(0, 2).join('/'));
  const unlisted = place ? place.files.filter((f) => !photos.some((p) => p.file === f)) : [];
  const current = photos.find((p) => p.file === selected);

  return (
    <div className="tool">
      <header>
        {tabs}
        <select value={place ? path : ''} onChange={(e) => choosePlace(e.target.value)}>
          <option value="" disabled>
            Choose a place…
          </option>
          {[...byMunicipality].map(([muni, places]) => (
            <optgroup key={muni} label={`${muni} (${places[0]!.municipality})`}>
              {places.map((p) => {
                const pDirty = drafts[p.path] && !samePhotos(drafts[p.path]!, p.photos);
                const waiting = p.files.filter((f) => !p.photos.some((ph) => ph.file === f)).length;
                return (
                  <option key={p.path} value={p.path}>
                    {pDirty ? '✎ ' : ''}
                    {p.name_ja} · {p.id} — {p.photos.length} listed
                    {waiting ? `, ${waiting} new` : ''}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
        {anyDirty && <span className="warn">Unsaved changes (✎)</span>}
      </header>

      {!place ? (
        <p className="muted">
          Pick a place. Put its photos in{' '}
          <code>photos/places/&lt;prefecture&gt;/&lt;municipality&gt;/&lt;place-id&gt;/</code>{' '}
          first; this tool only lists them, it doesn't move or delete files.
        </p>
      ) : (
        <main>
          <section className="lists">
            <h2>
              {place.name_ja}
              {place.name_en ? <span className="muted"> {place.name_en}</span> : null}
            </h2>
            <p className="muted small">
              <code>data/places/{place.path}.yaml</code>
              <br />
              <code>photos/places/{place.path}/</code>
              {!place.folderExists && <span className="error"> (folder doesn't exist yet)</span>}
            </p>

            <h3>In the YAML ({photos.length})</h3>
            <p className="muted small">
              Order is the place page's photo strip order: the first shows first.
            </p>
            {photos.length === 0 && <p className="muted small">None yet.</p>}
            <ol className="photos">
              {photos.map((p, i) => {
                const missing = !place.files.includes(p.file);
                const d = dims[imgUrl(place.path, p.file)];
                return (
                  <li
                    key={p.file}
                    className={p.file === selected ? 'selected' : ''}
                    onClick={() => setSelected(p.file)}
                  >
                    {missing ? (
                      <div className="thumb missing">missing</div>
                    ) : (
                      <Thumb src={imgUrl(place.path, p.file)} onDims={setDimsFor(setDims)} />
                    )}
                    <div className="meta">
                      <div className="file">
                        {i === 0 && <span className="tag">first</span>} {p.file}
                      </div>
                      <div className="small muted">
                        {p.license === OWN_LICENSE
                          ? 'no credit'
                          : p.credit || <span className="error">no credit</span>}{' '}
                        · {p.license || <span className="error">no license</span>}
                        {p.focus_y !== undefined && ` · focus_y ${p.focus_y}`}
                      </div>
                      {missing && <div className="small error">File not in the folder</div>}
                      {d && Math.max(d.w, d.h) > MAX_SIDE && (
                        <div className="small warn">
                          {d.w}×{d.h}: shrink to about {MAX_SIDE} px before committing
                        </div>
                      )}
                    </div>
                    <div className="buttons" onClick={(e) => e.stopPropagation()}>
                      <button disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                        ↑
                      </button>
                      <button
                        disabled={i === photos.length - 1}
                        onClick={() => move(i, 1)}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setPhotos(photos.filter((x) => x.file !== p.file))}
                        title="Remove from the YAML (the file stays)"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>

            <h3>In the folder, not in the YAML ({unlisted.length})</h3>
            {unlisted.length === 0 && <p className="muted small">None.</p>}
            <ul className="photos">
              {unlisted.map((f) => (
                <li key={f}>
                  <Thumb src={imgUrl(place.path, f)} onDims={setDimsFor(setDims)} />
                  <div className="meta">
                    <div className="file">{f}</div>
                  </div>
                  <div className="buttons">
                    <button onClick={() => addFile(f)}>Add</button>
                  </div>
                </li>
              ))}
            </ul>

            <SaveBar
              dirty={dirty}
              saving={saving}
              problems={problems}
              result={result}
              onSave={save}
              onRevert={revert}
            />
          </section>

          <section className="editor">
            {!current ? (
              <p className="muted">Click a photo in the YAML list to edit it.</p>
            ) : (
              <Editor
                key={current.file}
                src={imgUrl(place.path, current.file)}
                photo={current}
                missing={!place.files.includes(current.file)}
                dims={dims[imgUrl(place.path, current.file)]}
                onDims={setDimsFor(setDims)}
                pairOptions={pairOptions}
                onChange={(change) =>
                  update(current.file, withPairChange(current, change, creditPairs))
                }
              />
            )}
          </section>
        </main>
      )}
    </div>
  );
}

function Editor(props: {
  src: string;
  photo: PhotoEntry;
  missing: boolean;
  dims?: Dims;
  onDims: (src: string, d: Dims) => void;
  pairOptions: ReturnType<typeof usePairOptions>;
  onChange: (change: Partial<PhotoEntry>) => void;
}) {
  const { src, photo, dims } = props;
  const [hoverY, setHoverY] = useState<number | null>(null);
  const wide = dims ? isWide(dims) : false;
  const shownY = hoverY ?? photo.focus_y ?? 50;
  const band = dims ? headerBand(dims.w, dims.h, shownY) : null;

  const yAt = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.round(Math.min(Math.max(((e.clientY - r.top) / r.height) * 100, 0), 100));
  };

  return (
    <div>
      <h3>{photo.file}</h3>
      {props.missing ? (
        <p className="error">
          This file isn't in the photo folder. Remove it from the list, or put the file back.
        </p>
      ) : (
        <>
          <p className="muted small">
            {wide
              ? 'Wider than 2:1: the strip keeps the middle of the photo, so there is no focus_y to set.'
              : 'Move over the photo to place its 2:1 strip, click to keep it. The band stops at the photo’s edges, exactly as the build cuts it.'}
          </p>
          <div
            className={`stage ${wide ? '' : 'pickable'}`}
            onMouseMove={wide ? undefined : (e) => setHoverY(yAt(e))}
            onMouseLeave={() => setHoverY(null)}
            onClick={wide ? undefined : (e) => props.onChange({ focus_y: yAt(e) })}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                props.onDims(src, {
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
            />
            {dims && band && (
              <>
                <div className="shade" style={{ top: 0, height: pct(band.top, dims.h) }} />
                <div
                  className="shade"
                  style={{ top: pct(band.top + band.height, dims.h), bottom: 0 }}
                />
                <div
                  className="shade"
                  style={{
                    top: pct(band.top, dims.h),
                    height: pct(band.height, dims.h),
                    left: 0,
                    width: pct(band.left, dims.w),
                  }}
                />
                <div
                  className="shade"
                  style={{
                    top: pct(band.top, dims.h),
                    height: pct(band.height, dims.h),
                    right: 0,
                    width: pct(dims.w - band.left - band.width, dims.w),
                  }}
                />
                <div
                  className={`band ${hoverY === null ? '' : 'hover'}`}
                  style={{
                    top: pct(band.top, dims.h),
                    height: pct(band.height, dims.h),
                    left: pct(band.left, dims.w),
                    width: pct(band.width, dims.w),
                  }}
                />
                {!wide && <div className="focus" style={{ top: `${shownY}%` }} />}
              </>
            )}
          </div>
          {dims && band && (
            <>
              <h4>
                Strip preview{' '}
                <span className="muted small">
                  {hoverY === null ? '(saved position)' : '(cursor; click to keep)'}
                </span>
              </h4>
              <div className="preview" style={{ aspectRatio: HEADER_ASPECT }}>
                <img
                  src={src}
                  alt=""
                  style={{
                    width: pct(dims.w, band.width),
                    left: `-${pct(band.left, band.width)}`,
                    top: `-${pct(band.top, band.height)}`,
                  }}
                />
              </div>
            </>
          )}
          <div className="field">
            <span>focus_y</span>
            <span>
              {wide ? (
                <span className="muted">not used</span>
              ) : photo.focus_y === undefined ? (
                <span className="muted">not set (50, the middle)</span>
              ) : (
                <strong>{photo.focus_y}</strong>
              )}
              {photo.focus_y !== undefined && (
                <button className="link" onClick={() => props.onChange({ focus_y: undefined })}>
                  remove
                </button>
              )}
            </span>
          </div>
        </>
      )}
      <CreditLicenseFields
        credit={photo.credit}
        license={photo.license}
        options={props.pairOptions}
        onChange={props.onChange}
      />
    </div>
  );
}

function Thumb(props: { src: string; onDims: (src: string, d: Dims) => void }) {
  return (
    <img
      className="thumb"
      src={props.src}
      alt=""
      loading="lazy"
      onLoad={(e) =>
        props.onDims(props.src, {
          w: e.currentTarget.naturalWidth,
          h: e.currentTarget.naturalHeight,
        })
      }
    />
  );
}

const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}

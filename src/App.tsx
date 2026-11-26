import { useEffect, useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import FilterBar from './components/FilterBar';
import MapView, { type ViewBounds } from './components/MapView';
import PlaceList from './components/PlaceList';
import PlacePage from './components/PlacePage';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { passesFilter, pinForFilter, placeStatus, type Filter } from './lib/status';
import { OPENED_WITH_PLACE, useSelectedPlace } from './selectedPlace';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
  const { date, isOverride, setDate } = useAppDate();
  // Debug only: the Why panel takes the list's place while it's open.
  const [panelOpen, setPanelOpen] = useState(false);
  const [bounds, setBounds] = useState<ViewBounds | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; n: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('in-season');
  const { selected, open, close } = useSelectedPlace();

  // Every place's status on `date`: the single source for pins, list and place page.
  const statuses = useMemo(
    () => (data ? data.places.map((p) => placeStatus(p, data.festivals, date)) : []),
    [data, date],
  );
  const selectedStatus = statuses.find((ps) => ps.place.id === selected) ?? null;

  // A shared link to a place the default filter hides opens with すべて表示 (CLAUDE.md). Checked
  // once, as soon as the statuses exist (state adjusted during render, React's pattern for this).
  const [linkChecked, setLinkChecked] = useState(false);
  if (!linkChecked && statuses.length) {
    setLinkChecked(true);
    const ps = statuses.find((x) => x.place.id === OPENED_WITH_PLACE);
    if (ps && !passesFilter(ps, filter)) setFilter('all');
  }

  // What the map shows: places that pass the filter, each fronted by the filter's pin. The open
  // place always keeps its pin.
  const visible = useMemo(
    () =>
      statuses
        .filter((ps) => passesFilter(ps, filter) || ps.place.id === selected)
        .map((ps) => ({ ...ps, pin: pinForFilter(ps, filter) })),
    [statuses, filter, selected],
  );

  // Esc closes the place page.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, close]);

  // Debug panel only: fly to a place. Opening a place never moves the map.
  const flyTo = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    if (p) setFocus((f) => ({ lng: p.lng, lat: p.lat, n: (f?.n ?? 0) + 1 }));
  };

  const linkPlace = data?.places.find((p) => p.id === OPENED_WITH_PLACE);

  return (
    <div className="app" lang={lang}>
      <header className="app-header">
        <h1>{t('appTitle', lang)}</h1>
        <button
          type="button"
          className="lang-toggle"
          onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
        >
          {t('switchLang', lang)}
        </button>
      </header>
      {DEBUG && (
        <DebugBar
          date={date}
          isOverride={isOverride}
          setDate={setDate}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
        />
      )}
      {error && <p className="load-error">{t('loadError', lang)}</p>}
      <FilterBar
        filter={filter}
        setFilter={setFilter}
        lang={lang}
        openPlace={selectedStatus ? { onBack: close } : null}
      />
      <div className="main">
        {/* Side panel on the left, like Google Maps. */}
        {data &&
          (DEBUG && panelOpen ? (
            <DebugPanel statuses={statuses} species={data.species} lang={lang} onSelect={flyTo} />
          ) : selectedStatus ? (
            <PlacePage
              ps={selectedStatus}
              species={data.species}
              sources={data.sources}
              today={date}
              lang={lang}
            />
          ) : (
            <PlaceList
              places={visible}
              bounds={bounds}
              species={data.species}
              today={date}
              lang={lang}
              onSelect={open}
            />
          ))}
        <div className="map-area">
          {/* Waits for the data, so a shared place link can open centred on its place. */}
          {data && (
            <MapView
              statuses={visible}
              lang={lang}
              focus={focus}
              onViewChange={setBounds}
              selectedId={selected}
              onPinClick={open}
              onEmptyClick={close}
              initialCenter={linkPlace ? { lng: linkPlace.lng, lat: linkPlace.lat } : null}
            />
          )}
          {data && visible.length === 0 && (
            <p className="map-notice">
              {t('noMatches', lang)}{' '}
              <button type="button" className="chip" onClick={() => setFilter('all')}>
                {t('filterAll', lang)}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

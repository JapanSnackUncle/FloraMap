import { useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import FilterBar from './components/FilterBar';
import MapView, { type ViewBounds } from './components/MapView';
import PlaceList from './components/PlaceList';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { passesFilter, pinForFilter, placeStatus, type Filter } from './lib/status';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
  const { date, isOverride, setDate } = useAppDate();
  // Debug only: the Why panel takes the list's place while it's open.
  const [panelOpen, setPanelOpen] = useState(false);
  const [bounds, setBounds] = useState<ViewBounds | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; n: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('in-season');

  // Every place's status on `date`: the single source for pins, list and place page.
  const statuses = useMemo(
    () => (data ? data.places.map((p) => placeStatus(p, data.festivals, date)) : []),
    [data, date],
  );

  // What the map shows: places that pass the filter, each fronted by the filter's pin.
  const visible = useMemo(
    () =>
      statuses
        .filter((ps) => passesFilter(ps, filter))
        .map((ps) => ({ ...ps, pin: pinForFilter(ps, filter) })),
    [statuses, filter],
  );

  // Debug panel only: fly to a place. The list never moves the map (step 5.7 adds selection).
  const flyTo = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    if (p) setFocus((f) => ({ lng: p.lng, lat: p.lat, n: (f?.n ?? 0) + 1 }));
  };

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
      <FilterBar filter={filter} setFilter={setFilter} lang={lang} />
      <div className="main">
        <div className="map-area">
          <MapView statuses={visible} lang={lang} focus={focus} onViewChange={setBounds} />
          {data && visible.length === 0 && (
            <p className="map-notice">
              {t('noMatches', lang)}{' '}
              <button type="button" className="chip" onClick={() => setFilter('all')}>
                {t('filterAll', lang)}
              </button>
            </p>
          )}
        </div>
        {data &&
          (DEBUG && panelOpen ? (
            <DebugPanel statuses={statuses} species={data.species} lang={lang} onSelect={flyTo} />
          ) : (
            <PlaceList
              places={visible}
              bounds={bounds}
              species={data.species}
              today={date}
              lang={lang}
            />
          ))}
      </div>
    </div>
  );
}

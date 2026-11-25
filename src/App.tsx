import { useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import FilterBar from './components/FilterBar';
import MapView from './components/MapView';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { passesFilter, pinForFilter, placeStatus, type Filter } from './lib/status';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
  const { date, isOverride, setDate } = useAppDate();
  const [panelOpen, setPanelOpen] = useState(DEBUG);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
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
          <MapView statuses={visible} lang={lang} focus={focus} />
          {data && visible.length === 0 && (
            <p className="map-notice">
              {t('noMatches', lang)}{' '}
              <button type="button" className="chip" onClick={() => setFilter('all')}>
                {t('filterAll', lang)}
              </button>
            </p>
          )}
        </div>
        {DEBUG && panelOpen && data && (
          <DebugPanel
            statuses={statuses}
            species={data.species}
            lang={lang}
            onSelect={(id) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))}
          />
        )}
      </div>
    </div>
  );
}

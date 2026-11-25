import { useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import MapView from './components/MapView';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { placeStatus } from './lib/status';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
  const { date, isOverride, setDate } = useAppDate();
  const [panelOpen, setPanelOpen] = useState(DEBUG);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  // Every place's status on `date`: the single source for pins, list and place page.
  const statuses = useMemo(
    () => (data ? data.places.map((p) => placeStatus(p, data.festivals, date)) : []),
    [data, date],
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
      <div className="main">
        <MapView places={data?.places ?? null} focus={focus} />
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

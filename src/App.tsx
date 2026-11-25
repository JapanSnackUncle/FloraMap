import { useState } from 'react';
import MapView from './components/MapView';
import { useData } from './data';
import { t, type Lang } from './i18n';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
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
      {error && <p className="load-error">{t('loadError', lang)}</p>}
      <MapView places={data?.places ?? null} />
    </div>
  );
}

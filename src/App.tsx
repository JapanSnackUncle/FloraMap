import { useState } from 'react';
import MapView from './components/MapView';
import { t, type Lang } from './i18n';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
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
      <MapView />
    </div>
  );
}

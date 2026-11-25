import { useState } from 'react';
import { t, type Lang } from './i18n';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  return (
    <main lang={lang} style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>{t('appTitle', lang)}</h1>
      <p>{t('comingSoon', lang)}</p>
      <button type="button" onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}>
        {t('switchLang', lang)}
      </button>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { initialLang, t, type Lang } from './i18n';

// The app's language (CLAUDE.md, "Language"): starts from the saved toggle choice or the device
// language (initialLang), and keeps the page's own language marks in step with it.

/** Browser storage key for the toggle choice (this browser only; may be unavailable). */
const STORAGE_KEY = 'lang';

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode, settings): fall back to the device language
  }
}

export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() =>
    initialLang(readSaved(), navigator.languages ?? [navigator.language]),
  );

  // <html lang> tells screen readers and search engines which language the page is in; the tab
  // title follows too.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('appTitle', lang);
  }, [lang]);

  // Only a choice made with the toggle is saved, so a visitor who never touches it keeps
  // following the device language.
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not saved: the choice lasts until the page is reloaded
    }
  };

  return [lang, setLang];
}

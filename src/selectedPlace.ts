import { useCallback, useEffect, useState } from 'react';

// The open place page lives in the address bar (?place=kairakuen), so a link opens straight on
// it and the browser's Back button closes it (CLAUDE.md, "Place page").

const readParam = () => new URLSearchParams(window.location.search).get('place');

/** The place id in the address when the page loaded (for the shared-link rules). */
export const OPENED_WITH_PLACE = readParam();

/** Marks the history entry we pushed for an open page, so closing can step back over it. */
const PUSHED = 'flora-place-page';

function withPlace(id: string | null): URL {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('place', id);
  else url.searchParams.delete('place');
  return url;
}

export function useSelectedPlace(): {
  selected: string | null;
  open: (id: string) => void;
  close: () => void;
} {
  const [selected, setSelected] = useState<string | null>(OPENED_WITH_PLACE);

  useEffect(() => {
    const sync = () => setSelected(readParam());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const open = useCallback((id: string) => {
    // From the list: a new history step. From another place: replace it, so one Back
    // always returns to the list.
    if (readParam()) window.history.replaceState(window.history.state, '', withPlace(id));
    else window.history.pushState(PUSHED, '', withPlace(id));
    setSelected(id);
  }, []);

  const close = useCallback(() => {
    if (!readParam()) return;
    if (window.history.state === PUSHED) window.history.back();
    else window.history.replaceState(window.history.state, '', withPlace(null));
    setSelected(null);
  }, []);

  return { selected, open, close };
}

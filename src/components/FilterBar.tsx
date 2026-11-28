import type { ReactNode } from 'react';
import { t, type Lang, type StringKey } from '../i18n';
import type { Filter } from '../lib/status';

const FILTERS: { id: Filter; label: StringKey }[] = [
  { id: 'in-season', label: 'filterInSeason' },
  { id: 'peak', label: 'filterPeak' },
  { id: 'festivals', label: 'filterFestivals' },
  { id: 'illuminations', label: 'filterIlluminations' },
  { id: 'all', label: 'filterAll' },
];

interface Props {
  filter: Filter;
  setFilter: (f: Filter) => void;
  lang: Lang;
  /** While a place page is open: a back-to-list button replaces the chips. */
  openPlace?: { onBack: () => void } | null;
  /** After the chips, and after the back button while a page is open: the language button
      (desktop: at the row's right end). */
  extra?: ReactNode;
  /** Desktop: the app's name at the row's left end (phones have no title). */
  title?: ReactNode;
}

/** The five filters (CLAUDE.md): シーズン中 is the default. One is always on. */
export default function FilterBar({ filter, setFilter, lang, openPlace, extra, title }: Props) {
  if (openPlace) {
    // Same row height as the chips (no map jump); the button sits right above the side panel.
    return (
      <div className="filter-bar page-bar">
        {title}
        <button type="button" className="chip back" onClick={openPlace.onBack}>
          ← {t('back', lang)}
        </button>
        {extra}
      </div>
    );
  }
  return (
    <div className="filter-bar">
      {title}
      <div className="chips" role="group" aria-label={t('filtersLabel', lang)}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {t(f.label, lang)}
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}

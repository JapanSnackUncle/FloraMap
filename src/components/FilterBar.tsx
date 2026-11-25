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
}

/** The five filters (CLAUDE.md): シーズン中 is the default. One is always on. */
export default function FilterBar({ filter, setFilter, lang }: Props) {
  return (
    <div className="filter-bar" role="group" aria-label={t('filtersLabel', lang)}>
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
  );
}

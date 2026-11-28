import type { ReactNode } from 'react';
import { t, type Lang } from '../i18n';
import { featureName, placeName } from '../labels';
import type { Species } from '../lib/schema';
import type { PlaceStatus } from '../lib/status';
import { listCountText, listedPlaces, rowText } from '../listText';
import StageTag from './StageTag';
import StatusLine from './StatusLine';
import { pinLook } from '../pins';
import type { ViewBounds } from './MapView';

interface Props {
  /** Places passing the filter, each with the filter's pin. */
  places: PlaceStatus[];
  /** The visible map area; null until the map has loaded. */
  bounds: ViewBounds | null;
  species: Species[];
  today: string;
  lang: Lang;
  /** Row tapped (step 5.7: select the place). The list never moves the map. */
  onSelect?: (placeId: string) => void;
  /** Phones: the sheet's tab row (一覧 | 凡例, ×) in place of the plain count line. */
  head?: ReactNode;
}

export default function PlaceList({ places, bounds, species, today, lang, onSelect, head }: Props) {
  const rows = listedPlaces(places, bounds);
  return (
    <aside className="place-list" aria-label={t('listLabel', lang)}>
      {head ?? <div className="list-count">{listCountText(rows.length, lang)}</div>}
      {rows.length === 0 && (
        <p className="list-empty">{t(places.length ? 'listEmpty' : 'noMatches', lang)}</p>
      )}
      <ul>
        {rows.map((ps) => {
          const pin = ps.pin!;
          const look = pinLook(ps, lang)!;
          const status = rowText(pin, today, lang);
          return (
            <li key={ps.place.id}>
              <button type="button" className="list-row" onClick={() => onSelect?.(ps.place.id)}>
                <span
                  className="pin list-pin"
                  style={{ '--ring': look.ring } as React.CSSProperties}
                  aria-hidden="true"
                >
                  <img alt="" src={look.photo} className={`photo-${look.photoFilter}`} />
                </span>
                <span className="list-body">
                  <span className="list-name">
                    <strong>{placeName(ps, lang)}</strong>
                    {ps.closed && <span className="pill-closed">{t('closedToday', lang)}</span>}
                  </span>
                  <span className="list-feature">
                    {featureName(pin, ps, species, lang)}
                    <StageTag s={pin} lang={lang} />
                  </span>
                  <StatusLine status={status} />
                  {ps.festivals.map((f) => (
                    <span key={f.id} className="list-fest">
                      {(lang === 'en' && f.name_en) || f.name_ja}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

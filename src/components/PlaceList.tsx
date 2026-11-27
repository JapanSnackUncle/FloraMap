import type { ReactNode } from 'react';
import { t, type Lang } from '../i18n';
import { featureName, placeName, stageColor, stageLabel } from '../labels';
import type { Species } from '../lib/schema';
import { compareFeatures, RING_COLORS, type PlaceStatus } from '../lib/status';
import { rowText } from '../listText';
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
  /** At the end of the count line (phones: the full list's 閉じる). */
  countAction?: ReactNode;
}

const inside = (ps: PlaceStatus, [w, s, e, n]: ViewBounds) =>
  ps.place.lng >= w && ps.place.lng <= e && ps.place.lat >= s && ps.place.lat <= n;

/** Places that pass the filter and are on screen, best pin first (CLAUDE.md, "List"). */
function listedPlaces(places: PlaceStatus[], bounds: ViewBounds | null): PlaceStatus[] {
  return places
    .filter((ps) => ps.pin && (!bounds || inside(ps, bounds)))
    .sort((a, b) => compareFeatures(a.pin!, b.pin!));
}

export default function PlaceList({
  places,
  bounds,
  species,
  today,
  lang,
  onSelect,
  countAction,
}: Props) {
  const rows = listedPlaces(places, bounds);
  const count = t('listCount', lang)
    .replace('{n}', String(rows.length))
    .replace('{m}', String(places.length));
  return (
    <aside className="place-list" aria-label={t('listLabel', lang)}>
      {/* data-peek: a phone's sheet at peek height shows down to here. */}
      <div className="list-count" data-peek="">
        <span>{count}</span>
        {countAction}
      </div>
      {rows.length === 0 && (
        <p className="list-empty">{t(places.length ? 'listEmpty' : 'noMatches', lang)}</p>
      )}
      <ul>
        {rows.map((ps) => {
          const pin = ps.pin!;
          const look = pinLook(ps, lang)!;
          const color = stageColor(pin);
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
                    <span
                      className={`stage-tag${color === RING_COLORS.track ? ' muted' : ''}`}
                      style={color === RING_COLORS.track ? undefined : { background: color }}
                    >
                      {stageLabel(pin, lang)}
                    </span>
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

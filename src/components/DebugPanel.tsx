import type { Lang } from '../i18n';
import type { Species } from '../lib/schema';
import { featureName, stageColor, stageLabel } from '../labels';
import { rank, RING_COLORS, type PlaceStatus } from '../lib/status';

interface Props {
  statuses: PlaceStatus[];
  species: Species[];
  lang: Lang;
  onSelect: (placeId: string) => void;
}

/** Dev-only: every place's pin choice and the reason for it, best pins first. */
export default function DebugPanel({ statuses, species, lang, onSelect }: Props) {
  const sorted = [...statuses].sort(
    (a, b) =>
      (b.pin ? rank(b.pin) : 0) - (a.pin ? rank(a.pin) : 0) || a.place.id.localeCompare(b.place.id),
  );
  return (
    <aside className="debug-panel" aria-label="Pin reasons">
      {sorted.map((ps) => {
        const pin = ps.pin;
        const name = (lang === 'en' && ps.place.name_en) || ps.place.name_ja;
        return (
          <button
            key={ps.place.id}
            type="button"
            className="debug-row"
            onClick={() => onSelect(ps.place.id)}
          >
            <span className="debug-row-head">
              <span
                className={`debug-swatch${pin && !pin.confirmed ? ' thin' : ''}`}
                style={{ borderColor: pin ? stageColor(pin) : RING_COLORS.track }}
              />
              <strong>{name}</strong>
              {ps.closed && <span className="debug-chip closed">本日休園</span>}
              {ps.festivals.length > 0 && <span className="debug-chip fest">祭</span>}
            </span>
            {pin && (
              <span className="debug-row-body">
                {featureName(pin, ps, species, lang)} · {stageLabel(pin, lang)} ·{' '}
                {pin.confirmed ? 'full ring' : 'thin ring'}
                {pin.peakSoon ? ' · clock' : ''}
                {pin.type === 'planting' && pin.noRecentInfo ? ' · no recent info' : ''}
                <br />
                <span className="debug-why">{pin.why}</span>
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { LEGEND_PIN } from '../config';
import { t, type Lang } from '../i18n';
import { LEGEND_ROWS, legendCells, type LegendCell, type LegendRow } from '../legend';
import { drawPin, pinStyle } from '../pins';

interface RowsProps {
  rows: Set<LegendRow>;
  /** Species id → its pin close-up, as on the map. */
  pinSrc: Record<string, string | undefined>;
  lang: Lang;
}

/** Rows after these share one line: シーズン外 and the festival dot. */
const STAGE_ROWS: readonly LegendRow[] = ['bloom', 'foliage', 'illumination'];

/**
 * Phones (CLAUDE.md, "Legend"): the 凡例 tab's content in the sheet, under the tab row.
 * data-fit on the rows: the sheet's own-height rest ends there.
 */
export default function LegendTab(props: RowsProps & { head: ReactNode }) {
  return (
    <aside className="legend legend-tab" aria-label={t('legend', props.lang)}>
      {props.head}
      <LegendRows {...props} fit />
    </aside>
  );
}

/**
 * Desktop: the 凡例 button in the map's lower-left corner. Open, the legend grows out of it: one
 * rounded card with the rows on top and the button on its bottom edge. No ×: the button closes
 * it again.
 */
export function LegendDock(props: RowsProps & { open: boolean; onToggle: () => void }) {
  const { open, onToggle, lang } = props;
  return (
    <div className={`legend legend-dock${open ? ' open' : ''}`}>
      {open && <LegendRows {...props} />}
      <div className="legend-foot">
        <button type="button" className="chip legend-btn" aria-expanded={open} onClick={onToggle}>
          {t('legend', lang)}
        </button>
      </div>
    </div>
  );
}

function LegendRows({ rows, pinSrc, lang, fit = false }: RowsProps & { fit?: boolean }) {
  const shown = LEGEND_ROWS.filter((r) => rows.has(r));
  const lines = [
    ...shown.filter((r) => STAGE_ROWS.includes(r)).map((r) => legendCells(r, pinSrc, lang)),
    shown.filter((r) => !STAGE_ROWS.includes(r)).flatMap((r) => legendCells(r, pinSrc, lang)),
  ].filter((line) => line.length > 0);
  return (
    <div className="legend-rows" data-fit={fit ? '' : undefined}>
      {lines.map((line, i) => (
        <div key={i} className="legend-row">
          {line.map((cell, j) => (
            <div key={j} className="legend-cell">
              <LegendPin cell={cell} />
              <span>{cell.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LegendPin({ cell }: { cell: LegendCell }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) drawPin(ref.current, cell.look, '');
  }, [cell]);
  return <div ref={ref} style={pinStyle(LEGEND_PIN)} aria-hidden="true" />;
}

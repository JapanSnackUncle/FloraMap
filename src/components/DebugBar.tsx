import { addDays, todayJst } from '../lib/dates';

// Season presets: a typical day in each season of the 2026–27 plan.
const PRESETS: { label: string; date: string }[] = [
  { label: 'Autumn leaves', date: '2026-11-20' },
  { label: 'Illuminations', date: '2026-12-15' },
  { label: 'Plum', date: '2027-02-25' },
  { label: 'Cherry', date: '2027-04-03' },
  { label: 'Nemophila', date: '2027-04-25' },
  { label: 'Roses', date: '2027-05-25' },
  { label: 'Hydrangea', date: '2027-06-25' },
  { label: 'Summer', date: '2027-08-15' },
];

interface Props {
  date: string;
  isOverride: boolean;
  setDate: (d: string | null) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

/** Dev-only date override (CLAUDE.md, "Debug mode"). Never rendered in production builds. */
export default function DebugBar({ date, isOverride, setDate, panelOpen, setPanelOpen }: Props) {
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return (
    <div className="debug-bar" role="toolbar" aria-label="Debug date">
      <span className="debug-tag">DEBUG</span>
      <button type="button" onClick={() => setDate(addDays(date, -7))}>
        −7
      </button>
      <button type="button" onClick={() => setDate(addDays(date, -1))}>
        −1
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        aria-label="Date"
      />
      <span className="debug-weekday">{weekday}</span>
      <button type="button" onClick={() => setDate(addDays(date, 1))}>
        +1
      </button>
      <button type="button" onClick={() => setDate(addDays(date, 7))}>
        +7
      </button>
      <button type="button" onClick={() => setDate(null)} disabled={!isOverride} title={todayJst()}>
        Today
      </button>
      <select
        value=""
        onChange={(e) => e.target.value && setDate(e.target.value)}
        aria-label="Season preset"
      >
        <option value="">Season…</option>
        {PRESETS.map((p) => (
          <option key={p.date} value={p.date}>
            {p.label} ({p.date.slice(5)})
          </option>
        ))}
      </select>
      <label className="debug-toggle">
        <input
          type="checkbox"
          checked={panelOpen}
          onChange={(e) => setPanelOpen(e.target.checked)}
        />
        Why panel
      </label>
    </div>
  );
}

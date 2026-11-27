import type { RowText } from '../listText';

/** A feature's status line in the list and on the place page: main part, then the smaller
 *  secondary part (CLAUDE.md, Status lines). Nothing when both are empty. */
export default function StatusLine({ status }: { status: RowText }) {
  if (!status.main && !status.sub) return null;
  return (
    <span className="list-status">
      {status.main && <span className="status-main">{status.main}</span>}
      {status.sub && (
        <span className={`status-sub${status.aging ? ' aging' : ''}`}>{status.sub}</span>
      )}
    </span>
  );
}

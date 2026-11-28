import type { CSSProperties } from 'react';
import type { Lang } from '../i18n';
import { stageColor, stageLabel } from '../labels';
import { RING_COLORS, type FeatureState } from '../lib/status';

/**
 * A feature's stage as a pill (list rows and the place page). Tinted: a pale shade of the stage's
 * ring colour behind a dark shade of it (styles.css .stage-tag), so the text is always dark on
 * light whatever the stage. まもなく / シーズン外 / unlit use the grey "muted" pill.
 */
export default function StageTag({ s, lang }: { s: FeatureState; lang: Lang }) {
  const color = stageColor(s);
  const muted = color === RING_COLORS.track;
  return (
    <span
      className={`stage-tag${muted ? ' muted' : ''}`}
      style={muted ? undefined : ({ '--stage': color } as CSSProperties)}
    >
      {stageLabel(s, lang)}
    </span>
  );
}

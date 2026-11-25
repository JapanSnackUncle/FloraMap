import type { Lang } from './i18n';
import { ILLUMINATION_LABELS, RING_COLORS, STAGE_LABELS, type FeatureState } from './lib/status';

/** The stage name shown for a feature: まもなく / 咲き始め / … or 点灯中 etc. */
export function stageLabel(s: FeatureState, lang: Lang): string {
  if (s.type === 'illumination') return ILLUMINATION_LABELS[s.state][lang];
  return STAGE_LABELS[s.kind][s.level][lang];
}

/** Ring colour for a feature's stage (CLAUDE.md, Map UI). */
export function stageColor(s: FeatureState): string {
  if (s.type === 'illumination') return s.state === 'lit' ? RING_COLORS.lit : RING_COLORS.track;
  if (s.level === 0 || s.level === 4) return RING_COLORS.track;
  return RING_COLORS[s.kind][s.level];
}

import { useSyncExternalStore } from 'react';
import { PHONE_MAX_WIDTH } from './config';

// Phone layout (CLAUDE.md): decided here once, in JS, so CSS only reads the .phone class.
const query = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH - 0.02}px)`);

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** True while the viewport is narrower than PHONE_MAX_WIDTH. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => query.matches);
}

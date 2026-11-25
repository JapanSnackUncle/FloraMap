import { useEffect, useState } from 'react';
import type { PublicData } from './lib/schema';

/** Load public/data/places.json (written by scripts/build-data.ts). */
export async function loadData(): Promise<PublicData> {
  const res = await fetch('/data/places.json');
  if (!res.ok) throw new Error(`places.json: HTTP ${res.status}`);
  return (await res.json()) as PublicData;
}

export function useData(): { data: PublicData | null; error: string | null } {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadData().then(
      (d) => !cancelled && setData(d),
      (e: unknown) => !cancelled && setError(String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, error };
}

// Placeholder "photos" until real ones exist (CLAUDE.md, Phase 1 task 5): a flat drawing in the
// species' colour, flowers as petals and leaves as stars, illuminations as lights on a night sky.
// Generated as SVG data URLs and cached.

const COLORS: Record<string, string> = {
  ume: '#E58FB0',
  sakura: '#F5BFD0',
  hanamomo: '#EA5E8E',
  nanohana: '#EEDB2E',
  narcissus: '#F3D03C',
  tulip: '#E5483F',
  nemophila: '#7DB8EC',
  shibazakura: '#EE7FB8',
  azalea: '#DD4486',
  wisteria: '#9B7FD4',
  peony: '#E86A92',
  poppy: '#F2803A',
  rose: '#D23558',
  iris: '#7A4FB5',
  hydrangea: '#7489DD',
  lotus: '#F2A1B6',
  sunflower: '#F3BB1E',
  hagi: '#BE62A2',
  cosmos: '#EC7FB0',
  hamanasu: '#D9437A',
  'kochia-green': '#6BA84F',
  'kochia-red': '#C8323C',
  momiji: '#D2502A',
  ginkgo: '#E8C02A',
};
const FALLBACK = '#C9A3B3';

const cache = new Map<string, string>();

const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const POINTS: [number, number, number][] = [
  [30, 34, 15],
  [70, 26, 12],
  [52, 62, 17],
  [18, 74, 11],
  [84, 70, 13],
  [44, 92, 9],
  [90, 40, 8],
];

function flowers(c: string): string {
  let g = '';
  for (const [x, y, r] of POINTS) {
    for (let i = 0; i < 5; i++) {
      g += `<ellipse cx="${x}" cy="${y - r * 0.5}" rx="${r * 0.42}" ry="${r * 0.55}" fill="${c}" transform="rotate(${i * 72} ${x} ${y})" stroke="rgba(255,255,255,.6)" stroke-width=".8"/>`;
    }
    g += `<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#F6D365"/>`;
  }
  return bg('#EAF2E3', '#8FB07A') + g;
}

function leaves(c: string): string {
  let g = '';
  for (const [x, y, r] of POINTS) {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = ((i * 72 - 90) * Math.PI) / 180;
      const b = a + (36 * Math.PI) / 180;
      p += `${x + Math.cos(a) * r},${y + Math.sin(a) * r} ${x + Math.cos(b) * r * 0.45},${y + Math.sin(b) * r * 0.45} `;
    }
    g += `<polygon points="${p}" fill="${c}" stroke="rgba(0,0,0,.15)" stroke-width="1"/>`;
  }
  return bg('#F3E6D3', '#7E8F5A') + g;
}

function lights(): string {
  const pts: [number, number, number][] = [
    [18, 30, 7],
    [40, 18, 5],
    [62, 34, 9],
    [84, 22, 6],
    [28, 62, 10],
    [52, 70, 6],
    [76, 60, 8],
    [12, 84, 5],
    [90, 86, 7],
    [46, 46, 4],
    [66, 88, 5],
  ];
  return (
    bg('#1B1F3B', '#3B2F5C') +
    pts
      .map(
        ([x, y, q]) =>
          `<circle cx="${x}" cy="${y}" r="${q}" fill="${q % 2 ? '#F5D46B' : '#FFF4D6'}" opacity="${0.55 + q / 25}"/>`,
      )
      .join('')
  );
}

function bg(top: string, bottom: string): string {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>`;
}

/** Placeholder photo for a planting (species + kind) or an illumination. */
export function placeholderPhoto(
  feature:
    { type: 'planting'; species: string; kind: 'bloom' | 'foliage' } | { type: 'illumination' },
): string {
  const key =
    feature.type === 'illumination' ? 'illumination' : `${feature.species}:${feature.kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let body: string;
  if (feature.type === 'illumination') body = lights();
  else {
    const c = COLORS[feature.species] ?? FALLBACK;
    body = feature.kind === 'foliage' ? leaves(c) : flowers(c);
  }
  const url = dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${body}</svg>`,
  );
  cache.set(key, url);
  return url;
}

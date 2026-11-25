// UI strings. Japanese is the default; every key needs both languages.
export type Lang = 'ja' | 'en';

export const strings = {
  appTitle: { ja: '茨城フローラマップ', en: 'Ibaraki Flora Map' },
  switchLang: { ja: 'English', en: '日本語' },
  filterInSeason: { ja: 'シーズン中', en: 'In season' },
  filterPeak: { ja: '見頃のみ', en: 'Peak only' },
  filterFestivals: { ja: '開催中のイベント', en: 'Events on' },
  filterIlluminations: { ja: 'イルミネーション', en: 'Illuminations' },
  filterAll: { ja: 'すべて表示', en: 'Show all' },
  filtersLabel: { ja: '表示する場所', en: 'Places to show' },
  noMatches: { ja: '該当する場所はありません', en: 'No places match' },
  loadError: {
    ja: 'データを読み込めませんでした。再読み込みしてください。',
    en: 'Could not load the data. Please reload.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}

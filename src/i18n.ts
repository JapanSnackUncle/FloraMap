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
  listLabel: { ja: '場所の一覧', en: 'Places' },
  listCount: { ja: '表示範囲内 {n}件 · 全{m}件', en: '{n} in view · {m} in all' },
  listEmpty: {
    ja: 'この範囲に該当する場所はありません。地図を動かすか縮小してください。',
    en: 'No matching places here. Move or zoom out the map.',
  },
  closedToday: { ja: '本日休園', en: 'Closed today' },
  back: { ja: '一覧に戻る', en: 'Back to list' },
  source: { ja: '情報源', en: 'Source' },
  visitorInfo: { ja: '施設情報', en: 'Visitor info' },
  hours: { ja: '営業時間', en: 'Hours' },
  closedDays: { ja: '休業日', en: 'Closed' },
  fees: { ja: '料金', en: 'Fees' },
  parking: { ja: '駐車場', en: 'Parking' },
  address: { ja: '住所', en: 'Address' },
  officialSite: { ja: '公式サイト', en: 'Official site' },
  nightEvents: { ja: '夜の催し', en: 'Evening events' },
  outOfSeason: { ja: 'シーズン外', en: 'Out of season' },
  loadError: {
    ja: 'データを読み込めませんでした。再読み込みしてください。',
    en: 'Could not load the data. Please reload.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}

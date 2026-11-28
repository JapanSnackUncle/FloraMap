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
  // The places in the visible map area (CLAUDE.md, "List"); English has a singular.
  listCount: { ja: '一覧（{n}か所）', en: 'List ({n} places)' },
  listCountOne: { ja: '一覧（1か所）', en: 'List (1 place)' },
  listEmpty: {
    ja: 'この範囲に該当する場所はありません。地図を動かすか縮小してください。',
    en: 'No matching places here. Move or zoom out the map.',
  },
  closedToday: { ja: '本日休園', en: 'Closed today' },
  back: { ja: '一覧に戻る', en: 'Back to list' },
  /** Phones: a place page's ← when it was opened from the 凡例 tab. */
  backToLegend: { ja: '凡例に戻る', en: 'Back to legend' },
  /** Phones: closes a place page, or lowers the full list, back to the map (list at peek). */
  close: { ja: '閉じる', en: 'Close' },
  /** Phones: the sheet's grab bar (screen readers; tapping it changes the sheet's height). */
  sheetHandle: { ja: 'パネルの高さを変える', en: 'Resize panel' },
  /** The place photo strip's ‹ › buttons (mouse; phones swipe). */
  photoPrev: { ja: '前の写真', en: 'Previous photo' },
  photoNext: { ja: '次の写真', en: 'Next photo' },
  /** Debug builds only: where a place's photo strip will go. */
  photoPlaceholder: { ja: '場所の写真（仮）', en: 'Place photo (placeholder)' },
  source: { ja: '情報源', en: 'Source' },
  visitorInfo: { ja: '施設情報', en: 'Visitor info' },
  hours: { ja: '営業時間', en: 'Hours' },
  closedDays: { ja: '休業日', en: 'Closed' },
  fees: { ja: '料金', en: 'Fees' },
  parking: { ja: '駐車場', en: 'Parking' },
  /** The place name's reading (Japanese mode only). */
  reading: { ja: 'よみ', en: 'Reading' },
  address: { ja: '住所', en: 'Address' },
  officialSite: { ja: '公式サイト', en: 'Official site' },
  nightEvents: { ja: '夜の催し', en: 'Evening events' },
  outOfSeason: { ja: 'シーズン外', en: 'Out of season' },
  /** The map legend (CLAUDE.md, "Legend"): its button, and its festival dot label. */
  legend: { ja: '凡例', en: 'Legend' },
  legendFestival: { ja: 'イベント開催中', en: 'Festival on' },
  /** Hover text on a group pin: the best place's name and how many more. */
  groupMore: { ja: '{name} +{n}', en: '{name} +{n}' },
  loadError: {
    ja: 'データを読み込めませんでした。再読み込みしてください。',
    en: 'Could not load the data. Please reload.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}

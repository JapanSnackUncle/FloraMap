// UI strings. Japanese is the default; every key needs both languages.
export type Lang = 'ja' | 'en';

export const strings = {
  appTitle: { ja: '茨城フローラマップ', en: 'Ibaraki Flora Map' },
  switchLang: { ja: 'English', en: '日本語' },
  loadError: {
    ja: 'データを読み込めませんでした。再読み込みしてください。',
    en: 'Could not load the data. Please reload.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}

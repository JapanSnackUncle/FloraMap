// UI strings. Japanese is the default; every key needs both languages.
export type Lang = 'ja' | 'en';

export const strings = {
  appTitle: { ja: '茨城フローラマップ', en: 'Ibaraki Flora Map' },
  comingSoon: { ja: '準備中', en: 'Coming soon' },
  switchLang: { ja: 'English', en: '日本語' },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}

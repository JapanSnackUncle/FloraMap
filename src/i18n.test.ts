import { describe, expect, it } from 'vitest';
import { initialLang, strings } from './i18n';

describe('initialLang', () => {
  it('follows the device: Japanese first → ja, anything else → en', () => {
    expect(initialLang(null, ['ja-JP', 'en-US'])).toBe('ja');
    expect(initialLang(null, ['ja'])).toBe('ja');
    expect(initialLang(null, ['en-US', 'ja-JP'])).toBe('en');
    expect(initialLang(null, ['zh-TW'])).toBe('en');
  });
  it('uses a saved choice over the device language', () => {
    expect(initialLang('en', ['ja-JP'])).toBe('en');
    expect(initialLang('ja', ['fr-FR'])).toBe('ja');
  });
  it('ignores a saved value that is not a language, and defaults to ja with no device language', () => {
    expect(initialLang('de', ['en-US'])).toBe('en');
    expect(initialLang(null, [])).toBe('ja');
  });
});

describe('UI strings', () => {
  it('has non-empty Japanese and English for every key', () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.ja, `${key}.ja`).not.toBe('');
      expect(value.en, `${key}.en`).not.toBe('');
    }
  });
});

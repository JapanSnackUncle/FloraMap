import { describe, expect, it } from 'vitest';
import { strings } from './i18n';

describe('UI strings', () => {
  it('has non-empty Japanese and English for every key', () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.ja, `${key}.ja`).not.toBe('');
      expect(value.en, `${key}.en`).not.toBe('');
    }
  });
});

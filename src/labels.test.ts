import { describe, expect, it } from 'vitest';
import { accessibleParkingText, breakName, petsText } from './labels';
import type { PlaceStatus } from './lib/status';

type Place = PlaceStatus['place'];
const place = (fields: Partial<Place>) => fields as Place;

// CLAUDE.md, "Pets and disabled parking".
describe('petsText', () => {
  it('is empty when pets is', () => {
    expect(petsText(place({}), 'ja')).toBe('');
  });

  it('says 可 / Allowed, with the note in brackets', () => {
    expect(petsText(place({ pets: 'allowed' }), 'ja')).toBe('可');
    expect(petsText(place({ pets: 'allowed' }), 'en')).toBe('Allowed');
    const leash = place({
      pets: 'allowed',
      pets_note_ja: 'リード着用',
      pets_note_en: 'on a leash',
    });
    expect(petsText(leash, 'ja')).toBe('可（リード着用）');
    expect(petsText(leash, 'en')).toBe('Allowed (on a leash)');
  });

  it('adds 補助犬は可 to every 不可, sharing the brackets with a note', () => {
    expect(petsText(place({ pets: 'not_allowed' }), 'ja')).toBe('不可（補助犬は可）');
    expect(petsText(place({ pets: 'not_allowed' }), 'en')).toBe(
      'Not allowed (assistance dogs welcome)',
    );
    const note = place({ pets: 'not_allowed', pets_note_ja: '駐車場まで可' });
    expect(petsText(note, 'ja')).toBe('不可（補助犬は可、駐車場まで可）');
  });

  it('falls back to the Japanese note in English mode', () => {
    expect(petsText(place({ pets: 'allowed', pets_note_ja: 'リード着用' }), 'en')).toBe(
      'Allowed (リード着用)',
    );
  });
});

describe('accessibleParkingText', () => {
  it('says あり / なし, and nothing when empty', () => {
    expect(accessibleParkingText(place({ accessible_parking: true }), 'ja')).toBe('あり');
    expect(accessibleParkingText(place({ accessible_parking: false }), 'en')).toBe('None');
    expect(accessibleParkingText(place({}), 'ja')).toBe('');
  });
});

// CLAUDE.md, "Place names": English names over 16 characters go on two lines.
describe('breakName', () => {
  it('keeps names of 16 characters or fewer on one line', () => {
    expect(breakName('Kairakuen')).toBe('Kairakuen');
    expect(breakName('Kodomo no Kuni 16')).toBe('Kodomo no\nKuni 16'); // 17: breaks
    expect(breakName('Kasama Inari Jin')).toBe('Kasama Inari Jin'); // exactly 16
  });

  it('breaks at the space that makes the longer line shortest', () => {
    expect(breakName('Kitaibaraki Hydrangea Forest')).toBe('Kitaibaraki\nHydrangea Forest');
    expect(breakName('Water and Green Fureai Park')).toBe('Water and Green\nFureai Park');
    expect(breakName('Hitachi Seaside Park')).toBe('Hitachi\nSeaside Park');
  });

  it('puts the shorter line on top in a tie', () => {
    expect(breakName('Ryujin Suspension Bridge')).toBe('Ryujin\nSuspension Bridge');
  });

  it('breaks only at spaces', () => {
    expect(breakName('Kirakuyama Fureai-no-Oka')).toBe('Kirakuyama\nFureai-no-Oka');
    expect(breakName('Averyveryverylongname-with-hyphens')).toBe(
      'Averyveryverylongname-with-hyphens',
    );
  });
});

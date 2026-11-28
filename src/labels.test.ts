import { describe, expect, it } from 'vitest';
import { breakName } from './labels';

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

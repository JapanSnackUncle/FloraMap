import { describe, expect, it } from 'vitest';
import { rowText, usualWindowText } from './listText';
import type { IlluminationState, PlantingState } from './lib/status';

const W = { start: '2027-02-21', end: '2027-03-10' };

function planting(over: Partial<PlantingState>): PlantingState {
  return {
    type: 'planting',
    id: 'p',
    kind: 'bloom',
    level: 2,
    confirmed: false,
    basis: 'usual-window',
    noRecentInfo: false,
    peakSoon: false,
    featured: false,
    window: W,
    why: '',
    ...over,
  };
}

function lights(over: Partial<IlluminationState>): IlluminationState {
  return {
    type: 'illumination',
    id: 'l',
    state: 'lit',
    confirmed: true,
    from: '2026-11-01',
    to: '2027-01-31',
    peakSoon: false,
    featured: false,
    why: '',
    ...over,
  };
}

const report = (date: string, kind = 'official', detail?: string) =>
  ({ planting_id: 'p', date, level: 1, kind, source_id: 's', detail }) as PlantingState['report'];

describe('usualWindowText', () => {
  it('gives month thirds in both languages', () => {
    expect(usualWindowText(W, 'ja')).toBe('例年 2月下旬〜3月上旬');
    expect(usualWindowText(W, 'en')).toBe('Usually late Feb – early Mar');
  });
  it('collapses a single third', () => {
    expect(usualWindowText({ start: '2027-04-11', end: '2027-04-20' }, 'ja')).toBe('例年 4月中旬');
  });
});

describe('rowText', () => {
  const today = '2027-02-25';

  it('report: detail, source and age', () => {
    const s = planting({
      basis: 'report',
      confirmed: true,
      freshness: 'fresh',
      report: report('2027-02-23', 'official', '3分'),
      ageDays: 2,
    });
    expect(rowText(s, today, 'ja')).toEqual({ main: '3分', sub: '公式（2日前）', aging: false });
    expect(rowText(s, today, 'en')).toMatchObject({ main: '3分', sub: 'Official (2 days ago)' });
  });

  it('report today, and an aging report is flagged', () => {
    const s = planting({
      basis: 'report',
      freshness: 'aging',
      report: report(today, 'admin'),
      ageDays: 0,
    });
    // No 分咲き figure: source and age stay secondary, alone.
    expect(rowText(s, today, 'ja')).toEqual({ main: '', sub: '編集部（今日）', aging: true });
  });

  it('estimate from the usual window', () => {
    expect(rowText(planting({}), today, 'ja')).toMatchObject({
      main: '例年 2月下旬〜3月上旬',
      sub: '',
    });
  });

  it('forecast', () => {
    const s = planting({ basis: 'forecast', report: report('2027-02-24', 'forecast') });
    expect(rowText(s, today, 'ja').main).toBe('予想（2/24時点）');
  });

  it('stale report, with no recent info', () => {
    const s = planting({
      basis: 'last-report',
      report: report('2027-01-30'),
      noRecentInfo: true,
    });
    expect(rowText(s, today, 'ja')).toMatchObject({ main: '最近の情報なし', sub: '最終確認 1/30' });
    expect(rowText(s, today, 'en')).toMatchObject({
      main: 'No recent info',
      sub: 'Last checked 1/30',
    });
  });

  it('off season shows the next usual window, or nothing', () => {
    const next = { start: '2028-02-21', end: '2028-03-10' };
    expect(
      rowText(planting({ basis: 'off-season', level: 4, nextWindow: next }), today, 'ja').main,
    ).toBe('次回 例年 2月下旬〜3月上旬');
    expect(
      rowText(planting({ basis: 'off-season', level: 4, window: undefined }), today, 'ja'),
    ).toMatchObject({ main: '', sub: '' });
  });

  it('lit illumination: tonight’s hours and the end date', () => {
    const s = lights({ hoursJa: '16:30〜20:00' });
    expect(rowText(s, '2026-12-15', 'ja')).toMatchObject({
      main: '今夜 16:30〜20:00',
      sub: '1/31まで',
    });
    // English shows the Japanese hours as they are (no hours_en for illuminations).
    expect(rowText(s, '2026-12-15', 'en')).toMatchObject({
      main: 'Tonight 16:30〜20:00',
      sub: 'until 1/31',
    });
  });

  it('lit illumination on a closed day: the next open night instead of tonight', () => {
    const s = lights({
      hoursJa: '17:00〜20:30',
      closedTonight: true,
      nextNight: { date: '2026-11-27', hoursJa: '17:00〜20:30' },
    });
    expect(rowText(s, '2026-11-26', 'ja')).toMatchObject({
      main: '次回 11/27（金）17:00〜20:30',
      sub: '1/31まで',
    });
    expect(rowText(s, '2026-11-26', 'en')).toMatchObject({
      main: 'Next: Fri 11/27, 17:00〜20:30',
      sub: 'until 1/31',
    });
    const last = lights({ closedTonight: true, nextNight: undefined });
    expect(rowText(last, '2027-01-31', 'ja')).toMatchObject({ main: '', sub: '1/31まで' });
  });

  it('illumination countdown only when announced', () => {
    expect(rowText(lights({ state: 'soon', countdownDays: 5 }), today, 'ja').main).toBe(
      '点灯まで あと5日',
    );
    expect(rowText(lights({ state: 'soon', confirmed: false }), today, 'ja').main).toBe(
      '日程未発表（昨年の日程で表示）',
    );
    expect(rowText(lights({ confirmed: false, hoursJa: '17:00〜21:00' }), today, 'ja').main).toBe(
      '日程未発表（昨年の日程で表示）',
    );
  });
});

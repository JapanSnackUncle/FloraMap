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
    expect(rowText(s, today, 'ja')).toEqual({ text: '3分 · 公式 · 2日前', aging: false });
    expect(rowText(s, today, 'en').text).toBe('3分 · Official · 2 days ago');
  });

  it('report today, and an aging report is flagged', () => {
    const s = planting({
      basis: 'report',
      freshness: 'aging',
      report: report(today, 'admin'),
      ageDays: 0,
    });
    expect(rowText(s, today, 'ja')).toEqual({ text: '編集部 · 今日', aging: true });
  });

  it('estimate from the usual window', () => {
    expect(rowText(planting({}), today, 'ja').text).toBe('例年 2月下旬〜3月上旬');
  });

  it('forecast', () => {
    const s = planting({ basis: 'forecast', report: report('2027-02-24', 'forecast') });
    expect(rowText(s, today, 'ja').text).toBe('予想（2/24時点）');
  });

  it('stale report, with no recent info', () => {
    const s = planting({
      basis: 'last-report',
      report: report('2027-01-30'),
      noRecentInfo: true,
    });
    expect(rowText(s, today, 'ja').text).toBe('最近の情報なし · 最終確認 1/30');
    expect(rowText(s, today, 'en').text).toBe('No recent info · Last checked 1/30');
  });

  it('off season shows the next usual window, or nothing', () => {
    const next = { start: '2028-02-21', end: '2028-03-10' };
    expect(
      rowText(planting({ basis: 'off-season', level: 4, nextWindow: next }), today, 'ja').text,
    ).toBe('次回 例年 2月下旬〜3月上旬');
    expect(
      rowText(planting({ basis: 'off-season', level: 4, window: undefined }), today, 'ja').text,
    ).toBe('');
  });

  it('lit illumination: tonight’s hours and the end date', () => {
    const s = lights({ hoursJa: '16:30–20:00' });
    expect(rowText(s, '2026-12-15', 'ja').text).toBe('今夜 16:30–20:00 · 1/31まで');
    expect(rowText(s, '2026-12-15', 'en').text).toBe('Tonight 16:30–20:00 · until 1/31');
  });

  it('illumination countdown only when announced', () => {
    expect(rowText(lights({ state: 'soon', countdownDays: 5 }), today, 'ja').text).toBe(
      '点灯まで あと5日',
    );
    expect(rowText(lights({ state: 'soon', confirmed: false }), today, 'ja').text).toBe(
      '日程未発表（昨年の日程で表示）',
    );
    expect(rowText(lights({ confirmed: false, hoursJa: '17:00–21:00' }), today, 'ja').text).toBe(
      '日程未発表（昨年の日程で表示）',
    );
  });
});

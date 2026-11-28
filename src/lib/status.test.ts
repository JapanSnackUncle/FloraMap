import { describe, expect, it } from 'vitest';
import { buildData } from '../../scripts/build-data.ts';
import { addDays, daysBetween, seasonLabel, thirdEnd, todayJst, weekdayOf } from './dates';
import type { PublicFestival, PublicPlace, PublicPlanting, PublicStatus } from './schema';
import {
  choosePin,
  closedToday,
  closuresExpired,
  festivalsOn,
  illuminationState,
  pageOrder,
  passesFilter,
  pinForFilter,
  placeStatus,
  plantingState,
  type FeatureState,
  type PlantingState,
} from './status';

// ---------- builders

type Status = Partial<PublicStatus> & Pick<PublicStatus, 'date' | 'level'>;

function planting(
  over: Omit<Partial<PublicPlanting>, 'statuses'> & { statuses?: Status[] } = {},
): PublicPlanting {
  const { statuses = [], ...rest } = over;
  const defaults: Omit<PublicStatus, 'date' | 'level'> = {
    planting_id: 'p-ume',
    kind: 'official',
    source_id: 'src',
  };
  return {
    id: 'p-ume',
    kind: 'bloom',
    species: 'ume',
    windows: [{ start: '02-3', end: '03-1' }], // 2/21 – 3/10
    starting_days: 7, // 咲き始め 2/14 – 2/20, まもなく 1/31 – 2/13
    statuses: statuses.map((s) => ({ ...defaults, ...s })),
    ...rest,
  } as PublicPlanting;
}

type Illumination = PublicPlace['illuminations'][number];
function illumination(editions: Illumination['editions']): Illumination {
  return { id: 'p-lights', kind: 'illumination', name_ja: 'イルミ', editions };
}

function place(over: Partial<PublicPlace> = {}): PublicPlace {
  return {
    id: 'p',
    name_ja: '公園',
    prefecture: 'ibaraki',
    municipality: '水戸市',
    lat: 36.3,
    lng: 140.4,
    plantings: [],
    illuminations: [],
    one_off_closures: [],
    festival_ids: [],
    ...over,
  } as PublicPlace;
}

const state = (p: PublicPlanting, today: string) => plantingState(p, today);

// ---------- dates

describe('dates', () => {
  it("gives Japan's date, not the visitor's", () => {
    // 2027-02-21 23:30 in California is already 2027-02-22 16:30 in Japan.
    expect(todayJst(new Date('2027-02-22T07:30:00Z'))).toBe('2027-02-22');
    // 2027-02-22 08:59 JST is still 2027-02-21 23:59 UTC.
    expect(todayJst(new Date('2027-02-21T23:59:00Z'))).toBe('2027-02-22');
    expect(todayJst(new Date('2027-02-21T14:59:00Z'))).toBe('2027-02-21');
  });

  it('turns month-thirds into dates, including February and leap years', () => {
    expect(thirdEnd('02-3', 2027)).toBe('2027-02-28');
    expect(thirdEnd('02-3', 2028)).toBe('2028-02-29');
    expect(thirdEnd('04-2', 2027)).toBe('2027-04-20');
  });

  it('labels illumination seasons across the new year', () => {
    expect(seasonLabel('2026-11-30')).toBe('2026-27');
    expect(seasonLabel('2027-01-15')).toBe('2026-27');
    expect(seasonLabel('2027-07-01')).toBe('2027-28');
  });

  it('knows weekdays and day differences', () => {
    expect(weekdayOf('2027-02-23')).toBe('tue');
    expect(daysBetween('2027-02-27', '2027-03-02')).toBe(3);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

// ---------- lead window and off season

describe('usual window only (no reports)', () => {
  const p = planting(); // window 2/21 – 3/10

  it('is シーズン外 before the まもなく period', () => {
    expect(state(p, '2027-01-30')).toMatchObject({ level: 4, basis: 'off-season' });
  });

  it('is まもなく for 14 days before 咲き始め, as an estimate', () => {
    expect(state(p, '2027-01-31')).toMatchObject({
      level: 0,
      confirmed: false,
      basis: 'usual-window',
    });
    expect(state(p, '2027-02-13')).toMatchObject({ level: 0 });
  });

  it("is 咲き始め for the species' starting_days before the window, half filled", () => {
    expect(state(p, '2027-02-14')).toMatchObject({ level: 1, confirmed: false, bloomPct: 50 });
    expect(state(p, '2027-02-20')).toMatchObject({ level: 1 });
  });

  it('uses each species’ own number of 咲き始め days', () => {
    const quick = planting({ starting_days: 3 }); // 咲き始め 2/18 – 2/20
    expect(state(quick, '2027-02-17').level).toBe(0);
    expect(state(quick, '2027-02-18').level).toBe(1);
    const none = planting({ starting_days: 0 });
    expect(state(none, '2027-02-20').level).toBe(0);
    expect(state(none, '2027-02-21').level).toBe(2);
  });

  it('is 見頃 inside the window, 見頃過ぎ for 10 days after, then シーズン外', () => {
    expect(state(p, '2027-02-21').level).toBe(2);
    expect(state(p, '2027-03-10').level).toBe(2);
    expect(state(p, '2027-03-11').level).toBe(3);
    expect(state(p, '2027-03-20').level).toBe(3);
    expect(state(p, '2027-03-21').level).toBe(4);
  });

  it('points at next year’s window when out of season', () => {
    expect(state(p, '2027-06-01').window).toEqual({ start: '2028-02-21', end: '2028-03-10' });
  });

  it('never shows the clock badge from a usual window alone', () => {
    expect(state(p, '2027-02-18').peakSoon).toBe(false);
  });
});

describe('season rollover', () => {
  it('handles a window that crosses the new year', () => {
    const p = planting({ windows: [{ start: '12-3', end: '01-2' }] }); // 12/21 – 1/20
    expect(state(p, '2026-12-10').level).toBe(0);
    expect(state(p, '2027-01-05').level).toBe(2);
    expect(state(p, '2027-01-05').window).toEqual({ start: '2026-12-21', end: '2027-01-20' });
    expect(state(p, '2027-01-25').level).toBe(3);
  });

  it('handles a lead window that starts in the previous year', () => {
    const p = planting({ windows: [{ start: '01-1', end: '01-3' }] }); // 1/1 – 1/31
    expect(state(p, '2026-12-27').level).toBe(1);
    expect(state(p, '2026-12-20').level).toBe(0);
    expect(state(p, '2026-12-10').level).toBe(4);
  });

  it('uses the right one of two windows (spring and autumn roses)', () => {
    const p = planting({
      windows: [
        { start: '05-2', end: '06-1' },
        { start: '10-3', end: '11-1' },
      ],
    });
    expect(state(p, '2027-05-20').level).toBe(2);
    expect(state(p, '2027-08-01').level).toBe(4);
    expect(state(p, '2027-08-01').window?.start).toBe('2027-10-21');
    expect(state(p, '2027-10-25').level).toBe(2);
  });

  it("doesn't carry last season's reports into this season", () => {
    const p = planting({ statuses: [{ date: '2026-03-01', level: 2 }] });
    expect(state(p, '2027-02-10')).toMatchObject({ level: 0, basis: 'usual-window' });
  });
});

// ---------- reports and freshness

describe('reports', () => {
  it('shows a fresh report as confirmed, with its 分咲き as the ring fill', () => {
    const s = state(
      planting({ statuses: [{ date: '2027-02-20', level: 1, detail: '3分' }] }),
      '2027-02-22',
    );
    expect(s).toMatchObject({
      level: 1,
      confirmed: true,
      basis: 'report',
      freshness: 'fresh',
      ageDays: 2,
      bloomPct: 30,
    });
  });

  it('fills half when there is no 分咲き figure', () => {
    const s = state(planting({ statuses: [{ date: '2027-02-20', level: 1 }] }), '2027-02-21');
    expect(s.bloomPct).toBe(50);
  });

  it('marks it aging past the fresh limit (咲き始め: 3 / 6 days)', () => {
    const p = planting({ statuses: [{ date: '2027-02-15', level: 1 }] });
    expect(state(p, '2027-02-18').freshness).toBe('fresh');
    expect(state(p, '2027-02-19')).toMatchObject({ freshness: 'aging', confirmed: true });
    expect(state(p, '2027-02-21')).toMatchObject({ freshness: 'aging', confirmed: true });
  });

  it('uses the latest report', () => {
    const p = planting({
      statuses: [
        { date: '2027-02-18', level: 1 },
        { date: '2027-02-24', level: 2 },
      ],
    });
    expect(state(p, '2027-02-25')).toMatchObject({ level: 2, confirmed: true });
  });

  it('counts admin reports as confirmed, and ignores reports dated in the future', () => {
    const p = planting({
      statuses: [
        { date: '2027-02-20', level: 1, kind: 'admin', source_id: undefined },
        { date: '2027-03-01', level: 2 },
      ],
    });
    expect(state(p, '2027-02-21')).toMatchObject({ level: 1, confirmed: true });
  });
});

describe('never backwards', () => {
  it('keeps the highest confirmed level this season', () => {
    const p = planting({
      statuses: [
        { date: '2027-02-24', level: 2 },
        { date: '2027-02-26', level: 1, kind: 'admin', source_id: undefined },
      ],
    });
    expect(state(p, '2027-02-27').level).toBe(2);
  });

  it('a forecast cannot lower the level either', () => {
    const p = planting({
      statuses: [
        { date: '2027-02-01', level: 2 },
        { date: '2027-02-15', level: 1, kind: 'forecast' },
      ],
      windows: [{ start: '01-3', end: '03-2' }],
    });
    expect(state(p, '2027-02-20')).toMatchObject({ level: 2, basis: 'forecast' });
  });
});

describe('stale fallback', () => {
  // 見頃 limits: fresh 4, aging 8.
  const report = { date: '2027-02-22', level: 2 as const };

  it('1. uses a forecast dated after the last report, as an estimate', () => {
    const p = planting({ statuses: [report, { date: '2027-03-01', level: 3, kind: 'forecast' }] });
    expect(state(p, '2027-03-03')).toMatchObject({ level: 3, confirmed: false, basis: 'forecast' });
  });

  it('2. otherwise keeps the last confirmed stage, thin', () => {
    const p = planting({ statuses: [report] });
    expect(state(p, '2027-03-03')).toMatchObject({
      level: 2,
      confirmed: false,
      basis: 'last-report',
      ageDays: 9,
    });
  });

  it('ignores a forecast older than the report', () => {
    const p = planting({ statuses: [{ date: '2027-02-20', level: 3, kind: 'forecast' }, report] });
    expect(state(p, '2027-03-03')).toMatchObject({ basis: 'last-report', level: 2 });
  });

  it('3. uses a forecast when there is no report this season', () => {
    const p = planting({ statuses: [{ date: '2027-02-19', level: 1, kind: 'forecast' }] });
    expect(state(p, '2027-02-20')).toMatchObject({ level: 1, basis: 'forecast', confirmed: false });
  });

  it('flags no recent info after 3 weeks of silence', () => {
    const p = planting({
      windows: [{ start: '02-1', end: '04-1' }],
      statuses: [{ date: '2027-02-10', level: 1 }],
    });
    expect(state(p, '2027-03-03').noRecentInfo).toBe(false);
    expect(state(p, '2027-03-04')).toMatchObject({ noRecentInfo: true, confirmed: false });
  });

  it('ignores statuses older than 60 days', () => {
    const p = planting({
      windows: [{ start: '01-1', end: '04-3' }],
      statuses: [{ date: '2027-01-02', level: 1 }],
    });
    expect(state(p, '2027-03-03').basis).toBe('last-report');
    expect(state(p, '2027-03-04').basis).toBe('usual-window');
  });
});

describe('clock badge (planting)', () => {
  const official = { date: '2027-02-20', level: 1 as const };

  it('shows when an official report is current and a sourced forecast puts 見頃 within 5 days', () => {
    const p = planting({
      statuses: [official, { date: '2027-02-26', level: 2, kind: 'forecast' }],
    });
    expect(state(p, '2027-02-21').peakSoon).toBe(true);
  });

  it('not when the forecast is further out', () => {
    const p = planting({
      statuses: [official, { date: '2027-02-28', level: 2, kind: 'forecast' }],
    });
    expect(state(p, '2027-02-21').peakSoon).toBe(false);
  });

  it('not without an official report (admin only)', () => {
    const p = planting({
      statuses: [
        { ...official, kind: 'admin', source_id: undefined },
        { date: '2027-02-24', level: 2, kind: 'forecast' },
      ],
    });
    expect(state(p, '2027-02-21').peakSoon).toBe(false);
  });

  it('not for a forecast with no source', () => {
    const p = planting({
      statuses: [
        official,
        { date: '2027-02-24', level: 2, kind: 'forecast', source_id: undefined },
      ],
    });
    expect(state(p, '2027-02-21').peakSoon).toBe(false);
  });
});

// ---------- illuminations

describe('illuminations', () => {
  const announced = illumination([
    {
      season: '2026-27',
      from: '2026-11-07',
      to: '2027-01-31',
      dates_announced: true,
      hours: [
        { from: '2026-11-07', to: '2026-11-30', hours_ja: '16:30〜20:00' },
        { from: '2026-12-01', to: '2027-01-31', hours_ja: '16:30〜19:00' },
      ],
    },
  ]);

  it('is 点灯中 with tonight’s hours, which change by date', () => {
    expect(illuminationState(announced, '2026-11-25')).toMatchObject({
      state: 'lit',
      confirmed: true,
      hoursJa: '16:30〜20:00',
    });
    expect(illuminationState(announced, '2027-01-02')).toMatchObject({
      state: 'lit',
      hoursJa: '16:30〜19:00',
    });
  });

  it('is まもなく with a countdown within 14 days of announced dates, clock within 5', () => {
    expect(illuminationState(announced, '2026-10-24')).toMatchObject({
      state: 'soon',
      countdownDays: 14,
      peakSoon: false,
    });
    expect(illuminationState(announced, '2026-11-03')).toMatchObject({
      state: 'soon',
      countdownDays: 4,
      peakSoon: true,
    });
    expect(illuminationState(announced, '2026-10-23').state).toBe('off');
  });

  it('is シーズン外 after the run', () => {
    expect(illuminationState(announced, '2027-02-01').state).toBe('off');
  });

  it("uses last season's dates one year on when this season's aren't announced: thin, no countdown", () => {
    const placeholder = illumination([
      {
        season: '2025-26',
        from: '2025-11-28',
        to: '2025-12-25',
        dates_announced: true,
        hours: [{ from: '2025-11-28', to: '2025-12-25', hours_ja: '16:30〜20:30' }],
      },
      { season: '2026-27', dates_announced: false },
    ]);
    expect(illuminationState(placeholder, '2026-11-20')).toMatchObject({
      state: 'soon',
      confirmed: false,
      countdownDays: undefined,
      peakSoon: false,
      from: '2026-11-28',
    });
    expect(illuminationState(placeholder, '2026-12-01')).toMatchObject({
      state: 'lit',
      confirmed: false,
      hoursJa: '16:30〜20:30',
    });
  });
});

// ---------- closures

describe('closures', () => {
  const p = place({
    closures: {
      weekly: ['tue'],
      fixed_dates: ['12-31', '01-01'],
      dates_closed: ['2027-02-24'],
      dates_open: ['2027-02-23'],
      periods_open: [{ from: '2027-03-26', to: '2027-05-31' }],
      valid_until: '2027-06-30',
    },
    one_off_closures: [{ date: '2027-04-06' }],
  });

  it('applies the weekly day off', () => {
    expect(closedToday(p, '2027-02-16')).toBe(true); // Tue
    expect(closedToday(p, '2027-02-17')).toBe(false);
  });

  it('dates_open beats the weekly day off (holiday Tuesday)', () => {
    expect(closedToday(p, '2027-02-23')).toBe(false);
  });

  it('dates_closed and fixed dates close it', () => {
    expect(closedToday(p, '2027-02-24')).toBe(true);
    expect(closedToday(p, '2026-12-31')).toBe(true);
  });

  it('an open period beats the weekly day off', () => {
    expect(closedToday(p, '2027-04-13')).toBe(false); // Tue inside 3/26–5/31
  });

  it('a closures.csv row beats everything', () => {
    expect(closedToday(p, '2027-04-06')).toBe(true); // Tue inside the open period
  });

  it('no closures data means no pill', () => {
    expect(closedToday(place(), '2027-02-16')).toBe(false);
  });

  it('flags closures past valid_until', () => {
    expect(closuresExpired(p, '2027-06-30')).toBe(false);
    expect(closuresExpired(p, '2027-07-01')).toBe(true);
  });

  it('never changes the pin: a lit illumination stays gold on a closed day', () => {
    const lit = place({
      closures: { weekly: ['tue'] },
      illuminations: [
        illumination([
          { season: '2026-27', from: '2026-11-01', to: '2026-12-31', dates_announced: true },
        ]),
      ],
    });
    const ps = placeStatus(lit, [], '2026-11-17'); // Tuesday
    expect(ps.closed).toBe(true);
    expect(ps.pin).toMatchObject({ type: 'illumination', state: 'lit' });
  });

  describe('closed night during a lit run', () => {
    const lights = illumination([
      {
        season: '2026-27',
        from: '2026-11-01',
        to: '2026-12-31',
        dates_announced: true,
        hours: [
          { from: '2026-11-01', to: '2026-11-30', hours_ja: '17:00〜20:30' },
          { from: '2026-12-01', to: '2026-12-31', hours_ja: '17:00〜21:00' },
        ],
      },
    ]);
    const venue = (closures: PublicPlace['closures']) =>
      place({ closures, illuminations: [lights] });

    it('gives the next open night and its hours', () => {
      const ps = placeStatus(venue({ weekly: ['tue'] }), [], '2026-11-17'); // Tuesday
      expect(ps.pin).toMatchObject({
        state: 'lit',
        closedTonight: true,
        nextNight: { date: '2026-11-18', hoursJa: '17:00〜20:30' },
      });
    });

    it('skips several closed days, and picks up the new hours', () => {
      const ps = placeStatus(
        venue({ weekly: ['mon'], dates_closed: ['2026-12-01'] }),
        [],
        '2026-11-30', // Monday, then closed Tuesday 12/1 too
      );
      expect(ps.pin).toMatchObject({ nextNight: { date: '2026-12-02', hoursJa: '17:00〜21:00' } });
    });

    it('has no next night when the run ends first', () => {
      const ps = placeStatus(venue({ fixed_dates: ['12-31'] }), [], '2026-12-31');
      expect(ps.pin).toMatchObject({ closedTonight: true, nextNight: undefined });
    });

    it('leaves open nights alone', () => {
      const ps = placeStatus(venue({ weekly: ['tue'] }), [], '2026-11-18');
      expect(ps.pin).toMatchObject({ state: 'lit', hoursJa: '17:00〜20:30' });
      expect(ps.pin).not.toHaveProperty('closedTonight');
    });
  });
});

// ---------- pin choice

describe('pin choice', () => {
  const pin = (states: FeatureState[]) => choosePin(states)!;
  const ps = (over: Partial<PlantingState>): PlantingState => ({
    type: 'planting',
    id: 'x',
    kind: 'bloom',
    level: 2,
    confirmed: false,
    basis: 'usual-window',
    noRecentInfo: false,
    peakSoon: false,
    featured: false,
    why: '',
    ...over,
  });

  it('ranks 見頃 = lit illumination > 咲き始め > 見頃過ぎ > まもなく > シーズン外', () => {
    const lit = illuminationState(
      illumination([
        { season: '2026-27', from: '2027-03-01', to: '2027-03-31', dates_announced: true },
      ]),
      '2027-03-05',
    );
    const order = [
      ps({ id: 'off', level: 4 }),
      ps({ id: 'soon', level: 0 }),
      ps({ id: 'past', level: 3 }),
      ps({ id: 'start', level: 1 }),
      ps({ id: 'peak', level: 2 }),
    ];
    expect(pin([...order, lit]).id).toBe('p-lights'); // same tier as 見頃; announced beats estimate
    expect(pin(order).id).toBe('peak');
    expect(pin(order.slice(0, 4)).id).toBe('start');
    expect(pin(order.slice(0, 3)).id).toBe('past');
    expect(pin(order.slice(0, 2)).id).toBe('soon');
  });

  it('featured wins a tie but never jumps a rank', () => {
    const a = ps({ id: 'a', level: 2, window: { start: '2027-04-01', end: '2027-04-30' } });
    const b = ps({
      id: 'b',
      level: 2,
      featured: true,
      window: { start: '2027-04-01', end: '2027-04-10' },
    });
    expect(pin([a, b]).id).toBe('b');
    expect(pin([a, ps({ id: 'c', level: 1, featured: true })]).id).toBe('a');
  });

  const report = (over: Partial<PlantingState>) =>
    ps({ confirmed: true, basis: 'report', freshness: 'fresh', ...over });
  const litLights = (dates_announced: boolean) =>
    illuminationState(
      illumination([{ season: '2026-27', from: '2026-11-07', to: '2026-11-29', dates_announced }]),
      '2026-11-28',
    );

  it('puts a confirmed status before an estimate within a tier', () => {
    expect(pin([ps({ id: 'a' }), report({ id: 'b' })]).id).toBe('b');
    expect(pin([ps({ id: 'a', level: 1 }), report({ id: 'b', level: 1, bloomPct: 10 })]).id).toBe(
      'b',
    );
    // But never across tiers: a confirmed 咲き始め stays below an estimated 見頃.
    expect(pin([ps({ id: 'b', level: 2 }), report({ id: 'a', level: 1 })]).id).toBe('b');
  });

  it('on 2026-11-28 at 偕楽園: announced lights beat the estimated momiji, unannounced ones don’t', () => {
    const momiji = ps({
      id: 'kairakuen-momiji',
      window: { start: '2026-11-11', end: '2026-11-30' },
    });
    expect(pin([momiji, litLights(true)]).id).toBe('p-lights');
    // Both estimates: no featured on either, so the id decides.
    expect(pin([ps({ id: 'a-momiji' }), litLights(false)]).id).toBe('a-momiji');
  });

  it('puts fresh before aging; announced dates count as fresh', () => {
    expect(pin([report({ id: 'a', freshness: 'aging' }), report({ id: 'b' })]).id).toBe('b');
    expect(pin([report({ id: 'a', freshness: 'aging' }), litLights(true)]).id).toBe('p-lights');
  });

  it('a fresh report beats announced lights on a tie', () => {
    expect(pin([litLights(true), report({ id: 'z-momiji' })]).id).toBe('z-momiji');
  });

  it('ignores end dates: an ending-soon feature neither rises nor sinks', () => {
    const early = { start: '2027-04-01', end: '2027-04-10' };
    const late = { start: '2027-04-01', end: '2027-04-25' };
    expect(
      pin([ps({ id: 'a', level: 2, window: early }), ps({ id: 'b', level: 2, window: late })]).id,
    ).toBe('a');
    expect(
      pin([ps({ id: 'a', level: 3, window: early }), ps({ id: 'b', level: 3, window: late })]).id,
    ).toBe('a');
  });

  it('puts the higher bloom % first among 咲き始め', () => {
    expect(
      pin([
        report({ id: 'a', level: 1, bloomPct: 30 }),
        report({ id: 'b', level: 1, bloomPct: 50 }),
      ]).id,
    ).toBe('b');
  });

  it('puts the sooner start first among まもなく', () => {
    const a = ps({ id: 'a', level: 0, window: { start: '2027-04-10', end: '2027-04-20' } });
    const b = ps({ id: 'b', level: 0, window: { start: '2027-04-05', end: '2027-04-30' } });
    expect(pin([a, b]).id).toBe('b');
  });

  it('compares plantings and illuminations by start among まもなく', () => {
    const lights = illuminationState(
      illumination([
        { season: '2026-27', from: '2027-04-03', to: '2027-04-30', dates_announced: false },
      ]),
      '2027-03-25',
    );
    const a = ps({ id: 'a', level: 0, window: { start: '2027-04-10', end: '2027-04-20' } });
    expect(lights.state).toBe('soon');
    expect(pin([a, lights]).id).toBe('p-lights');
  });
});

// ---------- festivals, filters, page order

describe('festivals and filters', () => {
  const fest = {
    id: 'f',
    name_ja: '梅まつり',
    place_ids: ['p'],
    editions: [
      { id: 'f-2027', from: '2027-02-11', to: '2027-03-22', dates_announced: true },
      { id: 'f-2028', dates_announced: false },
    ],
  } as PublicFestival;
  const p = place({ plantings: [planting()] });

  it('a festival is on only between its dates', () => {
    expect(festivalsOn([fest], 'p', '2027-02-10')).toEqual([]);
    expect(festivalsOn([fest], 'p', '2027-02-11')).toEqual([fest]);
    expect(festivalsOn([fest], 'other', '2027-02-11')).toEqual([]);
  });

  it('シーズン中 hides シーズン外 places; すべて表示 shows them', () => {
    const off = placeStatus(p, [fest], '2027-06-01');
    expect(passesFilter(off, 'in-season')).toBe(false);
    expect(passesFilter(off, 'all')).toBe(true);
  });

  it('見頃のみ, 開催中のイベント and イルミネーション filters', () => {
    const peak = placeStatus(p, [fest], '2027-02-25');
    expect(passesFilter(peak, 'peak')).toBe(true);
    expect(passesFilter(peak, 'festivals')).toBe(true);
    expect(passesFilter(peak, 'illuminations')).toBe(false);
    expect(passesFilter(placeStatus(p, [fest], '2027-02-15'), 'peak')).toBe(false);
  });
});

describe('pin under a filter', () => {
  const lit = illumination([
    { season: '2026-27', from: '2027-04-01', to: '2027-04-30', dates_announced: true },
  ]);
  const p = place({
    plantings: [planting({ id: 'sakura', windows: [{ start: '04-1', end: '04-2' }] })],
    illuminations: [lit],
  });
  const ps = placeStatus(p, [], '2027-04-05');

  it('normally fronts the lit illumination', () => {
    expect(ps.pin?.id).toBe('p-lights');
    expect(pinForFilter(ps, 'in-season')?.id).toBe('p-lights');
  });

  it('見頃のみ fronts the 見頃 planting instead', () => {
    expect(pinForFilter(ps, 'peak')?.id).toBe('sakura');
  });

  it('イルミネーション fronts the illumination even over a flower at 見頃', () => {
    const noLights = placeStatus(
      place({ plantings: [planting({ id: 'sakura', windows: [{ start: '04-1', end: '04-2' }] })] }),
      [],
      '2027-04-05',
    );
    expect(pinForFilter(noLights, 'illuminations')?.id).toBe('sakura'); // nothing to switch to
    expect(pinForFilter(ps, 'illuminations')?.id).toBe('p-lights');
  });
});

describe('place page order', () => {
  it('lit illuminations first, then in season by start, then upcoming; finished ones end up last', () => {
    const p = place({
      plantings: [
        planting({ id: 'ume', windows: [{ start: '01-3', end: '03-2' }] }),
        planting({ id: 'narcissus', windows: [{ start: '03-3', end: '04-2' }] }),
        planting({ id: 'nemophila', windows: [{ start: '04-2', end: '05-1' }] }),
        planting({ id: 'rose', windows: [{ start: '05-2', end: '06-1' }] }),
      ],
      illuminations: [
        illumination([
          { season: '2026-27', from: '2027-04-01', to: '2027-04-30', dates_announced: true },
        ]),
      ],
    });
    const ids = pageOrder(placeStatus(p, [], '2027-04-15').features).map((s) => s.id);
    expect(ids).toEqual(['p-lights', 'narcissus', 'nemophila', 'rose', 'ume']);
  });
});

// ---------- real data fixtures (CLAUDE.md: every real-date bug becomes one of these)

describe('real data', () => {
  const { data } = buildData();
  const at = (id: string, today: string) => {
    const p = data!.places.find((x) => x.id === id)!;
    return placeStatus(p, data!.festivals, today);
  };

  it('on 2027-04-16, hitachi-seaside pin = ネモフィラ', () => {
    expect(at('hitachi-seaside', '2027-04-16').pin?.id).toBe('hitachi-seaside-nemophila');
  });

  it('on 2027-02-25, kairakuen shows plum at 見頃 with 水戸の梅まつり on', () => {
    const s = at('kairakuen', '2027-02-25');
    expect(s.pin).toMatchObject({ id: 'kairakuen-ume', level: 2 });
    expect(s.festivals.map((f) => f.id)).toEqual(['mito-ume-matsuri']);
  });

  it('on 2026-11-25, fukuroda is lit with the November hours', () => {
    expect(at('fukuroda', '2026-11-25').pin).toMatchObject({
      state: 'lit',
      confirmed: true,
      hoursJa: '16:30〜20:00',
    });
  });

  it('kirakuyama 2026 (announced 12/1–12/25): まもなく with a countdown on 11/28, lit on 12/1', () => {
    expect(at('kirakuyama', '2026-11-28').pin).toMatchObject({ state: 'soon', countdownDays: 3 });
    expect(at('kirakuyama', '2026-12-01').pin).toMatchObject({
      state: 'lit',
      confirmed: true,
      hoursJa: '16:30〜20:30',
    });
  });

  it('kasumigaura-park: the one-night 大晦日 row beats the run it sits inside', () => {
    expect(at('kasumigaura-park', '2026-12-30').pin).toMatchObject({ hoursJa: '17:00〜21:00' });
    expect(at('kasumigaura-park', '2026-12-31').pin).toMatchObject({ hoursJa: '17:00〜翌6:30頃' });
    expect(at('kasumigaura-park', '2027-01-01').pin).toMatchObject({ hoursJa: '17:00〜21:00' });
  });

  it('every place has a pin on every day of the year, and the date logic never throws', () => {
    for (let d = '2026-11-01'; d <= '2027-10-31'; d = addDays(d, 1)) {
      for (const p of data!.places)
        expect(placeStatus(p, data!.festivals, d).pin, `${p.id} ${d}`).toBeDefined();
    }
  });
});

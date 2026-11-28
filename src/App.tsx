import { useEffect, useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import FilterBar from './components/FilterBar';
import LegendTab, { LegendDock } from './components/Legend';
import MapView, { type ViewBounds } from './components/MapView';
import PlaceList from './components/PlaceList';
import PlacePage from './components/PlacePage';
import Sheet, { type Snap } from './components/Sheet';
import { PHONE_PIN, PIN, SHEET_TOP_PX } from './config';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { passesFilter, pinForFilter, placeStatus, type Filter } from './lib/status';
import { legendRows } from './legend';
import { listCountText, listedPlaces } from './listText';
import { pinStyle } from './pins';
import { OPENED_WITH_PLACE, useSelectedPlace } from './selectedPlace';
import { useIsPhone } from './usePhone';

/** Sheet heights: a place page uses peek, half and full; the list skips half (it's for
 *  browsing); the legend rests at its own height (fit, up to half) instead of half. */
const ALL_SNAPS: readonly Snap[] = ['peek', 'half', 'full'];
const LIST_SNAPS: readonly Snap[] = ['peek', 'full'];
const LEGEND_SNAPS: readonly Snap[] = ['peek', 'fit', 'full'];

/** Phones: the sheet's two tabs on its count line (CLAUDE.md, "Legend"). */
type Tab = 'list' | 'legend';

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const { data, error } = useData();
  const { date, isOverride, setDate } = useAppDate();
  // Debug only: the Why panel takes the list's place while it's open.
  const [panelOpen, setPanelOpen] = useState(false);
  const [bounds, setBounds] = useState<ViewBounds | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; n: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('in-season');
  const { selected, open, close } = useSelectedPlace();
  const phone = useIsPhone();
  // The legend (CLAUDE.md, "Legend"). Desktop: a card over the map, open when the page loads.
  // Phones: the 凡例 tab in the sheet; `tab` is the last tab opened (underlined even at peek).
  const [cardOpen, setCardOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('list');

  // Phones (CLAUDE.md, "Phone layout"): the sheet starts at peek, or at half for a place link.
  // Opening a place raises it to half and remembers the tab's height (`listSnap`). Closing: ×
  // and a map tap go to peek; ← goes back to that tab and height; Back and Esc too, unless the
  // page was lowered to peek: then peek. The tab stays as it was throughout.
  const [snap, setSnap] = useState<Snap>(OPENED_WITH_PLACE ? 'half' : 'peek');
  const [listSnap, setListSnap] = useState<Snap>('peek');
  const [prevSelected, setPrevSelected] = useState(selected);
  // Set by a header button just before it closes the page.
  const [closeTarget, setCloseTarget] = useState<Snap | null>(null);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected && !prevSelected) setListSnap(snap);
    setSnap(selected ? 'half' : (closeTarget ?? (snap === 'peek' ? 'peek' : listSnap)));
    setCloseTarget(null);
  }
  const closeTo = (to: Snap) => {
    if (!selected) return;
    setCloseTarget(to);
    close();
  };
  // The sheet's height at rest, so "centre" on the map means the part above it.
  const [sheetH, setSheetH] = useState(0);

  // Every place's status on `date`: the single source for pins, list and place page.
  const statuses = useMemo(
    () => (data ? data.places.map((p) => placeStatus(p, data.festivals, date)) : []),
    [data, date],
  );
  const selectedStatus = statuses.find((ps) => ps.place.id === selected) ?? null;

  // A shared link to a place the default filter hides opens with すべて表示 (CLAUDE.md). Checked
  // once, as soon as the statuses exist (state adjusted during render, React's pattern for this).
  const [linkChecked, setLinkChecked] = useState(false);
  if (!linkChecked && statuses.length) {
    setLinkChecked(true);
    const ps = statuses.find((x) => x.place.id === OPENED_WITH_PLACE);
    if (ps && !passesFilter(ps, filter)) setFilter('all');
  }

  // What the map shows: places that pass the filter, each fronted by the filter's pin. The open
  // place always keeps its pin.
  const visible = useMemo(
    () =>
      statuses
        .filter((ps) => passesFilter(ps, filter) || ps.place.id === selected)
        .map((ps) => ({ ...ps, pin: pinForFilter(ps, filter) })),
    [statuses, filter, selected],
  );

  // The legend's rows: from the places passing the filter, with the filter's pin (not only those
  // on screen). Its photos: each species' pin close-up, as on the map.
  const legendRowSet = useMemo(
    () =>
      legendRows(
        statuses
          .filter((ps) => passesFilter(ps, filter))
          .map((ps) => ({ pin: pinForFilter(ps, filter), festivals: ps.festivals })),
      ),
    [statuses, filter],
  );
  const pinSrc = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of data?.places ?? [])
      for (const pl of p.plantings) if (pl.pin_src) out[pl.species] ??= pl.pin_src;
    return out;
  }, [data]);

  // No rows (nothing passes the filter): no 凡例 button or tab. A legend tab that loses its rows
  // while open gives way to the list at peek.
  const hasLegend = legendRowSet.size > 0;
  if (tab === 'legend' && !hasLegend && statuses.length) {
    setTab('list');
    if (!selected) setSnap('peek');
  }
  // Esc closes the desktop card first, then the place page.
  const cardShown = !phone && cardOpen && hasLegend;
  useEffect(() => {
    if (!selected && !cardShown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (cardShown) setCardOpen(false);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, close, cardShown]);

  // Phones: tapping a tab. The underlined tab above peek lowers the sheet to peek. Otherwise
  // 一覧 opens the list at full, and 凡例 the legend at its own height (full when the list was).
  const tapTab = (to: Tab) => {
    if (to === tab && snap !== 'peek') return setSnap('peek');
    setTab(to);
    setSnap(to === 'list' || snap === 'full' ? 'full' : 'fit');
  };

  // Debug panel only: fly to a place. Opening a place never moves the map.
  const flyTo = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    if (p) setFocus((f) => ({ lng: p.lng, lat: p.lat, n: (f?.n ?? 0) + 1 }));
  };

  const linkPlace = data?.places.find((p) => p.id === OPENED_WITH_PLACE);

  const debugOpen = DEBUG && panelOpen;
  // A height the content doesn't use shows as full (closing the debug panel at half, say).
  const sheetSnaps =
    selectedStatus || debugOpen ? ALL_SNAPS : tab === 'legend' ? LEGEND_SNAPS : LIST_SNAPS;
  const sheetSnap = sheetSnaps.includes(snap) ? snap : 'full';

  // Phones: closing buttons. A place page has × (閉じる: back to the map, the tab at peek) in its
  // name row, and ← when it was opened while the sheet was above peek: back to that tab and
  // height, its spoken label saying which (at peek the sheet shows no rows, so a page opened then
  // came from a pin or a link). The tab row has the same × whenever the sheet is above peek.
  const pageActions =
    phone && !debugOpen
      ? {
          onBack: listSnap !== 'peek' ? () => closeTo(listSnap) : undefined,
          backLabel: t(tab === 'legend' ? 'backToLegend' : 'back', lang),
          onClose: () => closeTo('peek'),
        }
      : {};
  const listCount = listCountText(listedPlaces(visible, bounds).length, lang);
  // data-peek: a phone's sheet at peek shows down to here (grab bar and this row).
  const tabRow = (
    <div className="list-count sheet-tabs" data-peek="" role="tablist">
      <button
        type="button"
        role="tab"
        className="sheet-tab"
        aria-selected={tab === 'list'}
        onClick={() => tapTab('list')}
      >
        {listCount}
      </button>
      {hasLegend && (
        <button
          type="button"
          role="tab"
          className="sheet-tab"
          aria-selected={tab === 'legend'}
          onClick={() => tapTab('legend')}
        >
          {t('legend', lang)}
        </button>
      )}
      {sheetSnap !== 'peek' && (
        <button
          type="button"
          className="icon-btn close"
          aria-label={t('close', lang)}
          onClick={() => setSnap('peek')}
        >
          ×
        </button>
      )}
    </div>
  );

  const panel =
    data &&
    (debugOpen ? (
      <DebugPanel statuses={statuses} species={data.species} lang={lang} onSelect={flyTo} />
    ) : selectedStatus ? (
      <PlacePage
        ps={selectedStatus}
        species={data.species}
        sources={data.sources}
        today={date}
        lang={lang}
        {...pageActions}
      />
    ) : phone && tab === 'legend' ? (
      <LegendTab rows={legendRowSet} pinSrc={pinSrc} lang={lang} head={tabRow} />
    ) : (
      <PlaceList
        places={visible}
        bounds={bounds}
        species={data.species}
        today={date}
        lang={lang}
        onSelect={open}
        head={phone ? tabRow : undefined}
      />
    ));

  const langToggle = (
    <button
      type="button"
      className="chip lang-toggle"
      onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
    >
      {t('switchLang', lang)}
    </button>
  );

  return (
    <div
      className={`app${phone ? ' phone' : ''}`}
      lang={lang}
      style={pinStyle(phone ? PHONE_PIN : PIN)}
    >
      {/* No title bar: on desktop the filter row (with the app's name and the language button)
          is the only bar. */}
      {DEBUG && (
        <DebugBar
          date={date}
          isOverride={isOverride}
          setDate={setDate}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          compact={phone}
        />
      )}
      {error && <p className="load-error">{t('loadError', lang)}</p>}
      {!phone && (
        <FilterBar
          filter={filter}
          setFilter={setFilter}
          lang={lang}
          openPlace={selectedStatus ? { onBack: close } : null}
          extra={langToggle}
          title={<h1 className="app-name">{t('appTitle', lang)}</h1>}
        />
      )}
      <div className="main">
        {/* Desktop: side panel on the left, like Google Maps. */}
        {!phone && panel}
        <div className="map-area">
          {/* Starts at once, loading tiles while places.json downloads; its pins appear when the
              data arrives. Only a shared place link waits for the data, to open centred on
              its place. */}
          {(data || !OPENED_WITH_PLACE) && (
            <MapView
              statuses={visible}
              lang={lang}
              focus={focus}
              onViewChange={setBounds}
              selectedId={selected}
              onPinClick={open}
              onEmptyClick={() => (selected ? closeTo('peek') : setSnap('peek'))}
              initialCenter={linkPlace ? { lng: linkPlace.lng, lat: linkPlace.lat } : null}
              insets={phone ? { top: SHEET_TOP_PX, bottom: sheetH } : null}
              phone={phone}
            />
          )}
          {/* Desktop: the 凡例 button with the legend card growing out of it (phones: a tab). */}
          {data && hasLegend && !phone && (
            <LegendDock
              rows={legendRowSet}
              pinSrc={pinSrc}
              lang={lang}
              open={cardOpen}
              onToggle={() => setCardOpen((o) => !o)}
            />
          )}
          {data && visible.length === 0 && (
            <p className="map-notice">
              {t('noMatches', lang)}{' '}
              <button type="button" className="chip" onClick={() => setFilter('all')}>
                {t('filterAll', lang)}
              </button>
            </p>
          )}
        </div>
        {/* Phones: chips float over the map (hidden while a place page is open) and the list or
            place page sits in a bottom sheet. */}
        {phone && !selectedStatus && (
          <FilterBar filter={filter} setFilter={setFilter} lang={lang} extra={langToggle} />
        )}
        {phone && panel && (
          <Sheet
            snap={sheetSnap}
            onSnap={setSnap}
            snaps={sheetSnaps}
            onRest={setSheetH}
            handleLabel={t('sheetHandle', lang)}
            contentKey={debugOpen ? 'debug' : (selected ?? tab)}
          >
            {panel}
          </Sheet>
        )}
      </div>
    </div>
  );
}

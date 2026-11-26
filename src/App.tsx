import { useEffect, useMemo, useState } from 'react';
import DebugBar from './components/DebugBar';
import DebugPanel from './components/DebugPanel';
import FilterBar from './components/FilterBar';
import MapView, { type ViewBounds } from './components/MapView';
import PlaceList from './components/PlaceList';
import PlacePage from './components/PlacePage';
import Sheet, { type Snap } from './components/Sheet';
import { PHONE_PIN, PIN, SHEET_TOP_PX } from './config';
import { useData } from './data';
import { DEBUG, useAppDate } from './debugDate';
import { t, type Lang } from './i18n';
import { passesFilter, pinForFilter, placeStatus, type Filter } from './lib/status';
import { pinStyle } from './pins';
import { OPENED_WITH_PLACE, useSelectedPlace } from './selectedPlace';
import { useIsPhone } from './usePhone';

/** Sheet heights: a place page uses all three; the list skips half (it's for browsing). */
const ALL_SNAPS: readonly Snap[] = ['peek', 'half', 'full'];
const LIST_SNAPS: readonly Snap[] = ['peek', 'full'];

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

  // Phones (CLAUDE.md, "Phone layout"): the sheet starts at peek, or at half for a place link.
  // Opening a place raises it to half. The page's buttons say where closing goes: 一覧に戻る to
  // the list at its earlier height, 閉じる to the map (list at peek). A map tap also closes to
  // peek. Back and Esc return the list to its earlier height, unless the page was lowered to
  // peek: then the list stays at peek.
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

  // Esc closes the place page.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, close]);

  // Debug panel only: fly to a place. Opening a place never moves the map.
  const flyTo = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    if (p) setFocus((f) => ({ lng: p.lng, lat: p.lat, n: (f?.n ?? 0) + 1 }));
  };

  const linkPlace = data?.places.find((p) => p.id === OPENED_WITH_PLACE);

  const debugOpen = DEBUG && panelOpen;
  // The list never rests at half (CLAUDE.md, "Phone layout"). The one way the list can meet a
  // half sheet is closing the debug panel there: it shows at full.
  const sheetSnaps = selectedStatus || debugOpen ? ALL_SNAPS : LIST_SNAPS;
  const sheetSnap = sheetSnaps.includes(snap) ? snap : 'full';

  // Phones: closing buttons. A place page has × (閉じる: back to the map) in its name row, and ←
  // (一覧に戻る) when there's a list to go back to: the page was opened from the full list (at
  // peek the list shows no rows, so a page opened then came from a pin or a link). The full list,
  // which hides the map, has the same × on its count line: it lowers the list to peek.
  const pageActions =
    phone && !debugOpen
      ? {
          onBack: listSnap === 'full' ? () => closeTo('full') : undefined,
          onClose: () => closeTo('peek'),
        }
      : {};
  const listClose = phone && !debugOpen && !selectedStatus && sheetSnap === 'full' && (
    <button
      type="button"
      className="icon-btn close"
      aria-label={t('close', lang)}
      onClick={() => setSnap('peek')}
    >
      ×
    </button>
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
    ) : (
      <PlaceList
        places={visible}
        bounds={bounds}
        species={data.species}
        today={date}
        lang={lang}
        onSelect={open}
        countAction={listClose}
      />
    ));

  const langToggle = (
    <button
      type="button"
      className="lang-toggle"
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
      {/* Phones have no title bar: the map starts right under the debug bar. */}
      {!phone && (
        <header className="app-header">
          <h1>{t('appTitle', lang)}</h1>
          {langToggle}
        </header>
      )}
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
        />
      )}
      <div className="main">
        {/* Desktop: side panel on the left, like Google Maps. */}
        {!phone && panel}
        <div className="map-area">
          {/* Waits for the data, so a shared place link can open centred on its place. */}
          {data && (
            <MapView
              statuses={visible}
              lang={lang}
              focus={focus}
              onViewChange={setBounds}
              selectedId={selected}
              onPinClick={open}
              onEmptyClick={() => closeTo('peek')}
              initialCenter={linkPlace ? { lng: linkPlace.lng, lat: linkPlace.lat } : null}
              insets={phone ? { top: SHEET_TOP_PX, bottom: sheetH } : null}
              phone={phone}
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
            contentKey={debugOpen ? 'debug' : (selected ?? 'list')}
          >
            {panel}
          </Sheet>
        )}
      </div>
    </div>
  );
}

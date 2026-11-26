import type { ReactNode } from 'react';
import { t, type Lang } from '../i18n';
import { featureName, placeName, stageColor, stageLabel } from '../labels';
import type { PublicSource, Species } from '../lib/schema';
import { OUT_OF_SEASON, RING_COLORS, type FeatureState, type PlaceStatus } from '../lib/status';
import { md, rowText, usualWindowText } from '../listText';
import { featurePhoto } from '../pins';

interface Props {
  ps: PlaceStatus;
  species: Species[];
  sources: PublicSource[];
  today: string;
  lang: Lang;
}

/** English when R has translated it, else the Japanese (CLAUDE.md, "Bilingual fields"). */
const pick = (lang: Lang, ja?: string, en?: string) => (lang === 'en' && en) || ja;

const isOff = (s: FeatureState) =>
  s.type === 'illumination' ? s.state === 'off' : s.level === OUT_OF_SEASON;

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

function Links({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <span className="page-links">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer">
          {host(u)} ↗
        </a>
      ))}
    </span>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Feature({ s, ps, species, sources, today, lang }: Props & { s: FeatureState }) {
  const color = stageColor(s);
  const status = rowText(s, today, lang);
  const planting = s.type === 'planting' ? ps.place.plantings.find((p) => p.id === s.id) : null;
  const il = s.type === 'illumination' ? ps.place.illuminations.find((x) => x.id === s.id) : null;
  // The usual window as an extra line, when the status line is about something else.
  const usual =
    s.type === 'planting' && s.window && s.basis !== 'usual-window' && s.basis !== 'off-season'
      ? usualWindowText(s.window, lang)
      : '';
  const source =
    s.type === 'planting' && s.report?.source_id
      ? sources.find((x) => x.id === s.report!.source_id)
      : undefined;
  const edition =
    s.type === 'illumination' ? il?.editions.find((e) => e.from && e.from === s.from) : undefined;
  const fee = pick(lang, edition?.fee_ja, edition?.fee_en);
  return (
    <li className="page-feature">
      <img
        alt=""
        src={featurePhoto(s, ps)}
        className={`feature-photo${isOff(s) ? ' photo-grey' : ''}`}
      />
      <span className="feature-body">
        <span className="list-feature">
          <strong>{featureName(s, ps, species, lang)}</strong>
          <span
            className={`stage-tag${color === RING_COLORS.track ? ' muted' : ''}`}
            style={color === RING_COLORS.track ? undefined : { background: color }}
          >
            {stageLabel(s, lang)}
          </span>
        </span>
        {status.text && (
          <span className={`list-status${status.aging ? ' aging' : ''}`}>{status.text}</span>
        )}
        {usual && <span className="list-status">{usual}</span>}
        {source && (
          <span className="list-status">
            {t('source', lang)}:{' '}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.name_ja} ↗
            </a>
          </span>
        )}
        {fee && (
          <span className="list-status">
            {t('fees', lang)}: {fee}
          </span>
        )}
        <Links urls={planting?.official_urls ?? il?.official_urls} />
      </span>
    </li>
  );
}

/** The place page (CLAUDE.md, "Place page"): status first, practical info, シーズン外 last. */
export default function PlacePage(props: Props) {
  const { ps, today, lang } = props;
  const p = ps.place;
  const current = ps.features.filter((s) => !isOff(s));
  const off = ps.features.filter(isOff);
  return (
    <aside className="place-page" aria-label={placeName(ps, lang)}>
      {/* Header photo: only a photo taken at this place (none yet). Species close-ups never go here. */}
      <header className="page-head">
        <h2>
          {placeName(ps, lang)}
          {ps.closed && <span className="pill-closed">{t('closedToday', lang)}</span>}
        </h2>
        {lang === 'ja' && p.name_kana && <p className="page-sub">{p.name_kana}</p>}
        {lang === 'en' && p.name_en && <p className="page-sub">{p.name_ja}</p>}
        <p className="page-sub">{p.municipality}</p>
      </header>

      {current.length > 0 && (
        <ul className="page-features">
          {current.map((s) => (
            <Feature key={s.id} s={s} {...props} />
          ))}
        </ul>
      )}

      {ps.festivals.length > 0 && (
        <section>
          <h3>{t('filterFestivals', lang)}</h3>
          <ul className="page-features">
            {ps.festivals.map((f) => {
              const ed = f.editions.find((e) => e.from && e.to && e.from <= today && today <= e.to);
              return (
                <li key={f.id} className="page-feature no-photo">
                  <span className="list-fest">
                    <strong>{pick(lang, f.name_ja, f.name_en)}</strong>
                  </span>
                  {ed && (
                    <span className="list-status">
                      {md(ed.from!)}〜{md(ed.to!)}
                    </span>
                  )}
                  <dl className="page-info">
                    <Info label={t('fees', lang)}>{pick(lang, f.fee_ja, f.fee_en)}</Info>
                    <Info label={t('parking', lang)}>{pick(lang, f.parking_ja, f.parking_en)}</Info>
                    <Info label={t('nightEvents', lang)}>
                      {pick(lang, f.night_events_ja, f.night_events_en)}
                    </Info>
                  </dl>
                  <Links urls={f.official_urls} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3>{t('visitorInfo', lang)}</h3>
        <dl className="page-info">
          <Info label={t('hours', lang)}>{pick(lang, p.hours_ja, p.hours_en)}</Info>
          <Info label={t('closedDays', lang)}>{pick(lang, p.closed_ja, p.closed_en)}</Info>
          <Info label={t('fees', lang)}>{pick(lang, p.fee_ja, p.fee_en)}</Info>
          <Info label={t('parking', lang)}>{pick(lang, p.parking_ja, p.parking_en)}</Info>
          <Info label={t('address', lang)}>{p.address_ja}</Info>
          <Info label={t('officialSite', lang)}>
            {p.official_urls?.length ? <Links urls={p.official_urls} /> : null}
          </Info>
        </dl>
      </section>

      {off.length > 0 && (
        <section>
          <h3>{t('outOfSeason', lang)}</h3>
          <ul className="page-features">
            {off.map((s) => (
              <Feature key={s.id} s={s} {...props} />
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

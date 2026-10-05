import '@/views/css/discover.css';
import { type FormEvent, useRef, useState } from 'react';
import { useDisplayMode } from 'skybridge/web';
import {
  type DiscoverPayload,
  type Film,
  type FilmPayload,
  GENRES,
  type Genre,
  QUERY_MAX_CHARS,
  type Rail,
  hasPreview,
} from '../../../discover/model.js';
import { useCallTool } from '../../../helpers.js';
import { useAutoHeight } from '../../hooks.js';
import { ICON, coverArt } from '../cover.js';
import { Icon } from '../Icon.js';
import { PreviewPlayerLazy } from './PreviewPlayerLazy.js';
import { Credits, FilmMeta, ModelContext, Topbar, WatchButton } from './shared.js';

type Payload = DiscoverPayload | FilmPayload;

/**
 * Identity of a tool result, used as the widget's React key so a new result
 * from the model starts the widget fresh instead of resetting state by hand.
 */
export function discoverKey(payload: Payload | undefined): string {
  if (!payload) {
    return 'pending';
  }
  return payload.view === 'discover' ? `d:${payload.genre ?? ''}:${payload.query ?? ''}` : `f:${payload.film.id}`;
}

const isView =
  <T extends Payload>(view: T['view']) =>
  (p: unknown): p is T =>
    typeof p === 'object' && p !== null && (p as { view?: unknown }).view === view;
const isDiscoverPayload = isView<DiscoverPayload>('discover');
const isFilmPayload = isView<FilmPayload>('film');

// ── small pieces ───────────────────────────────────────────────────────────

/**
 * Fullscreen toggle. The host answers with the mode it actually applied; if
 * that is not the one asked for (an inline-only host), the button goes away.
 */
function FullscreenToggle() {
  const [mode, setMode] = useDisplayMode();
  const [unsupported, setUnsupported] = useState(false);
  if (unsupported) {
    return null;
  }
  const isFull = mode === 'fullscreen';
  const toggle = () => {
    const wanted = isFull ? 'inline' : 'fullscreen';
    setMode(wanted)
      .then(r => {
        if (r.mode !== wanted) {
          setUnsupported(true);
        }
      })
      .catch(() => setUnsupported(true));
  };
  return (
    <button className="iconbtn" onClick={toggle}>
      <Icon html={ICON.tv} />
      {isFull ? 'Exit fullscreen' : 'Fullscreen'}
    </button>
  );
}

function FilmCard({ film, onOpen }: { film: Film; onOpen: (f: Film) => void }) {
  return (
    <button className="card film-card" onClick={() => onOpen(film)}>
      <div className="art">
        <div
          className="cover-fill"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: coverArt(film.cover, film.title.charAt(0)) }}
        />
        <div className="play-overlay" aria-hidden="true">
          <div className="disc" dangerouslySetInnerHTML={{ __html: hasPreview(film) ? ICON.play : ICON.info }} />
        </div>
        {hasPreview(film) ? <span className="corner badge preview-badge">Preview</span> : null}
      </div>
      <div className="meta">
        <div className="t">{film.title}</div>
        <div className="k">
          {film.year} · {film.genre}
        </div>
      </div>
    </button>
  );
}

function RailRow({ rail, onOpen }: { rail: Rail; onOpen: (f: Film) => void }) {
  if (!rail.items.length) {
    return null;
  }
  return (
    <section className={`rail layout-${rail.layout} reveal`} aria-label={rail.title}>
      <div className="rail-head">
        <h3>{rail.title}</h3>
        {rail.subtitle ? <span className="sub">{rail.subtitle}</span> : null}
      </div>
      <div className="track">
        {rail.items.map(f => (
          <FilmCard key={f.id} film={f} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function Hero({ film, provider, onOpen }: { film: Film; provider: string; onOpen: (f: Film) => void }) {
  return (
    <div className="hero reveal">
      <div className="art">
        <div
          className="cover-fill"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: coverArt(film.cover, film.title.charAt(0), { hero: true }) }}
        />
      </div>
      <div className="scrim" />
      <div className="hero-inner">
        <div className="kicker">Featured open movie</div>
        <FilmMeta film={film} />
        <h2>{film.title}</h2>
        <p className="syn">{film.logline}</p>
        <div className="hero-actions">
          <button className="btn btn-play" onClick={() => onOpen(film)}>
            <Icon html={hasPreview(film) ? ICON.play : ICON.info} />
            {hasPreview(film) ? 'Watch the preview' : 'Details'}
          </button>
          <WatchButton film={film} provider={provider} primary={false} />
        </div>
      </div>
    </div>
  );
}

/** Mounted with `key={query}`, so it shows what the current screen searched for, also when the model ran it. */
function SearchBar({ initial, onSearch }: { initial?: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(value.trim());
  };
  return (
    <form className="search" role="search" onSubmit={submit}>
      <Icon html={ICON.search} />
      <input
        id="discover-search"
        name="q"
        type="search"
        maxLength={QUERY_MAX_CHARS}
        aria-label="Search films"
        placeholder="Search: dragons, spooky, Sintel…"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button type="submit" className="search-go">
        Search
      </button>
    </form>
  );
}

// ── screens ────────────────────────────────────────────────────────────────

function DiscoverScreen({
  p,
  busy,
  failed,
  onOpen,
  onSearch,
  onGenre,
}: {
  p: DiscoverPayload;
  busy: boolean;
  failed: boolean;
  onOpen: (f: Film) => void;
  onSearch: (q: string) => void;
  onGenre: (g: Genre | undefined) => void;
}) {
  const all = p.rails.flatMap(r => r.items);
  const featured = all.find(f => f.id === p.featuredId);
  const isHome = !p.query && !p.genre;
  return (
    <>
      <SearchBar key={p.query ?? ''} initial={p.query} onSearch={onSearch} />
      <div className="chips" role="group" aria-label="Genres">
        <button
          className={`chip ${isHome ? 'is-active' : ''}`}
          aria-pressed={isHome}
          onClick={() => onGenre(undefined)}
        >
          All
        </button>
        {GENRES.map(g => (
          <button
            key={g}
            className={`chip ${p.genre === g ? 'is-active' : ''}`}
            aria-pressed={p.genre === g}
            onClick={() => onGenre(g)}
          >
            {g}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="notice" role="status">
          Those results did not load. Try again in a moment.
        </div>
      ) : null}
      <div className={`headline reveal ${busy ? 'is-busy' : ''}`}>
        <h1>{p.headline}</h1>
        {p.subhead ? <p>{p.subhead}</p> : null}
      </div>
      {featured && isHome ? <Hero film={featured} provider={p.brand.watchProvider} onOpen={onOpen} /> : null}
      {p.rails.map(r => (
        <RailRow key={r.id} rail={r} onOpen={onOpen} />
      ))}
      <ModelContext
        text={`The user is browsing ${p.brand.name} on "${p.headline}". Films on screen: ${[...new Set(all.map(f => f.title))].join(', ')}.`}
      />
    </>
  );
}

function FilmScreen({
  p,
  licenseKey,
  busy,
  failed,
  onOpen,
  onBack,
}: {
  p: FilmPayload;
  licenseKey: string;
  busy: boolean;
  failed: boolean;
  onOpen: (f: Film) => void;
  onBack?: () => void;
}) {
  const f = p.film;
  const provider = p.brand.watchProvider;
  return (
    <div className="film-view">
      {onBack ? (
        <button className="iconbtn back" onClick={onBack} disabled={busy}>
          <Icon html={ICON.back} />
          All films
        </button>
      ) : null}
      {failed ? (
        <div className="notice" role="status">
          The film list did not load. Try again in a moment.
        </div>
      ) : null}
      {hasPreview(f) ? (
        <div className="player-shell">
          <PreviewPlayerLazy
            key={f.id}
            film={f}
            licenseKey={licenseKey}
            handoff={<WatchButton film={f} provider={provider} />}
          />
        </div>
      ) : (
        <div className="hero no-preview">
          <div className="art">
            <div
              className="cover-fill"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: coverArt(f.cover, f.title.charAt(0), { hero: true }) }}
            />
          </div>
          <div className="scrim" />
          <div className="hero-inner">
            <div className="kicker">No preview hosted here</div>
            <p className="syn">This one plays on {provider}. It is free to watch there in full.</p>
          </div>
        </div>
      )}
      <div className="film-bar">
        <div className="titleblock">
          <h2>{f.title}</h2>
          <FilmMeta film={f} />
          <p className="syn">{f.logline}</p>
        </div>
        <div className="controls">
          <WatchButton film={f} provider={provider} />
        </div>
      </div>
      {p.related.length ? (
        <RailRow
          rail={{ id: 'related', title: 'More like this', layout: 'poster', items: p.related }}
          onOpen={onOpen}
        />
      ) : null}
      <ModelContext
        text={`The user is looking at "${f.title}" (${f.year}, ${f.genre}) in ${p.brand.name}. ${
          hasPreview(f) ? 'Its preview is playing.' : 'It has no in-app preview.'
        } The full film is on ${provider}: ${f.watchUrl}.`}
      />
    </div>
  );
}

// ── root ────────────────────────────────────────────────────────────────────

/** A film the user opened in the widget; its related films arrive from the server. */
interface Opened {
  film: Film;
  related: Film[]; // empty until preview_film answers
}

/**
 * The shared Discover widget behind the `discover` and `preview_film` tools.
 *
 * Every screen comes from the server. Search and the genre chips call
 * `discover`. Opening a film shows it at once from the record on hand, then
 * asks `preview_film` for its "More like this", so related films have one
 * source whichever way the user got there. Only the newest call may update
 * the screen. Mount with `key={discoverKey(payload)}` so a new tool result
 * from the model starts fresh.
 */
export function DiscoverApp({ payload, licenseKey }: { payload?: Payload; licenseKey: string }) {
  const discover = useCallTool('discover');
  const previewFilm = useCallTool('preview_film');
  const rootRef = useRef<HTMLDivElement>(null);
  useAutoHeight(rootRef);
  const [mode] = useDisplayMode();

  // The latest Discover screen: the tool result the widget opened on, or one it fetched since.
  const [screen, setScreen] = useState<DiscoverPayload | null>(payload?.view === 'discover' ? payload : null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const latestRequest = useRef(0);

  /** Starts a new user action; any call still in flight for an older one is ignored when it lands. */
  const supersede = () => {
    setBusy(false);
    setFailed(false);
    return ++latestRequest.current;
  };

  /** Ask the server for a Discover screen. The current screen stays up until it arrives. */
  const browse = (args: { query?: string; genre?: Genre }) => {
    const request = supersede();
    setBusy(true);
    discover
      .callToolAsync(args)
      .then(r => {
        if (request !== latestRequest.current) {
          return; // a newer action superseded this one
        }
        // An error result still resolves, with an empty structuredContent.
        if (r.isError || !isDiscoverPayload(r.structuredContent)) {
          console.warn('[bitflix-discover] discover returned no screen', r);
          setFailed(true);
          return;
        }
        setOpened(null);
        setScreen(r.structuredContent);
      })
      .catch((e: unknown) => {
        if (request === latestRequest.current) {
          console.warn('[bitflix-discover] discover call failed', e);
          setFailed(true);
        }
      })
      .finally(() => {
        if (request === latestRequest.current) {
          setBusy(false);
        }
      });
  };
  // A text search covers the whole catalogue; a genre chip clears the search.
  const search = (q: string) => browse(q ? { query: q } : {});
  const filterGenre = (g: Genre | undefined) => browse(g ? { genre: g } : {});

  const open = (f: Film) => {
    const request = supersede();
    setOpened({ film: f, related: [] });
    rootRef.current?.scrollIntoView({ block: 'start' });
    previewFilm
      .callToolAsync({ id: f.id })
      .then(r => {
        if (request !== latestRequest.current) {
          return;
        }
        const p = r.structuredContent;
        if (r.isError || !isFilmPayload(p) || p.film.id !== f.id) {
          // The film is already on screen; only its related films are missing.
          console.warn('[bitflix-discover] preview_film returned no related films', r);
          return;
        }
        setOpened({ film: p.film, related: p.related });
      })
      .catch((e: unknown) => console.warn('[bitflix-discover] preview_film call failed', e));
  };

  const back = () => {
    if (screen) {
      supersede();
      setOpened(null);
    } else {
      browse({}); // opened on a film: there is no list to go back to yet
    }
  };

  const base = screen ?? payload;
  if (!base) {
    return (
      <div ref={rootRef} className="bitflix-root discover-root">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const shown: Payload = opened
    ? { view: 'film', brand: base.brand, credits: base.credits, film: opened.film, related: opened.related }
    : base;

  return (
    <div ref={rootRef} className={`bitflix-root discover-root ${mode === 'fullscreen' ? 'is-fullscreen' : ''}`}>
      <Topbar brand={shown.brand} label="Discover" right={<FullscreenToggle />} />
      {shown.view === 'film' ? (
        <FilmScreen
          p={shown}
          licenseKey={licenseKey}
          busy={busy}
          failed={failed}
          onOpen={open}
          onBack={opened || payload?.view === 'film' ? back : undefined}
        />
      ) : (
        <DiscoverScreen p={shown} busy={busy} failed={failed} onOpen={open} onSearch={search} onGenre={filterGenre} />
      )}
      <Credits text={shown.credits} />
    </div>
  );
}

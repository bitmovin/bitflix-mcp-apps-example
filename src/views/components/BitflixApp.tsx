import '@/views/css/index.css';
import type { PlayerAPI } from 'bitmovin-player';
import { useEffect, useRef, useState } from 'react';
import { useDisplayMode } from 'skybridge/web';
import { BRAND, type BrowsePayload, type ChipDef, type PlayerPayload, type Rail, type Title } from '../../catalog.js';
import { useCallTool } from '../../helpers.js';
import { type MatchdayPayload, fixtureForTitle } from '../../matchday.js';
import { useAutoHeight } from '../hooks.js';
import type { CastState } from './BitmovinPlayer.js';
import { BitmovinPlayerLazy } from './BitmovinPlayerLazy.js';
import { Badges, FooterNote, LiveBadge, Topbar } from './chrome.js';
import { ICON, coverArt } from './cover.js';
import { Icon } from './Icon.js';
import { MatchdayView } from './Matchday.js';

type Payload = BrowsePayload | PlayerPayload | MatchdayPayload;

function Card({ t, layout, onPlay }: { t: Title; layout: string; onPlay: (t: Title) => void }) {
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onPlay(t)}
      onKeyDown={e => {
        // Match a real button's key activation, which a button role does not grant:
        // Enter fires on press, Space on release.
        if (e.key === 'Enter') {
          e.preventDefault();
          onPlay(t);
        } else if (e.key === ' ') {
          e.preventDefault(); // Suppress the view scroll
        }
      }}
      onKeyUp={e => {
        if (e.key === ' ') {
          onPlay(t);
        }
      }}
    >
      <div className="art">
        <div
          className="cover-fill"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: coverArt(t.cover, t.title.charAt(0)) }}
        />
        <div className="play-overlay" aria-hidden="true">
          <div className="disc" dangerouslySetInnerHTML={{ __html: ICON.play }} />
        </div>
        <div className="corner">
          {t.delivery === 'live' ? <LiveBadge /> : t.badges.includes('NEW') ? <span className="badge">NEW</span> : null}
        </div>
      </div>
      <div className="meta">
        <div className="t">{t.title}</div>
        <div className="k">{t.kicker}</div>
        {layout === 'live' && (t.score || t.delivery === 'live') ? (
          <div className="liverow">
            {t.score ? <span className="score">{t.score}</span> : null}
            {t.delivery === 'live' ? <span className="live-clock">{t.liveLabel}</span> : null}
          </div>
        ) : null}
        {t.delivery === 'vod' && t.progressPct !== undefined ? (
          <div className="progress">
            <span style={{ width: `${t.progressPct}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RailRow({ section, onPlay }: { section: Rail; onPlay: (t: Title) => void }) {
  if (!section.items.length) {
    return null;
  }
  return (
    <div className={`rail layout-${section.layout || 'poster'} reveal`}>
      <div className="rail-head">
        <h3>{section.title}</h3>
        {section.subtitle ? <span className="sub">{section.subtitle}</span> : null}
      </div>
      <div className="track">
        {section.items.map(t => (
          <Card key={t.id} t={t} layout={section.layout || 'poster'} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

function Hero({ p, onPlay }: { p: BrowsePayload; onPlay: (t: Title) => void }) {
  const t = p.sections.flatMap(s => s.items).find(x => x.id === p.featuredId) || p.sections[0]?.items[0];
  if (!t) {
    return null;
  }
  return (
    // Clicking the frame is a pointer shortcut for the Play button inside it.
    // A button role may not wrap real buttons, and keyboard and screen-reader
    // users start the same playback from those buttons, so the frame stays
    // non-interactive to assistive technology.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="hero reveal" onClick={() => onPlay(t)}>
      <div className="art">
        <div
          className="cover-fill"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: coverArt(t.cover, t.title.charAt(0), { hero: true }) }}
        />
      </div>
      <div className="scrim" />
      <div className="hero-inner">
        <div className="kicker">{t.kicker}</div>
        <div className="metarow" style={{ marginTop: 0, marginBottom: 14 }}>
          {t.delivery === 'live' ? <LiveBadge /> : null}
          <Badges items={t.badges} />
          {t.score ? <span className="score">{t.score}</span> : null}
          {t.delivery === 'live' ? <span className="live-clock">{t.liveLabel}</span> : null}
        </div>
        <h2>{t.title}</h2>
        <p className="syn">{t.synopsis}</p>
        <div className="hero-actions">
          <button
            className="btn btn-play"
            onClick={e => {
              e.stopPropagation();
              onPlay(t);
            }}
          >
            <Icon html={ICON.play} />
            Play
          </button>
          <button
            className="btn btn-ghost"
            onClick={e => {
              e.stopPropagation();
              onPlay(t);
            }}
          >
            <Icon html={ICON.info} />
            More info
          </button>
        </div>
      </div>
    </div>
  );
}

// ── chips ───────────────────────────────────────────────────────────────────
/**
 * The chip to mark active, or none for a screen no chip leads to.
 */
function activeChipFor(p: BrowsePayload): string | undefined {
  switch (p.screen) {
    case 'home':
      return 'home';
    case 'recommendations':
      return 'foryou';
    case 'live':
      return 'live';
    case 'category':
      return p.category;
    case 'search':
      return undefined;
    default: {
      // Adding a BrowseScreen without a case here fails to compile, naming it.
      const unhandled: never = p;
      return unhandled;
    }
  }
}

// ── views ───────────────────────────────────────────────────────────────────
function BrowseView({
  p,
  onPlay,
  onChip,
  activeKey,
}: {
  p: BrowsePayload;
  onPlay: (t: Title) => void;
  onChip: (c: ChipDef) => void;
  activeKey?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useAutoHeight(rootRef);

  return (
    <div className="bitflix-root" ref={rootRef}>
      <Topbar brand={p.brand} prompt={p.brand.tagline} />
      <div className="chips">
        {p.chips.map(c => (
          <button key={c.key} className={`chip ${c.key === activeKey ? 'is-active' : ''}`} onClick={() => onChip(c)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="headline reveal">
        <h1>{p.headline}</h1>
        {p.subhead ? <p>{p.subhead}</p> : null}
      </div>
      <Hero p={p} onPlay={onPlay} />
      {p.sections.map(s => (
        <RailRow key={s.id} section={s} onPlay={onPlay} />
      ))}
      <FooterNote brand={p.brand} />
      {/* Skybridge reads the model context from the data-llm value; children are ignored. */}
      <span
        hidden
        data-llm={`${p.brand.name} is open on "${p.headline}". Rails: ${p.sections.map(s => s.title).join(', ')}. The user can play any title or ask for more.`}
      />
    </div>
  );
}

function PlayerView({
  p,
  onBack,
  onPlay,
  onMatchday,
}: {
  p: PlayerPayload;
  onBack: () => void;
  onPlay: (t: Title) => void;
  onMatchday: (fixtureId: string) => void;
}) {
  const [displayMode, setDisplayMode] = useDisplayMode();
  const playerRef = useRef<PlayerAPI | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cast, setCast] = useState<CastState>({ available: false, casting: false });
  const t = p.title;
  const isFs = displayMode === 'fullscreen';
  const fixture = p.matchCentre ? fixtureForTitle(t.id) : undefined;

  useAutoHeight(rootRef);

  // reset cast state when the title changes (player remounts)
  useEffect(() => {
    setCast({ available: false, casting: false });
  }, [t.id]);

  const castLabel = cast.casting
    ? `Casting${cast.device ? ` · ${cast.device}` : ''}`
    : cast.available
      ? 'Cast to TV'
      : 'Cast unavailable';
  const onCastClick = () => {
    const pl = playerRef.current;
    if (!pl) {
      return;
    }
    // Real Bitmovin Player Google Cast API — castVideo() opens the browser's
    // native Cast device chooser; no fake device list.
    try {
      if (cast.casting) {
        pl.castStop();
      } else {
        pl.castVideo();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bitflix-root" ref={rootRef}>
      <div className="player-view">
        <Topbar brand={p.brand} />
        <div className="player-shell">
          <BitmovinPlayerLazy
            title={t}
            licenseKey={p.licenseKey}
            onPlayerReady={pl => {
              playerRef.current = pl;
            }}
            onCast={setCast}
          />
        </div>
        <div className="player-bar">
          <div className="titleblock">
            <div className="kicker">{t.kicker}</div>
            <h2>{t.title}</h2>
            <div className="metarow">
              {t.delivery === 'live' ? <LiveBadge /> : null}
              <Badges items={t.badges} />
              {t.score ? <span className="score">{t.score}</span> : null}
              {t.delivery === 'vod' ? (
                <>
                  {t.rating ? <span className="small">{t.rating}</span> : null}
                  {t.year ? (
                    <>
                      <span className="dotsep">·</span>
                      <span className="small">{t.year}</span>
                    </>
                  ) : null}
                  {t.durationMin ? (
                    <>
                      <span className="dotsep">·</span>
                      <span className="small">{t.durationMin} min</span>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="syn">{t.synopsis}</p>
          </div>
          <div className="controls">
            <button className="iconbtn" onClick={onBack}>
              <Icon html={ICON.back} />
              Back
            </button>
            {fixture ? (
              <button className="iconbtn accent" onClick={() => onMatchday(fixture.id)}>
                <Icon html={ICON.info} />
                Match centre
              </button>
            ) : null}
            <button
              className={`iconbtn ${cast.available || cast.casting ? 'accent' : ''}`}
              disabled={!cast.available && !cast.casting}
              title={
                cast.available || cast.casting
                  ? 'Google Cast'
                  : 'No Google Cast receiver available in this host sandbox'
              }
              onClick={onCastClick}
            >
              <Icon html={ICON.cast} />
              {castLabel}
            </button>
            <button className="iconbtn" onClick={() => setDisplayMode(isFs ? 'inline' : 'fullscreen')}>
              <Icon html={ICON.tv} />
              {isFs ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        </div>
        {p.upNext?.length ? (
          <RailRow section={{ id: 'upnext', title: 'Up Next', layout: 'wide', items: p.upNext }} onPlay={onPlay} />
        ) : null}
        <FooterNote brand={p.brand} />
      </div>
      <span
        hidden
        data-llm={`The user is watching "${t.title}" (${t.kicker}) in the ${p.brand.name} player${cast.casting ? `, cast via Google Cast to ${cast.device || 'a device'} (this device is now a remote)` : cast.available ? ' on this device (a Google Cast receiver is available)' : ' on this device (no Google Cast receiver available in this MCP host sandbox)'}.${t.score ? ` Score: ${t.score}.` : ''} Up next: ${p.upNext.map(u => u.title).join(', ')}.`}
      />
    </div>
  );
}

// ── root ────────────────────────────────────────────────────────────────────
/**
 * Identity of a screen, so new content resets interaction state.
 */
function keyOf(p: Payload): string {
  switch (p.view) {
    case 'browse':
      return `b:${p.headline}`;
    case 'player':
      return `p:${p.title.id}`;
    case 'matchday':
      return `m:${p.fixture.id}:${p.focusMomentId ?? ''}`;
  }
}

function makePlayer(title: Title, browse: BrowsePayload | null, licenseKey: string, base?: Payload): PlayerPayload {
  const all = browse ? browse.sections.flatMap(s => s.items) : base && base.view === 'player' ? base.upNext : [];
  const upNext = all.filter(t => t.id !== title.id).slice(0, 4);
  const brand = browse?.brand ?? base?.brand ?? BRAND;
  // The edition has the match centre when a chip leads to it, or when we came from it.
  const matchCentre =
    browse?.chips.some(c => c.tool === 'matchday') ||
    base?.view === 'matchday' ||
    (base?.view === 'player' && base.matchCentre);
  return { view: 'player', brand, title, upNext, matchCentre, licenseKey };
}

export function BitflixApp({ payload }: { payload?: Payload }) {
  const browseCall = useCallTool('browse_catalog');
  const recCall = useCallTool('get_recommendations');
  const liveCall = useCallTool('whats_live');
  const matchCall = useCallTool('matchday');

  const [nav, setNav] = useState<Payload | null>(null);
  const [localTitle, setLocalTitle] = useState<Title | null>(null);

  // Reset interaction state when a new tool result arrives.
  const payloadKey = payload ? keyOf(payload) : 'none';
  useEffect(() => {
    setNav(null);
    setLocalTitle(null);
  }, [payloadKey]);

  const base: Payload | undefined = nav ?? payload;
  const lastBrowseRef = useRef<BrowsePayload | null>(null);
  if (base && base.view === 'browse') {
    lastBrowseRef.current = base;
  }
  const licenseKey = (base?.licenseKey || lastBrowseRef.current?.licenseKey) ?? '';

  const showResult = (r: { structuredContent?: Payload }) => {
    // An error result resolves with no payload to navigate to.
    if (r.structuredContent) {
      setNav(r.structuredContent);
    }
  };

  const onChip = (c: ChipDef) => {
    setLocalTitle(null);

    const call =
      c.tool === 'browse_catalog'
        ? browseCall.callToolAsync(c.category ? { category: c.category } : {})
        : c.tool === 'get_recommendations'
          ? recCall.callToolAsync({})
          : c.tool === 'matchday'
            ? matchCall.callToolAsync({})
            : liveCall.callToolAsync({});
    call.then(showResult).catch(() => {});
  };

  const play = (t: Title) => setLocalTitle(t);
  const openMatch = (fixtureId: string) => {
    setLocalTitle(null);
    matchCall
      .callToolAsync({ match: fixtureId })
      .then(showResult)
      .catch(() => {});
  };
  const back = () => {
    setLocalTitle(null);
    if (lastBrowseRef.current) {
      setNav(lastBrowseRef.current);
    } else {
      browseCall
        .callToolAsync({})
        .then(showResult)
        .catch(() => {});
    }
  };

  const displayed: Payload | undefined = localTitle
    ? makePlayer(localTitle, lastBrowseRef.current, licenseKey, base)
    : base;

  if (!displayed) {
    return (
      <div className="bitflix-root">
        <div className="empty">Loading Bitflix…</div>
      </div>
    );
  }
  if (displayed.view === 'player') {
    return <PlayerView p={displayed} onBack={back} onPlay={play} onMatchday={openMatch} />;
  }
  if (displayed.view === 'matchday') {
    return <MatchdayView key={keyOf(displayed)} p={displayed} onOpen={openMatch} onBack={back} />;
  }
  return <BrowseView p={displayed} onPlay={play} onChip={onChip} activeKey={activeChipFor(displayed)} />;
}

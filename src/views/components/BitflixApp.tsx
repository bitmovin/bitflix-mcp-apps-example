import { useEffect, useRef, useState } from "react";
import { useDisplayMode } from "skybridge/web";
import { BRAND, type Brand, type BrowsePayload, type PlayerPayload, type Title } from "../../catalog.js";
import { useCallTool } from "../../helpers.js";
import { useAutoHeight } from "../hooks.js";
import type { PlayerAPI } from "bitmovin-player";
import type { CastState } from "./BitmovinPlayer.js";
import { BitmovinPlayerLazy } from "./BitmovinPlayerLazy.js";
import { ICON, coverArt } from "./cover.js";
import "@/index.css";

type Rail = { id: string; title: string; subtitle?: string; layout?: string; items: Title[] };
type Payload = BrowsePayload | PlayerPayload;

const Ico = ({ html }: { html: string }) => <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;

// ── small pieces ───────────────────────────────────────────────────────────
function FooterNote({ brand }: { brand: Brand }) {
  return (
    <div className="footer-note">
      <b>{brand.name}</b> — a streaming service inside the chat · video by <b>Bitmovin Player</b>
    </div>
  );
}

function Badges({ items }: { items: string[] }) {
  return (
    <span className="badges">
      {items.map((b, i) =>
        b.toUpperCase() === "LIVE" ? (
          <span key={i} className="badge live">{b}</span>
        ) : (
          <span key={i} className="badge">{b}</span>
        ),
      )}
    </span>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="onair-time">{p(now.getHours())}:{p(now.getMinutes())}:{p(now.getSeconds())}</span>;
}

function Topbar({ brand, prompt }: { brand: Brand; prompt?: string }) {
  return (
    <div className="topbar">
      <div className="wordmark">{brand.wordmark}<span className="dot">.</span></div>
      <div className="onair" aria-label="On air" title="Bitflix is broadcasting">
        <span className="onair-dot" />ON AIR<LiveClock />
      </div>
      <div className="spacer" />
      {prompt ? <div className="prompt-chip"><span className="mic" />{`“${prompt}”`}</div> : null}
    </div>
  );
}

function Card({ t, layout, onPlay }: { t: Title; layout: string; onPlay: (t: Title) => void }) {
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onPlay(t)}
      onKeyDown={(e) => {
        // Match a real button's key activation, which a button role does not grant:
        // Enter fires on press, Space on release.
        if (e.key === "Enter") {
          e.preventDefault();
          onPlay(t);
        } else if (e.key === " ") {
          e.preventDefault(); // Suppress the view scroll
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") onPlay(t);
      }}
    >
      <div className="art">
        <div className="cover-fill" aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverArt(t.cover, t.title.charAt(0)) }} />
        <div className="play-overlay" aria-hidden="true"><div className="disc" dangerouslySetInnerHTML={{ __html: ICON.play }} /></div>
        <div className="corner">
          {t.badges.includes("LIVE") ? <span className="badge live">LIVE</span> : t.badges.includes("NEW") ? <span className="badge">NEW</span> : null}
        </div>
      </div>
      <div className="meta">
        <div className="t">{t.title}</div>
        <div className="k">{t.kicker}</div>
        {layout === "live" && (t.score || t.liveLabel) ? (
          <div className="liverow">
            {t.score ? <span className="score">{t.score}</span> : null}
            {t.liveLabel ? <span className="live-clock">{t.liveLabel}</span> : null}
          </div>
        ) : null}
        {typeof t.progressPct === "number" ? <div className="progress"><span style={{ width: `${t.progressPct}%` }} /></div> : null}
      </div>
    </div>
  );
}

function RailRow({ section, onPlay }: { section: Rail; onPlay: (t: Title) => void }) {
  if (!section.items.length) return null;
  return (
    <div className={`rail layout-${section.layout || "poster"} reveal`}>
      <div className="rail-head">
        <h3>{section.title}</h3>
        {section.subtitle ? <span className="sub">{section.subtitle}</span> : null}
      </div>
      <div className="track">
        {section.items.map((t) => <Card key={t.id} t={t} layout={section.layout || "poster"} onPlay={onPlay} />)}
      </div>
    </div>
  );
}

function Hero({ p, onPlay }: { p: BrowsePayload; onPlay: (t: Title) => void }) {
  const t = p.sections.flatMap((s) => s.items).find((x) => x.id === p.featuredId) || p.sections[0]?.items[0];
  if (!t) return null;
  return (
    <div className="hero reveal" onClick={() => onPlay(t)}>
      <div className="art"><div className="cover-fill" aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverArt(t.cover, t.title.charAt(0), { hero: true }) }} /></div>
      <div className="scrim" />
      <div className="hero-inner">
        <div className="kicker">{t.kicker}</div>
        <div className="metarow" style={{ marginTop: 0, marginBottom: 14 }}>
          <Badges items={t.badges} />
          {t.score ? <span className="score">{t.score}</span> : null}
          {t.liveLabel ? <span className="live-clock">{t.liveLabel}</span> : null}
        </div>
        <h2>{t.title}</h2>
        <p className="syn">{t.synopsis}</p>
        <div className="hero-actions">
          <button className="btn btn-play" onClick={(e) => { e.stopPropagation(); onPlay(t); }}><Ico html={ICON.play} />Play</button>
          <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); onPlay(t); }}><Ico html={ICON.info} />More info</button>
        </div>
      </div>
    </div>
  );
}

// ── chips ───────────────────────────────────────────────────────────────────
type ChipDef = { label: string; key: string; tool: "browse_catalog" | "get_recommendations" | "whats_live"; args?: Record<string, unknown> };
const CHIPS: ChipDef[] = [
  { label: "Home", key: "home", tool: "browse_catalog" },
  { label: "For You", key: "foryou", tool: "get_recommendations" },
  { label: "Live", key: "live", tool: "whats_live" },
  { label: "Sports", key: "sports", tool: "browse_catalog", args: { category: "sports" } },
  { label: "News", key: "news", tool: "browse_catalog", args: { category: "news" } },
  { label: "Films", key: "films", tool: "browse_catalog", args: { category: "films" } },
  { label: "Originals", key: "originals", tool: "browse_catalog", args: { category: "originals" } },
];

function activeChipFor(p: BrowsePayload): string | undefined {
  const h = p.headline.toLowerCase();
  if (h.includes("picked for you") || h.includes("because you mentioned")) return "foryou";
  if (h.includes("on air")) return "live";
  if (h.startsWith("good")) return "home";
  for (const k of ["sports", "news", "films", "originals"]) if (h.includes(k)) return k;
  return undefined;
}

// ── views ───────────────────────────────────────────────────────────────────
function BrowseView({ p, onPlay, onChip, activeKey }: { p: BrowsePayload; onPlay: (t: Title) => void; onChip: (c: ChipDef) => void; activeKey?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useAutoHeight(rootRef);

  return (
    <div className="bitflix-root" ref={rootRef}>
      <Topbar brand={p.brand} prompt={p.brand.tagline} />
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c.key} className={`chip ${c.key === activeKey ? "is-active" : ""}`} onClick={() => onChip(c)}>{c.label}</button>
        ))}
      </div>
      <div className="headline reveal">
        <h1>{p.headline}</h1>
        {p.subhead ? <p>{p.subhead}</p> : null}
      </div>
      <Hero p={p} onPlay={onPlay} />
      {p.sections.map((s) => <RailRow key={s.id} section={s as Rail} onPlay={onPlay} />)}
      <FooterNote brand={p.brand} />
      <div data-llm="" style={{ display: "none" }}>
        {`Bitflix is open on "${p.headline}". Rails: ${p.sections.map((s) => s.title).join(", ")}. The user can play any title or ask for more.`}
      </div>
    </div>
  );
}

function PlayerView({ p, onBack, onPlay }: { p: PlayerPayload; onBack: () => void; onPlay: (t: Title) => void }) {
  const [displayMode, setDisplayMode] = useDisplayMode();
  const playerRef = useRef<PlayerAPI | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cast, setCast] = useState<CastState>({ available: false, casting: false });
  const t = p.title;
  const isFs = displayMode === "fullscreen";

  useAutoHeight(rootRef);

  // reset cast state when the title changes (player remounts)
  useEffect(() => { setCast({ available: false, casting: false }); }, [t.id]);

  const castLabel = cast.casting ? `Casting${cast.device ? ` · ${cast.device}` : ""}` : cast.available ? "Cast to TV" : "Cast unavailable";
  const onCastClick = () => {
    const pl = playerRef.current;
    if (!pl) return;
    // Real Bitmovin Player Google Cast API — castVideo() opens the browser's
    // native Cast device chooser; no fake device list.
    try { if (cast.casting) pl.castStop(); else pl.castVideo(); } catch { /* ignore */ }
  };

  return (
    <div className="bitflix-root" ref={rootRef}>
      <div className="player-view">
        <Topbar brand={p.brand} />
        <div className="player-shell">
          <BitmovinPlayerLazy
            title={t}
            licenseKey={p.licenseKey}
            onPlayerReady={(pl) => { playerRef.current = pl; }}
            onCast={setCast}
          />
        </div>
        <div className="player-bar">
          <div className="titleblock">
            <div className="kicker">{t.kicker}</div>
            <h2>{t.title}</h2>
            <div className="metarow">
              <Badges items={t.badges} />
              {t.score ? <span className="score">{t.score}</span> : null}
              {t.rating ? <span className="small">{t.rating}</span> : null}
              {t.year ? <><span className="dotsep">·</span><span className="small">{t.year}</span></> : null}
              {t.durationMin ? <><span className="dotsep">·</span><span className="small">{t.durationMin} min</span></> : null}
            </div>
            <p className="syn">{t.synopsis}</p>
          </div>
          <div className="controls">
            <button className="iconbtn" onClick={onBack}><Ico html={ICON.back} />Back</button>
            <button
              className={`iconbtn ${cast.available || cast.casting ? "accent" : ""}`}
              disabled={!cast.available && !cast.casting}
              title={cast.available || cast.casting ? "Google Cast" : "No Google Cast receiver available in this host sandbox"}
              onClick={onCastClick}
            ><Ico html={ICON.cast} />{castLabel}</button>
            <button className="iconbtn" onClick={() => setDisplayMode(isFs ? "inline" : "fullscreen")}><Ico html={ICON.tv} />{isFs ? "Exit" : "Fullscreen"}</button>
          </div>
        </div>
        {p.upNext?.length ? <RailRow section={{ id: "upnext", title: "Up Next", layout: "wide", items: p.upNext }} onPlay={onPlay} /> : null}
        <FooterNote brand={p.brand} />
      </div>
      <div data-llm="" style={{ display: "none" }}>
        {`The user is watching "${t.title}" (${t.kicker}) in the Bitflix player${cast.casting ? `, cast via Google Cast to ${cast.device || "a device"} (this device is now a remote)` : cast.available ? " on this device (a Google Cast receiver is available)" : " on this device (no Google Cast receiver available in this MCP host sandbox)"}.${t.score ? ` Score: ${t.score}.` : ""} Up next: ${p.upNext.map((u) => u.title).join(", ")}.`}
      </div>
    </div>
  );
}

// ── root ────────────────────────────────────────────────────────────────────
function makePlayer(title: Title, browse: BrowsePayload | null, licenseKey: string, base?: Payload): PlayerPayload {
  const all = browse ? browse.sections.flatMap((s) => s.items) : base && base.view === "player" ? base.upNext : [];
  const upNext = all.filter((t) => t.id !== title.id).slice(0, 4);
  const brand = browse?.brand ?? base?.brand ?? BRAND;
  return { view: "player", brand, title, upNext, licenseKey };
}

export function BitflixApp({ payload }: { payload?: Payload }) {
  const browseCall = useCallTool("browse_catalog");
  const recCall = useCallTool("get_recommendations");
  const liveCall = useCallTool("whats_live");

  const [nav, setNav] = useState<Payload | null>(null);
  const [localTitle, setLocalTitle] = useState<Title | null>(null);

  // Reset interaction state when a new tool result arrives.
  const payloadKey = payload ? (payload.view === "browse" ? `b:${payload.headline}` : `p:${payload.title.id}`) : "none";
  useEffect(() => { setNav(null); setLocalTitle(null); }, [payloadKey]);

  const base: Payload | undefined = nav ?? payload;
  const lastBrowseRef = useRef<BrowsePayload | null>(null);
  if (base && base.view === "browse") lastBrowseRef.current = base;
  const licenseKey = (base?.licenseKey || lastBrowseRef.current?.licenseKey) ?? "";

  const onChip = (c: ChipDef) => {
    setLocalTitle(null);
    const hook = c.tool === "browse_catalog" ? browseCall : c.tool === "get_recommendations" ? recCall : liveCall;
    hook
      .callToolAsync(c.args ?? {})
      .then((r: any) => { if (r?.structuredContent) setNav(r.structuredContent as Payload); })
      .catch(() => {});
  };

  const play = (t: Title) => setLocalTitle(t);
  const back = () => {
    setLocalTitle(null);
    if (lastBrowseRef.current) setNav(lastBrowseRef.current);
    else browseCall.callToolAsync({}).then((r: any) => r?.structuredContent && setNav(r.structuredContent as Payload)).catch(() => {});
  };

  const displayed: Payload | undefined = localTitle ? makePlayer(localTitle, lastBrowseRef.current, licenseKey, base) : base;

  if (!displayed) return <div className="bitflix-root"><div className="empty">Loading Bitflix…</div></div>;
  if (displayed.view === "player") return <PlayerView p={displayed} onBack={back} onPlay={play} />;
  return <BrowseView p={displayed} onPlay={play} onChip={onChip} activeKey={activeChipFor(displayed)} />;
}

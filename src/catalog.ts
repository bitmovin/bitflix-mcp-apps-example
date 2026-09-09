// ─────────────────────────────────────────────────────────────────────────
// Bitflix — catalog
// ─────────────────────────────────────────────────────────────────────────
// The content backbone of the demo. This is the single source of truth the
// MCP tools query: browse, recommend, what's-live, and play all resolve
// against the titles below.
//
// Every `stream` is a real, publicly playable HLS/DASH manifest. Their origins
// must appear in VIEW_CSP (src/server.ts), which decides what the widget
// sandbox lets the player fetch. The metadata, titles, scores and cover art
// are fictional dressing on top. This is what a streaming network ("Bitflix")
// would expose if it built its catalog as an MCP App instead of a grid of
// tiles on a TV.
// ─────────────────────────────────────────────────────────────────────────

export type StreamType = "hls" | "dash";

export interface Stream {
  url: string;
  type: StreamType;
}

/** A procedural cover-art recipe. The widget draws the artwork from this —
 *  no external image fetches, so nothing to be blocked by the iframe CSP. */
export interface Cover {
  from: string; // gradient start
  to: string; // gradient end
  accent: string; // bright highlight (stripe / glow / motif ink)
  motif: Motif; // which generative scene the widget paints
}

export type Motif =
  | "court" // basketball
  | "pitch" // football/soccer
  | "ice" // hockey
  | "newsroom" // broadcast news
  | "globe" // world / markets
  | "film" // cinema
  | "summit" // mountains / nature doc
  | "orbit" // science / space
  | "stage"; // music / culture

export type Kind =
  | "live"
  | "game"
  | "news"
  | "film"
  | "series"
  | "highlight"
  | "original"
  | "doc";

export interface Title {
  id: string;
  title: string;
  kind: Kind;
  kicker: string; // eyebrow, e.g. "NBA · Conference Finals"
  synopsis: string;
  badges: string[]; // e.g. ["LIVE", "4K", "HDR"]
  rating?: string; // "TV-14", "PG-13", …
  year?: number;
  durationMin?: number; // VOD runtime
  liveLabel?: string; // "Q3 · 7:42", "Top of the hour"
  score?: string; // "LAL 88 — BOS 84"
  progressPct?: number; // continue-watching progress (0–100)
  tags: string[]; // for search + recommendations
  cover: Cover;
  stream: Stream;
  sourceConfig?: Record<string, unknown>; // optional Bitmovin source config (DRM, subtitles, poster…)
}

export interface Section {
  id: string;
  title: string;
  subtitle?: string;
  layout?: "poster" | "wide" | "live"; // hint for the widget's rail style
  itemIds: string[];
}

// ── Streams ───────────────────────────────────────────────────────────────
// The clear HLS and DASH renditions of Bitmovin's "Art of Motion" test asset,
// as recommended by the Bitmovin MCP connector's `streams://recommended`
// resource. Titles alternate between the two so both pipelines get exercised.
// Restricting the catalog to these keeps playback working in every MCP host
// sandbox, with no third-party-CDN CORS surprises.
const VOD_HLS: Stream = { url: "https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8", type: "hls" };
const VOD_DASH: Stream = { url: "https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd", type: "dash" };

// Genuinely-LIVE stream for the "live" titles — a real live edge, not VOD
// dressed up as live. We use DASH-IF's livesim2, which is fully public: CORS *
// and self-hosted segments, so it plays from inside any MCP host sandbox.
// (Many live test streams serve their segments from a Referer-locked origin,
// which 403s from a sandboxed widget; livesim2 has no such restriction.)
const LIVE_DASH: Stream = { url: "https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd", type: "dash" };

// ── DRM (protected) test streams ────────────────────────────────────────────
// The Bitmovin "Art of Motion" DRM asset is multi-DRM (Widevine + PlayReady in
// the same DASH manifest). We attach ONE key system per title via
// sourceConfig.drm, so each title independently probes whether that CDM is
// available in the MCP host's sandbox. Which one plays tells you exactly which
// DRM the host exposes:
//   Widevine  → Chromium hosts (Chrome, Claude desktop, ChatGPT web)
//   PlayReady → Edge / Windows only
//   FairPlay  → Safari only (covered by the diagnostics EME probe — there's no
//               public LA/cert to attach for this asset, so we don't fake one)
const DRM_DASH = "https://cdn.bitmovin.com/content/assets/art-of-motion_drm/mpds/11331.mpd";
const WIDEVINE_LA = "https://cwip-shaka-proxy.appspot.com/no_auth";
const PLAYREADY_LA = "https://test.playready.microsoft.com/service/rightsmanager.asmx?PlayRight=1&ContentKey=EAtsIJQPd5pFiRUrV9Layw==";

// ── Palette helpers — keep covers cohesive with the widget's dark canvas ──
const EMBER = "#FF6A1A";
const SIGNAL = "#FF2D55";
const COURT = "#FF8A3D";
const TURF = "#34D17A";
const ICEBLUE = "#5BC8FF";
const GOLD = "#E9B949";
const VIOLET = "#8A6BFF";
const MINT = "#46E0C0";

export const TITLES: Title[] = [
  // ── LIVE ───────────────────────────────────────────────────────────────
  {
    id: "live-finals-g6",
    title: "Pacific Finals · Game 6",
    kind: "game",
    kicker: "Bitflix Sports · NBA-style Live",
    synopsis:
      "Win or go home. The Los Angeles Surge host the Boston Tide with the series on the line — a wire-to-wire thriller with the league's two MVP front-runners trading blows.",
    badges: ["LIVE", "4K", "HDR"],
    liveLabel: "Q3 · 7:42",
    score: "LAS 78 — BOS 74",
    tags: ["basketball", "nba", "sports", "live", "playoffs", "surge", "tide"],
    cover: { from: "#2A0E04", to: "#0B0604", accent: COURT, motif: "court" },
    stream: LIVE_DASH,
  },
  {
    id: "live-newsroom",
    title: "Bitflix Now",
    kind: "news",
    kicker: "Bitflix News · 24/7 Live",
    synopsis:
      "The rolling newsroom. Breaking headlines, market moves and on-the-ground reporting, refreshed continuously throughout the day.",
    badges: ["LIVE", "BREAKING"],
    liveLabel: "On air",
    tags: ["news", "breaking", "world", "markets", "live", "newsroom"],
    cover: { from: "#06121F", to: "#02060B", accent: SIGNAL, motif: "newsroom" },
    stream: LIVE_DASH,
  },
  {
    id: "live-derby",
    title: "City Derby · Matchday Live",
    kind: "game",
    kicker: "Bitflix Sports · Football Live",
    synopsis:
      "Two halves of the city, one trophy. Harbour United visit Riverside in a sold-out derby with the title race hanging in the balance.",
    badges: ["LIVE", "4K"],
    liveLabel: "63'",
    score: "HAR 1 — RIV 1",
    tags: ["football", "soccer", "derby", "sports", "live", "premier"],
    cover: { from: "#04140B", to: "#020806", accent: TURF, motif: "pitch" },
    stream: LIVE_DASH,
  },

  // ── CONTINUE WATCHING ────────────────────────────────────────────────────
  {
    id: "film-aurora",
    title: "Aurora",
    kind: "film",
    kicker: "Bitflix Original Film",
    synopsis:
      "A lighthouse keeper on a vanishing coast becomes the unlikely guardian of a secret that could rewrite the tides. A luminous, slow-burning fable.",
    badges: ["4K", "DOLBY VISION"],
    rating: "PG-13",
    year: 2024,
    durationMin: 118,
    progressPct: 42,
    tags: ["film", "drama", "original", "fantasy", "ocean", "award"],
    cover: { from: "#10142E", to: "#04050E", accent: VIOLET, motif: "film" },
    stream: VOD_HLS,
  },
  {
    id: "doc-summit",
    title: "The Vertical Mile",
    kind: "doc",
    kicker: "Bitflix Documentary",
    synopsis:
      "Four climbers, one unclimbed face, and a weather window measured in minutes. Shot over three seasons at altitude.",
    badges: ["4K", "HDR"],
    rating: "TV-PG",
    year: 2023,
    durationMin: 64,
    progressPct: 71,
    tags: ["documentary", "nature", "climbing", "mountains", "adventure"],
    cover: { from: "#0A1C24", to: "#03080B", accent: ICEBLUE, motif: "summit" },
    stream: VOD_DASH,
  },

  // ── TONIGHT'S GAMES / SPORTS ─────────────────────────────────────────────
  {
    id: "game-tipoff-replay",
    title: "Surge @ Kings · Full Replay",
    kind: "highlight",
    kicker: "NBA-style · Last Night",
    synopsis:
      "Missed it live? The full broadcast of the Surge's road win, condensed broadcast and full-length cuts available.",
    badges: ["REPLAY", "4K"],
    durationMin: 142,
    tags: ["basketball", "nba", "replay", "sports", "surge", "kings"],
    cover: { from: "#241004", to: "#0A0603", accent: COURT, motif: "court" },
    stream: VOD_HLS,
  },
  {
    id: "game-top10",
    title: "Top 10 Plays of the Week",
    kind: "highlight",
    kicker: "Bitflix Sports · Highlights",
    synopsis:
      "Posterizing dunks, half-court buzzer beaters and a no-look pass that breaks the internet. This week's ten best, ranked.",
    badges: ["NEW", "4K"],
    durationMin: 9,
    tags: ["highlights", "basketball", "dunks", "sports", "top10"],
    cover: { from: "#2A1206", to: "#0A0503", accent: EMBER, motif: "court" },
    stream: VOD_DASH,
  },
  {
    id: "game-ice-classic",
    title: "Winter Classic · Frozen Final",
    kind: "game",
    kicker: "Bitflix Sports · Hockey",
    synopsis:
      "An outdoor final under the lights. The Frost meet the Blades in overtime with snow falling on center ice.",
    badges: ["REPLAY", "4K", "HDR"],
    durationMin: 156,
    score: "FRO 3 — BLD 2 (OT)",
    tags: ["hockey", "sports", "winter", "overtime", "classic"],
    cover: { from: "#08202C", to: "#020708", accent: ICEBLUE, motif: "ice" },
    stream: VOD_DASH,
  },

  // ── THE NEWSROOM ─────────────────────────────────────────────────────────
  {
    id: "news-markets",
    title: "Closing Bell",
    kind: "news",
    kicker: "Bitflix Business",
    synopsis:
      "The day on the markets in twenty minutes — what moved, who's exposed, and what to watch when trading opens tomorrow.",
    badges: ["NEW"],
    durationMin: 22,
    tags: ["news", "business", "markets", "finance", "economy"],
    cover: { from: "#04161A", to: "#01080A", accent: MINT, motif: "globe" },
    stream: VOD_HLS,
  },
  {
    id: "news-world",
    title: "The World at Seven",
    kind: "news",
    kicker: "Bitflix News · Flagship",
    synopsis:
      "Bitflix's flagship evening bulletin. The stories shaping the day, reported from six continents.",
    badges: ["NEW"],
    durationMin: 48,
    tags: ["news", "world", "evening", "flagship", "global"],
    cover: { from: "#0A1020", to: "#02040A", accent: ICEBLUE, motif: "globe" },
    stream: VOD_HLS,
  },
  {
    id: "news-deepdive",
    title: "Dateline: The Long Read",
    kind: "news",
    kicker: "Bitflix Investigates",
    synopsis:
      "A single story, told in full. This week: the supply chain that powers your phone — and the town betting everything on it.",
    badges: ["EXCLUSIVE"],
    durationMin: 38,
    tags: ["news", "investigation", "documentary", "longform", "exclusive"],
    cover: { from: "#1A0A18", to: "#070207", accent: SIGNAL, motif: "newsroom" },
    stream: VOD_DASH,
  },

  // ── BITFLIX ORIGINALS ───────────────────────────────────────────────────
  {
    id: "orig-orbit",
    title: "Orbit",
    kind: "original",
    kicker: "Bitflix Original Series",
    synopsis:
      "The crew of a decommissioned station discovers they were never meant to come home. A claustrophobic sci-fi thriller in six parts.",
    badges: ["NEW SEASON", "4K", "HDR"],
    rating: "TV-MA",
    year: 2025,
    durationMin: 52,
    tags: ["series", "scifi", "original", "space", "thriller", "drama"],
    cover: { from: "#0B0A2A", to: "#030210", accent: VIOLET, motif: "orbit" },
    stream: VOD_DASH,
  },
  {
    id: "orig-encore",
    title: "Encore",
    kind: "original",
    kicker: "Bitflix Original Series",
    synopsis:
      "A washed-up conductor takes over a youth orchestra in a town that's forgotten how to listen. Warm, funny, and quietly devastating.",
    badges: ["EMMY-WINNER"],
    rating: "TV-14",
    year: 2024,
    durationMin: 47,
    tags: ["series", "music", "drama", "original", "comedy", "award"],
    cover: { from: "#241608", to: "#0A0703", accent: GOLD, motif: "stage" },
    stream: VOD_HLS,
  },
  {
    id: "orig-tides",
    title: "Tideline",
    kind: "original",
    kicker: "Bitflix Original Series",
    synopsis:
      "Two families, one disputed stretch of coast, and a body that surfaces with the spring tide. A salt-bleached crime saga.",
    badges: ["NEW"],
    rating: "TV-MA",
    year: 2025,
    durationMin: 55,
    tags: ["series", "crime", "thriller", "original", "mystery"],
    cover: { from: "#02161C", to: "#010708", accent: MINT, motif: "summit" },
    stream: VOD_DASH,
  },

  // ── FILMS WE LOVE ─────────────────────────────────────────────────────────
  {
    id: "film-steel",
    title: "Tears of Steel",
    kind: "film",
    kicker: "Sci-Fi · Modern Classic",
    synopsis:
      "Amsterdam, in a future of war between humans and machines. A group of warriors and scientists gather to stop the robots.",
    badges: ["4K"],
    rating: "PG-13",
    year: 2012,
    durationMin: 12,
    tags: ["film", "scifi", "action", "classic", "robots"],
    cover: { from: "#1C0A06", to: "#070302", accent: EMBER, motif: "film" },
    stream: VOD_DASH,
  },
  {
    id: "film-sintel",
    title: "Sintel",
    kind: "film",
    kicker: "Animated · Modern Classic",
    synopsis:
      "A lonely young woman crosses a hostile world in search of the dragon she once raised — and the cost of finding it.",
    badges: ["4K"],
    rating: "PG",
    year: 2010,
    durationMin: 15,
    tags: ["film", "animation", "fantasy", "adventure", "classic"],
    cover: { from: "#221608", to: "#080502", accent: GOLD, motif: "summit" },
    stream: VOD_HLS,
  },
  {
    id: "film-motion",
    title: "Art of Motion",
    kind: "film",
    kicker: "Action · Free-running",
    synopsis:
      "A breathless free-running short across rooftops and ruins — pure kinetic spectacle, shot to show off every pixel.",
    badges: ["4K", "HDR"],
    rating: "PG",
    year: 2016,
    durationMin: 4,
    tags: ["film", "action", "parkour", "sports", "showcase"],
    cover: { from: "#0A1A1E", to: "#030708", accent: MINT, motif: "stage" },
    stream: VOD_DASH,
  },

  // ── DRM LAB (protected — probes which CDM the MCP host's sandbox exposes) ──
  {
    id: "drm-widevine",
    title: "Art of Motion · Widevine",
    kind: "film",
    kicker: "Bitflix · DRM Lab",
    synopsis:
      "The Art of Motion asset behind Widevine DRM. If this plays, the MCP host's sandbox exposes the Widevine CDM — Chromium-based hosts (Claude desktop, ChatGPT web) do.",
    badges: ["DRM", "WIDEVINE", "4K"],
    tags: ["drm", "widevine", "protected", "lab", "test"],
    cover: { from: "#0B0A2A", to: "#030210", accent: VIOLET, motif: "orbit" },
    stream: { url: DRM_DASH, type: "dash" },
    sourceConfig: { drm: { widevine: { LA_URL: WIDEVINE_LA } } },
  },
  {
    id: "drm-playready",
    title: "Art of Motion · PlayReady",
    kind: "film",
    kicker: "Bitflix · DRM Lab",
    synopsis:
      "The same asset behind PlayReady DRM. Expected to play only on Edge/Windows; in a Chromium sandbox it should fail with a key-system error — which is itself the data point.",
    badges: ["DRM", "PLAYREADY", "4K"],
    tags: ["drm", "playready", "protected", "lab", "test"],
    cover: { from: "#241608", to: "#0A0703", accent: GOLD, motif: "stage" },
    stream: { url: DRM_DASH, type: "dash" },
    sourceConfig: { drm: { playready: { LA_URL: PLAYREADY_LA } } },
  },
];

// ── Sections (the "rows" of the home screen) ──────────────────────────────
export const HOME_SECTIONS: Section[] = [
  {
    id: "live",
    title: "Live Right Now",
    subtitle: "On air across Bitflix",
    layout: "live",
    itemIds: ["live-finals-g6", "live-newsroom", "live-derby"],
  },
  {
    id: "continue",
    title: "Continue Watching",
    layout: "wide",
    itemIds: ["film-aurora", "doc-summit"],
  },
  {
    id: "games",
    title: "Tonight's Games & Highlights",
    layout: "wide",
    itemIds: ["game-tipoff-replay", "game-top10", "game-ice-classic"],
  },
  {
    id: "news",
    title: "The Newsroom",
    layout: "poster",
    itemIds: ["news-world", "news-markets", "news-deepdive"],
  },
  {
    id: "originals",
    title: "Bitflix Originals",
    subtitle: "You won't find these anywhere else",
    layout: "poster",
    itemIds: ["orig-orbit", "orig-encore", "orig-tides"],
  },
  {
    id: "films",
    title: "Films We Love",
    layout: "poster",
    itemIds: ["film-steel", "film-sintel", "film-motion"],
  },
  {
    id: "drm",
    title: "DRM Lab",
    subtitle: "Which content protection does this MCP host actually allow?",
    layout: "wide",
    itemIds: ["drm-widevine", "drm-playready"],
  },
];

// ── Lookups & helpers ──────────────────────────────────────────────────────
const BY_ID = new Map(TITLES.map((t) => [t.id, t]));

export function getTitle(id: string): Title | undefined {
  return BY_ID.get(id);
}

/**
 * Look up a title by id, treating absence as an authoring error.
 *
 * Throws and names the id when it is unknown, so a mistyped reference surfaces
 * immediately instead of dropping an item from the screen.
 */
function requireTitle(id: string): Title {
  const title = BY_ID.get(id);
  if (!title) throw new Error(`Catalog references unknown title id "${id}"`);
  return title;
}

export function liveTitles(): Title[] {
  return TITLES.filter((t) => t.badges.includes("LIVE"));
}

/** Free-text search across title, kicker, kind, synopsis and tags. */
export function search(query: string): Title[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored = TITLES.map((t) => {
    const haystack = [
      t.title,
      t.kicker,
      t.kind,
      t.synopsis,
      ...t.tags,
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (t.title.toLowerCase().includes(term)) score += 5;
      if (t.tags.some((tag) => tag === term)) score += 4;
      if (haystack.includes(term)) score += 1;
    }
    // a bare "live" / "news" / "sports" intent should surface live content
    if (terms.includes("live") && t.badges.includes("LIVE")) score += 3;
    return { t, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.t);
}

/** Resolve a title by exact id first, then by best free-text match. */
export function resolveTitle(idOrQuery: string): Title | undefined {
  return BY_ID.get(idOrQuery) ?? search(idOrQuery)[0];
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  sports: ["basketball", "football", "soccer", "hockey", "highlights", "nba"],
  news: ["news", "world", "markets", "business", "breaking"],
  films: ["film", "movie", "cinema"],
  originals: ["original", "series"],
  live: ["live"],
  documentary: ["documentary", "doc", "nature"],
  drm: ["drm", "widevine", "playready", "protected"],
};

/** Filter the catalog down to a loose category bucket. */
export function byCategory(category: string): Title[] {
  const c = category.trim().toLowerCase();
  const syns = CATEGORY_SYNONYMS[c] ?? [c];
  return TITLES.filter(
    (t) =>
      syns.includes(t.kind) ||
      t.tags.some((tag) => syns.includes(tag)) ||
      (c === "live" && t.badges.includes("LIVE")),
  );
}

export interface Brand {
  name: string;
  tagline: string;
  wordmark: string;
}

export const BRAND: Brand = {
  name: "Bitflix",
  tagline: "Just say what you want to watch.",
  wordmark: "BITFLIX",
};

export type BrowseScreen = "home" | "live" | "recommendations" | "category" | "search";

interface BrowsePayloadBase {
  view: "browse";
  brand: Brand;
  headline: string;
  subhead?: string;
  /** Title the hero frame leads with. Absent when the screen has no items. */
  featuredId?: string;
  sections: { id: string; title: string; subtitle?: string; layout?: string; items: Title[] }[];
  licenseKey: string;
}

export type BrowsePayload =
  | (BrowsePayloadBase & { screen: Exclude<BrowseScreen, "category"> })
  | (BrowsePayloadBase & { screen: "category"; category: string });

export interface PlayerPayload {
  view: "player";
  brand: Brand;
  title: Title;
  upNext: Title[];
  licenseKey: string;
}

export interface DiagnosticsPayload {
  view: "diagnostics";
  brand: Brand;
  /** Protected titles the panel can attempt, one per key system. */
  drmTitles: Title[];
  licenseKey: string;
}

function hydrate(section: Section) {
  return {
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    layout: section.layout,
    items: section.itemIds.map((id) => requireTitle(id)),
  };
}

/** The full home screen. */
export function homePayload(licenseKey: string): BrowsePayload {
  return {
    view: "browse",
    brand: BRAND,
    screen: "home",
    headline: "Good evening.",
    subhead: "Here's what's worth your time tonight.",
    featuredId: "live-finals-g6",
    sections: HOME_SECTIONS.map(hydrate),
    licenseKey,
  };
}

/** A browse screen scoped to a category or free-text query. */
export function categoryPayload(licenseKey: string, query: string): BrowsePayload {
  const bucket = query.trim().toLowerCase();
  const isCategory = bucket in CATEGORY_SYNONYMS;
  const results = isCategory ? byCategory(query) : search(query);
  const items = results.length ? results : byCategory("live");
  const common: BrowsePayloadBase = {
    view: "browse",
    brand: BRAND,
    headline: results.length ? `Results for "${query}"` : "Nothing exact — here's what's live",
    subhead: results.length ? `${items.length} title${items.length === 1 ? "" : "s"} in Bitflix` : undefined,
    featuredId: items[0]?.id,
    sections: [
      { id: "results", title: query.replace(/\b\w/g, (m) => m.toUpperCase()), layout: "poster", items },
    ],
    licenseKey,
  };
  return isCategory ? { ...common, screen: "category", category: bucket } : { ...common, screen: "search" };
}

/** Live-only browse screen. */
export function livePayload(licenseKey: string): BrowsePayload {
  const items = liveTitles();
  return {
    view: "browse",
    brand: BRAND,
    screen: "live",
    headline: "On air right now",
    subhead: `${items.length} live channels across sports and news`,
    featuredId: items[0]?.id,
    sections: [{ id: "live", title: "Live Right Now", layout: "live", items }],
    licenseKey,
  };
}

/** Personalized recommendations. `context` lets the model bias the rails
 *  (e.g. "in the mood for something short", "loves basketball"). */
export function recommendationsPayload(licenseKey: string, context?: string): BrowsePayload {
  const ctx = (context ?? "").toLowerCase();
  // The titles the recommendations are pitched as following from.
  const continueWatching = [requireTitle("film-aurora"), requireTitle("doc-summit")];
  // What watching Aurora and The Vertical Mile leads to: more originals + docs.
  const becauseYouWatched = [
    requireTitle("orig-orbit"),
    requireTitle("orig-tides"),
    requireTitle("film-sintel"),
    requireTitle("orig-encore"),
  ];
  // Bias toward sports if the context mentions it
  if (/(basket|sport|game|nba|dunk)/.test(ctx)) {
    becauseYouWatched.unshift(requireTitle("live-finals-g6"), requireTitle("game-top10"));
  }
  const newThisWeek = [
    requireTitle("orig-orbit"),
    requireTitle("game-top10"),
    requireTitle("news-deepdive"),
    requireTitle("orig-tides"),
  ];
  return {
    view: "browse",
    brand: BRAND,
    screen: "recommendations",
    headline: "Picked for you",
    subhead: context
      ? `Because you mentioned: "${context}"`
      : "Based on what you've been watching lately",
    featuredId: becauseYouWatched[0]?.id,
    sections: [
      {
        id: "because",
        title: "Because you watched Aurora",
        layout: "wide",
        items: becauseYouWatched,
      },
      {
        id: "continue",
        title: "Pick up where you left off",
        layout: "wide",
        items: continueWatching,
      },
      {
        id: "new",
        title: "New this week",
        layout: "poster",
        items: newThisWeek,
      },
    ],
    licenseKey,
  };
}

/** The video-capability probe screen, with the protected titles it can try. */
export function diagnosticsPayload(licenseKey: string): DiagnosticsPayload {
  return {
    view: "diagnostics",
    brand: BRAND,
    drmTitles: [requireTitle("drm-widevine"), requireTitle("drm-playready")],
    licenseKey,
  };
}

export function playerPayload(licenseKey: string, title: Title): PlayerPayload {
  // "Up next" = a few same-kind / shared-tag siblings
  const upNext = TITLES.filter(
    (t) => t.id !== title.id && (t.kind === title.kind || t.tags.some((tag) => title.tags.includes(tag))),
  ).slice(0, 4);
  return { view: "player", brand: BRAND, title, upNext, licenseKey };
}

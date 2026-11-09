// ─────────────────────────────────────────────────────────────────────────
// Bitflix Editions
// ─────────────────────────────────────────────────────────────────────────
// One codebase, several apps. Each edition is Bitflix as one kind of video
// provider would ship it: a sports league, a news broadcaster, a streaming
// service. A deployment serves exactly one edition, picked by the
// BITFLIX_EDITION environment variable, so each edition is its own MCP server,
// connector and ChatGPT nav entry. `all` is the original Bitflix with every
// tool, including Bitflix Discover, and stays the default.
//
// An edition decides: its name, which titles it carries, its home screen, its
// filter chips, which tools it registers, and which tools are its ChatGPT
// entry points (one global, one thread at most, per the OpenAI plugin
// extensions).
// ─────────────────────────────────────────────────────────────────────────

import type { Brand, ChipDef, Section, Title } from './catalog.js';

export const EDITION_IDS = ['all', 'sports', 'news', 'streaming'] as const;
export type EditionId = (typeof EDITION_IDS)[number];

/** Every tool the Bitflix server can register. */
export type BitflixTool =
  | 'browse_catalog'
  | 'get_recommendations'
  | 'whats_live'
  | 'matchday'
  | 'play_title'
  | 'run_diagnostics'
  | 'discover'
  | 'trailer_reel'
  | 'preview_film';

export interface Edition {
  id: EditionId;
  /** MCP server name reported to the host. */
  serverName: string;
  /** One line on what this app is, reported to the host. */
  description: string;
  brand: Brand;
  /** What the catalogue holds, for tool descriptions: "live games, replays and highlights". */
  scope: string;
  /** Example categories the model may pass to browse_catalog. */
  categories: string[];
  /** Whether a title belongs to this edition. Search, browse, live and up-next stay inside it. */
  includes: (t: Title) => boolean;
  /** Tools this edition registers; the rest of the server's tools are left out. */
  tools: readonly BitflixTool[];
  /** ChatGPT entry points: `global` opens from the left nav, `thread` from a chat's side panel. */
  entrypoints: { global?: BitflixTool; thread?: BitflixTool };
  /** Tool titles, which ChatGPT shows as entry-point labels. A thread entry needs one that differs from the app name. */
  titles: Partial<Record<BitflixTool, string>>;
  chips: ChipDef[];
  home: { headline: string; subhead: string; featuredId: string; sections: Section[] };
  live: { headline: string; title: string };
}

const isSport = (t: Title) => t.tags.includes('sports') && t.kind !== 'film';
const isNews = (t: Title) => t.kind === 'news';
const isStreaming = (t: Title) => ['film', 'original', 'doc', 'series'].includes(t.kind) && !t.tags.includes('drm');

const chip = (label: string, key: string, category?: string): ChipDef =>
  category ? { label, key, tool: 'browse_catalog', category } : { label, key, tool: 'browse_catalog' };

export const EDITIONS: Record<EditionId, Edition> = {
  all: {
    id: 'all',
    serverName: 'bitflix',
    description: 'Bitflix: a demo streaming service inside the chat, with Bitflix Discover.',
    brand: { name: 'Bitflix', tagline: 'Just say what you want to watch.', wordmark: 'BITFLIX' },
    scope: "live now, continue watching, tonight's games, the newsroom, originals, films",
    categories: ['sports', 'news', 'films', 'originals', 'live', 'documentary'],
    includes: () => true,
    tools: [
      'browse_catalog',
      'get_recommendations',
      'whats_live',
      'matchday',
      'play_title',
      'discover',
      'trailer_reel',
      'preview_film',
      'run_diagnostics',
    ],
    entrypoints: { global: 'discover', thread: 'trailer_reel' },
    titles: { discover: 'Discover', trailer_reel: 'Trailer Reel' },
    chips: [
      chip('Home', 'home'),
      { label: 'For You', key: 'foryou', tool: 'get_recommendations' },
      { label: 'Live', key: 'live', tool: 'whats_live' },
      { label: 'Matchday', key: 'matchday', tool: 'matchday' },
      chip('Sports', 'sports', 'sports'),
      chip('News', 'news', 'news'),
      chip('Films', 'films', 'films'),
      chip('Originals', 'originals', 'originals'),
    ],
    home: {
      headline: 'Good evening.',
      subhead: "Here's what's worth your time tonight.",
      featuredId: 'live-finals-g6',
      sections: [
        {
          id: 'live',
          title: 'Live Right Now',
          subtitle: 'On air across Bitflix',
          layout: 'live',
          itemIds: ['live-finals-g6', 'live-newsroom', 'live-derby'],
        },
        { id: 'continue', title: 'Continue Watching', layout: 'wide', itemIds: ['film-aurora', 'doc-summit'] },
        {
          id: 'games',
          title: "Tonight's Games & Highlights",
          layout: 'wide',
          itemIds: ['game-tipoff-replay', 'game-top10', 'game-ice-classic'],
        },
        {
          id: 'news',
          title: 'The Newsroom',
          layout: 'poster',
          itemIds: ['news-world', 'news-markets', 'news-deepdive'],
        },
        {
          id: 'originals',
          title: 'Bitflix Originals',
          subtitle: "You won't find these anywhere else",
          layout: 'poster',
          itemIds: ['orig-orbit', 'orig-encore', 'orig-tides'],
        },
        {
          id: 'films',
          title: 'Films We Love',
          layout: 'poster',
          itemIds: ['film-steel', 'film-sintel', 'film-motion'],
        },
        {
          id: 'drm',
          title: 'DRM Lab',
          subtitle: 'Which content protection does this MCP host actually allow?',
          layout: 'wide',
          itemIds: ['drm-widevine', 'drm-playready'],
        },
      ],
    },
    live: { headline: 'On air right now', title: 'Live Right Now' },
  },

  sports: {
    id: 'sports',
    serverName: 'bitflix-sports',
    description: 'Bitflix Sports: live games, full replays and highlights, inside the chat.',
    brand: { name: 'Bitflix Sports', tagline: 'Every game. Every play.', wordmark: 'BITFLIX', edition: 'Sports' },
    scope:
      'live games with scores, full game replays and highlights (basketball, football, hockey), and a match centre',
    categories: ['basketball', 'football', 'hockey', 'highlights', 'live'],
    includes: isSport,
    tools: ['browse_catalog', 'matchday', 'whats_live', 'play_title'],
    entrypoints: { global: 'browse_catalog', thread: 'whats_live' },
    titles: { browse_catalog: 'Bitflix Sports', matchday: 'Match Centre', whats_live: 'Live Scores' },
    chips: [
      chip('Home', 'home'),
      { label: 'Live', key: 'live', tool: 'whats_live' },
      { label: 'Match Centre', key: 'matchday', tool: 'matchday' },
      chip('Basketball', 'basketball', 'basketball'),
      chip('Football', 'football', 'football'),
      chip('Hockey', 'hockey', 'hockey'),
      chip('Highlights', 'highlights', 'highlights'),
    ],
    home: {
      headline: 'Game night.',
      subhead: 'Live games, full replays and the plays everyone is talking about.',
      featuredId: 'live-finals-g6',
      sections: [
        {
          id: 'live',
          title: 'Live Now',
          subtitle: 'On air now',
          layout: 'live',
          itemIds: ['live-finals-g6', 'live-derby'],
        },
        {
          id: 'replays',
          title: 'Full Game Replays',
          layout: 'wide',
          itemIds: ['game-tipoff-replay', 'game-ice-classic'],
        },
        { id: 'highlights', title: 'Highlights', layout: 'wide', itemIds: ['game-top10'] },
      ],
    },
    live: { headline: 'Live games', title: 'Live Now' },
  },

  news: {
    id: 'news',
    serverName: 'bitflix-news',
    description: 'Bitflix News: a 24/7 live channel and the latest bulletins, inside the chat.',
    brand: { name: 'Bitflix News', tagline: 'The news, when you ask for it.', wordmark: 'BITFLIX', edition: 'News' },
    scope: 'the 24/7 live news channel and bulletins on world news, business and investigations',
    categories: ['world', 'business', 'investigation', 'live'],
    includes: isNews,
    tools: ['browse_catalog', 'get_recommendations', 'whats_live', 'play_title'],
    entrypoints: { global: 'browse_catalog', thread: 'whats_live' },
    titles: { browse_catalog: 'Bitflix News', get_recommendations: 'Catch Me Up', whats_live: 'Live Channel' },
    chips: [
      chip('Home', 'home'),
      { label: 'Live', key: 'live', tool: 'whats_live' },
      { label: 'Catch Me Up', key: 'foryou', tool: 'get_recommendations' },
      chip('World', 'world', 'world'),
      chip('Business', 'business', 'business'),
      chip('Investigations', 'investigation', 'investigation'),
    ],
    home: {
      headline: 'The latest.',
      subhead: 'Live from the newsroom, and every bulletin you missed.',
      featuredId: 'live-newsroom',
      sections: [
        { id: 'live', title: 'Live: Bitflix Now', subtitle: 'On air 24/7', layout: 'live', itemIds: ['live-newsroom'] },
        { id: 'bulletins', title: 'Latest Bulletins', layout: 'wide', itemIds: ['news-world', 'news-markets'] },
        { id: 'indepth', title: 'In Depth', layout: 'poster', itemIds: ['news-deepdive'] },
      ],
    },
    live: { headline: 'Live from the newsroom', title: 'On Air' },
  },

  streaming: {
    id: 'streaming',
    serverName: 'bitflix-streaming',
    description: 'Bitflix Streaming: films, original series and documentaries, inside the chat.',
    brand: {
      name: 'Bitflix Streaming',
      tagline: 'Something good, every night.',
      wordmark: 'BITFLIX',
      edition: 'Streaming',
    },
    scope: 'films, original series and documentaries, with continue watching and recommendations',
    categories: ['films', 'originals', 'documentary', 'scifi', 'drama'],
    includes: isStreaming,
    tools: ['browse_catalog', 'get_recommendations', 'play_title'],
    entrypoints: { global: 'browse_catalog', thread: 'get_recommendations' },
    titles: { browse_catalog: 'Bitflix Streaming', get_recommendations: 'For You' },
    chips: [
      chip('Home', 'home'),
      { label: 'For You', key: 'foryou', tool: 'get_recommendations' },
      chip('Films', 'films', 'films'),
      chip('Originals', 'originals', 'originals'),
      chip('Documentaries', 'documentary', 'documentary'),
    ],
    home: {
      headline: 'Tonight on Bitflix.',
      subhead: 'Pick up where you left off, or start something new.',
      featuredId: 'film-aurora',
      sections: [
        { id: 'continue', title: 'Continue Watching', layout: 'wide', itemIds: ['film-aurora', 'doc-summit'] },
        {
          id: 'originals',
          title: 'Bitflix Originals',
          subtitle: "You won't find these anywhere else",
          layout: 'poster',
          itemIds: ['orig-orbit', 'orig-encore', 'orig-tides'],
        },
        { id: 'films', title: 'Films', layout: 'poster', itemIds: ['film-steel', 'film-sintel', 'film-motion'] },
        { id: 'docs', title: 'Documentaries', layout: 'wide', itemIds: ['doc-summit'] },
      ],
    },
    live: { headline: 'Nothing live right now', title: 'Live' },
  },
};

export function isEditionId(value: string): value is EditionId {
  return (EDITION_IDS as readonly string[]).includes(value);
}

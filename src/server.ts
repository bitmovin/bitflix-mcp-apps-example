import { Skybridge } from 'skybridge/server';
import * as z from 'zod';
import {
  type BrowsePayload,
  type PlayerPayload,
  categoryPayload,
  diagnosticsPayload,
  getTitle,
  homePayload,
  livePayload,
  playerPayload,
  recommendationsPayload,
  resolveTitle,
} from './catalog.js';
import { BRAND, STREAM_ORIGINS, WATCH_ORIGINS, getFilm } from './discover/catalog.js';
import {
  type DiscoverPayload,
  type FilmPayload,
  GENRES,
  QUERY_MAX_CHARS,
  type ReelPayload,
  type ViewMeta,
} from './discover/model.js';
import { discoverPayload, echo, filmPayload, reelPayload } from './discover/screens.js';
import { resolveFilm } from './discover/search.js';
import { env } from './env.js';

/**
 * Identity reported to the MCP host. Mirrors the name and version in package.json.
 */
const SERVER_INFO = { name: 'bitflix', version: '0.1.0' };

/**
 * Bitmovin Player license key, injected into every payload so the view can initialize the player.
 */
const KEY = env.BITMOVIN_PLAYER_KEY;
if (!KEY) {
  console.warn('WARNING: BITMOVIN_PLAYER_KEY not set — playback will fail to initialize.');
}

/**
 * Origins the views may reach beyond the server itself, which Skybridge adds automatically.
 *
 * - `connectDomains` carries manifest, segment and DRM license requests;
 * - `resourceDomains` carries fonts and scripts the widget loads, plus media the
 *   browser fetches on its own, as Safari does for HLS.
 *
 * A stream origin absent from here is blocked by the sandbox.
 */
const VIEW_CSP = {
  connectDomains: [
    'https://*.bitmovin.com', // VOD + DRM manifests/segments (Art of Motion)
    'https://*.dashif.org', // DASH-IF livesim2 (public live)
    'https://cwip-shaka-proxy.appspot.com', // Widevine license server (DRM Lab)
    'https://test.playready.microsoft.com', // PlayReady license server (DRM Lab)
    'https://fps.ezdrm.com', // FairPlay demo stream, certificate and license server (DRM Lab)
    'blob:',
    'data:',
  ],
  resourceDomains: [
    'https://fonts.googleapis.com', // Google Fonts stylesheet
    'https://fonts.gstatic.com', // Google Fonts files
    'https://www.gstatic.com', // Google Cast sender SDK (cast_sender.js)
    'https://*.bitmovin.com',
    'https://fps.ezdrm.com', // FairPlay demo stream under Safari's native HLS (DRM Lab)
    'blob:',
    'data:',
  ],
};

// ── Bitflix Discover ──────────────────────────────────────────────────────
// Content discovery: browse and search an open-movie catalogue, watch a short
// preview in the chat, then link out to where the full film plays. No DRM.
// Wired to the OpenAI plugin extensions: `discover` is the app's global entry
// point (left nav, fullscreen) and `trailer_reel` its thread entry point (side
// panel). ChatGPT allows one of each per app. See src/discover/.

/**
 * Unlike the Bitflix payloads, Discover sends the player license key in each
 * tool result's `_meta`, which only the widget reads, not in
 * `structuredContent`, which hosts also hand to the model.
 */
const VIEW_META: ViewMeta = { licenseKey: KEY };

/**
 * Origins the Discover views may reach beyond the server itself, which Skybridge adds automatically.
 *
 * - `connectDomains`: manifests, segments and subtitles from the catalogue's
 *   STREAM_ORIGINS (clear streams only, no DRM), plus the Bitmovin Player's
 *   license check;
 * - `resourceDomains`: the Google Fonts the theme loads, and `blob:` for the
 *   player's Media Source playback;
 * - `redirectDomains`: where the "watch" links go, derived from the catalogue,
 *   so ChatGPT opens them without its safe-link interstitial.
 *
 * A stream origin absent from here is blocked by the sandbox.
 */
const DISCOVER_CSP = {
  connectDomains: [...STREAM_ORIGINS, 'https://licensing.bitmovin.com', 'blob:', 'data:'],
  resourceDomains: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'blob:', 'data:'],
  redirectDomains: WATCH_ORIGINS,
};

/**
 * OpenAI plugin extensions (DevDay 2026), declared through raw `_meta` because
 * Skybridge 2.0.x has no first-class field for them yet.
 *
 * - Entry points go on the TOOL as `_meta["openai/ui"].entrypoints`. ChatGPT
 *   calls an entry-point tool with `{}` when the user clicks it, so every input
 *   on these tools must be optional.
 * - Display modes go on the VIEW RESOURCE as `_meta["openai/ui"]`, so the host
 *   knows inline vs fullscreen before it renders. Never put a `ui` key in a
 *   view's `_meta`: Skybridge spreads it over the generated `ui` block and
 *   would drop the CSP.
 *
 * Hosts that do not implement the extensions (Claude, and others) ignore the
 * `openai/ui` keys and render the same views inline, as plain MCP Apps.
 *
 * Spec: https://github.com/openai/mcp-extensions/blob/main/docs/spec.md
 */
const INLINE_OR_FULLSCREEN = { 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] } };
const GLOBAL_ENTRYPOINT = { 'openai/ui': { entrypoints: [{ type: 'global' }] } };
const THREAD_ENTRYPOINT = { 'openai/ui': { entrypoints: [{ type: 'thread' }] } };

const QUERY = z.string().trim().max(QUERY_MAX_CHARS);
const READ_ONLY = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };

function discoverSummary(p: DiscoverPayload): string {
  const titles = [...new Set(p.rails.flatMap(r => r.items.map(f => f.title)))].slice(0, 12).join(', ');
  return `${BRAND.name} is showing "${p.headline}". Films shown: ${titles}. Each film can be previewed in the app where a preview exists, and watched in full on ${BRAND.watchProvider}.`;
}

function filmSummary(p: FilmPayload): string {
  const f = p.film;
  const preview = f.preview
    ? `A ${f.preview.durationSec}-second preview is playing in the app.`
    : 'No in-app preview is hosted for this film.';
  return `Showing "${f.title}" (${f.year}, ${f.genre}): ${f.logline} ${preview} The full film is free to watch on ${BRAND.watchProvider}: ${f.watchUrl}`;
}

function reelSummary(p: ReelPayload): string {
  return `The Trailer Reel is playing previews back to back: ${p.films.map(f => f.title).join(', ')}. Each links to the full film on ${BRAND.watchProvider}.`;
}

function browseSummary(p: BrowsePayload): string {
  const rails = p.sections.map(s => s.title).join(', ');
  const titles = p.sections
    .flatMap(s => s.items.map(i => i.title))
    .slice(0, 12)
    .join(', ');
  return `Bitflix is open on the "${p.headline}" screen${p.subhead ? ` (${p.subhead})` : ''}. Rails: ${rails}. Titles include: ${titles}. The user can play any of these, or ask for more.`;
}

function playerSummary(p: PlayerPayload): string {
  const t = p.title;
  return `Now playing "${t.title}" (${t.kicker}) in the Bitflix player.${t.score ? ` Score: ${t.score}.` : ''}${t.synopsis ? ` ${t.synopsis}` : ''} Up next: ${p.upNext.map(u => u.title).join(', ')}.`;
}

export const app = new Skybridge({
  ...SERVER_INFO,
  capabilities: {},
  // Runs on every request, so registration is all that belongs here.
  handler: server =>
    server
      // ── browse_catalog ───────────────────────────────────────────────
      .registerTool(
        {
          name: 'browse_catalog',
          description: [
            'Open the Bitflix streaming app — a streaming service that lives inside the chat.',
            "Call this whenever the user wants to see what's on, browse, or open Bitflix.",
            "No arguments returns the full home screen (live now, continue watching, tonight's games,",
            'the newsroom, originals, films). Pass `category` (sports, news, films, originals, live,',
            'documentary) or a free-text `query` to scope it. The user can click any title to play it.',
          ].join('\n'),
          inputSchema: {
            category: z
              .string()
              .optional()
              .describe('Optional category: sports, news, films, originals, live, documentary.'),
            query: z.string().optional().describe("Optional free-text search (e.g. 'basketball', 'space thriller')."),
          },
          annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          view: { component: 'browse', description: 'Bitflix home / browse screen', csp: VIEW_CSP },
          _meta: { 'openai/widgetAccessible': true },
        },
        ({ category, query }) => {
          const q = query || category;
          const p = q ? categoryPayload({ licenseKey: KEY, query: q }) : homePayload(KEY);
          return { structuredContent: p, content: [{ type: 'text', text: browseSummary(p) }], isError: false };
        },
      )
      // ── get_recommendations ──────────────────────────────────────────
      .registerTool(
        {
          name: 'get_recommendations',
          description: [
            "Render a personalized Bitflix screen: 'because you watched', 'continue watching', 'new this week'.",
            "Call when the user asks what to watch, wants a recommendation, or asks what's new.",
            "Pass `context` to bias picks toward sport (e.g. 'loves basketball', 'wants a game on').",
          ].join('\n'),
          inputSchema: {
            context: z
              .string()
              .optional()
              .describe('A sport or game the user follows; moves live sport and highlights to the front.'),
          },
          annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          view: { component: 'recommend', description: 'Bitflix personalized recommendations', csp: VIEW_CSP },
          _meta: { 'openai/widgetAccessible': true },
        },
        ({ context }) => {
          const p = recommendationsPayload({ licenseKey: KEY, context });
          return { structuredContent: p, content: [{ type: 'text', text: browseSummary(p) }], isError: false };
        },
      )
      // ── whats_live ───────────────────────────────────────────────────
      .registerTool(
        {
          name: 'whats_live',
          description: [
            'Show only what is live on Bitflix right now — live games and the 24/7 newsroom, with their',
            "current state (quarter, score, 'on air'). Call for 'what's on right now', 'any games on?', 'what's live?'.",
            'This lists what is on air; call `play_title` to start playing one of them.',
          ].join('\n'),
          inputSchema: {},
          annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          view: { component: 'live', description: 'Bitflix live now', csp: VIEW_CSP },
          _meta: { 'openai/widgetAccessible': true },
        },
        () => {
          const p = livePayload(KEY);
          return { structuredContent: p, content: [{ type: 'text', text: browseSummary(p) }], isError: false };
        },
      )
      // ── play_title ───────────────────────────────────────────────────
      .registerTool(
        {
          name: 'play_title',
          description: [
            'Start playback of a specific Bitflix title in the inline Bitmovin Player.',
            "Call when the user names something to watch ('play the finals', 'put on Orbit', 'put the news on').",
            'Pass the exact `id` (from a previous browse result) or a free-text `query` (title, team, topic).',
          ].join('\n'),
          inputSchema: {
            id: z.string().optional().describe('Exact title id from a previous browse/recommend result.'),
            query: z
              .string()
              .optional()
              .describe("Free-text title/team/topic, e.g. 'the derby', 'Orbit', 'closing bell'."),
          },
          annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          view: { component: 'player', description: 'Bitflix player', csp: VIEW_CSP },
          _meta: { 'openai/widgetAccessible': true },
        },
        ({ id, query }) => {
          const needle = id || query || '';
          const title = (id && getTitle(id)) || resolveTitle(needle);
          if (!title) {
            // No match — degrade to the live screen so the widget still renders.
            const p = livePayload(KEY);
            return {
              structuredContent: p,
              content: [{ type: 'text', text: `Couldn't find "${needle}". Showing what's live instead.` }],
              isError: false,
            };
          }
          const p = playerPayload({ licenseKey: KEY, title });
          return { structuredContent: p, content: [{ type: 'text', text: playerSummary(p) }], isError: false };
        },
      )
      // ── discover — global entry point (left nav bar, opens fullscreen) ──
      .registerTool(
        {
          name: 'discover',
          title: 'Discover',
          description: [
            'Open Bitflix Discover: browse and search a catalogue of films, preview them, and get a link to watch',
            "the full film. Call when the user wants to find something to watch, browse films, or asks what's good.",
            `No arguments opens the home screen. Pass \`genre\` to filter (${GENRES.join(', ')}),`,
            "or `query` to search by title or mood (e.g. 'dragons', 'something funny'). The user can tap any film.",
          ].join('\n'),
          inputSchema: {
            query: QUERY.optional().describe("Optional free-text search: a title or mood, e.g. 'dragons', 'spooky'."),
            genre: z
              .enum(GENRES)
              .optional()
              .describe('Optional genre filter. Combine with `query` to search within it.'),
          },
          annotations: READ_ONLY,
          view: {
            component: 'discover',
            description: 'Bitflix Discover: film catalogue and search',
            csp: DISCOVER_CSP,
            _meta: INLINE_OR_FULLSCREEN,
          },
          // The widget calls this itself, for search and the genre chips.
          _meta: { ...GLOBAL_ENTRYPOINT, 'openai/widgetAccessible': true },
        },
        ({ query, genre }) => {
          const p = discoverPayload({ query, genre });
          return { structuredContent: p, content: [{ type: 'text', text: discoverSummary(p) }], _meta: VIEW_META };
        },
      )
      // ── trailer_reel — thread entry point (side-panel tab next to a chat) ──
      .registerTool(
        {
          name: 'trailer_reel',
          title: 'Trailer Reel',
          description: [
            'Open the Trailer Reel: previews of the Bitflix Discover films, played back to back, each with a link',
            'to watch the full film. Call when the user wants to watch trailers or see previews while they chat.',
          ].join('\n'),
          inputSchema: {},
          annotations: READ_ONLY,
          view: {
            component: 'reel',
            description: 'Bitflix Discover: trailer reel',
            csp: DISCOVER_CSP,
            _meta: INLINE_OR_FULLSCREEN,
          },
          _meta: THREAD_ENTRYPOINT,
        },
        () => {
          const p = reelPayload();
          return { structuredContent: p, content: [{ type: 'text', text: reelSummary(p) }], _meta: VIEW_META };
        },
      )
      // ── preview_film — model-invoked, one title ──────────────────────────
      .registerTool(
        {
          name: 'preview_film',
          title: 'Preview a film',
          description: [
            'Show one film from Bitflix Discover with its preview and a link to watch it in full.',
            "Call when the user names a film ('show me Sintel', 'trailer for Tears of Steel', 'the bunny one').",
            'Pass the exact `id` from a previous result, or a free-text `query` with the title or what it is about.',
          ].join('\n'),
          inputSchema: {
            id: z.string().trim().max(64).optional().describe('Exact film id from a previous discover result.'),
            query: QUERY.optional().describe("Free-text title or description, e.g. 'the dragon film'."),
          },
          annotations: READ_ONLY,
          view: {
            component: 'film',
            description: 'Bitflix Discover: film preview',
            csp: DISCOVER_CSP,
            _meta: INLINE_OR_FULLSCREEN,
          },
          // The widget calls this itself when the user opens a film, for its related films.
          _meta: { 'openai/widgetAccessible': true },
        },
        ({ id, query }) => {
          // An unknown id falls back to the query, so a stale id does not hide a good title.
          const film = (id ? getFilm(id) : undefined) ?? (query ? resolveFilm(query) : undefined);
          if (!film) {
            // No match: degrade to a search screen so the view still renders something useful.
            const p = discoverPayload({ query });
            const asked = query || id;
            const text = asked
              ? `No film in Bitflix Discover matches "${echo(asked)}". ${discoverSummary(p)}`
              : `No film was named. ${discoverSummary(p)}`;
            return { structuredContent: p, content: [{ type: 'text', text }], _meta: VIEW_META };
          }
          const p = filmPayload(film);
          return { structuredContent: p, content: [{ type: 'text', text: filmSummary(p) }], _meta: VIEW_META };
        },
      )
      // ── run_diagnostics ──────────────────────────────────────────────
      .registerTool(
        {
          name: 'run_diagnostics',
          description: [
            "Open the Bitflix video-capability diagnostics panel — a probe of what the current MCP host's",
            'widget sandbox actually supports for video. It reports: EME/DRM key systems (Widevine, PlayReady,',
            'FairPlay, ClearKey), Media Source Extensions, Web Workers, WebAssembly, fullscreen (both the host',
            'display-mode request AND the native Fullscreen API), Picture-in-Picture, and autoplay policy — and',
            'can attempt real DRM playback. Call this when the user wants to test what works / gather feedback on',
            'video support in MCP Apps. After it renders, read the results back to the user.',
          ].join('\n'),
          inputSchema: {},
          annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          view: { component: 'diagnostics', description: 'Video capability diagnostics for MCP hosts', csp: VIEW_CSP },
          _meta: { 'openai/widgetAccessible': true },
        },
        () => {
          return {
            structuredContent: diagnosticsPayload(KEY),
            content: [
              {
                type: 'text',
                text: "Rendered the Bitflix video-capability diagnostics panel. It probes EME/DRM key systems (Widevine/PlayReady/FairPlay/ClearKey), MSE, Web Workers, WebAssembly, fullscreen (host display-mode + native API), Picture-in-Picture and autoplay, and can attempt real DRM playback. Ask the user what they'd like to test, then read the on-screen results back to them.",
              },
            ],
            isError: false,
          };
        },
      ),
});

export type AppType = typeof app;

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
 * - `resourceDomains` carries fonts and scripts the widget loads.
 *
 * A stream origin absent from here is blocked by the sandbox.
 */
const VIEW_CSP = {
  connectDomains: [
    'https://*.bitmovin.com', // VOD + DRM manifests/segments (Art of Motion)
    'https://*.dashif.org', // DASH-IF livesim2 (public live)
    'https://cwip-shaka-proxy.appspot.com', // Widevine license server (DRM Lab)
    'https://test.playready.microsoft.com', // PlayReady license server (DRM Lab)
    'blob:',
    'data:',
  ],
  resourceDomains: [
    'https://fonts.googleapis.com', // Google Fonts stylesheet
    'https://fonts.gstatic.com', // Google Fonts files
    'https://www.gstatic.com', // Google Cast sender SDK (cast_sender.js)
    'https://*.bitmovin.com',
    'blob:',
    'data:',
  ],
};

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

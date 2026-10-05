// ─────────────────────────────────────────────────────────────────────────
// Bitflix Discover — catalogue data (server only)
// ─────────────────────────────────────────────────────────────────────────
// The films the MCP tools browse, search and preview: eleven of the Blender
// Studio open movies, real films released under Creative Commons Attribution
// licenses, so the example is rights-clean end to end. Each film links out to
// its page on Blender Studio, which plays the role a streaming service plays
// for a media company: the assistant is where people discover a title and
// watch a preview, the service is where they watch the whole thing.
//
// Previews are clear (unencrypted) HLS/DASH, played by the Bitmovin Player.
// There is no DRM anywhere in this app, by design: discovery and previews do
// not need it, and DRM inside AI-assistant sandboxes is still unreliable.
//
// Only the server imports this module. Views receive films in tool results.
// ─────────────────────────────────────────────────────────────────────────

import type { Brand, Film, Stream } from './model.js';

export const BRAND: Brand = {
  name: 'Bitflix Discover',
  wordmark: 'BITFLIX',
  tagline: 'Find something to watch. Preview it here. Watch it where it lives.',
  watchProvider: 'Blender Studio',
};

// Blender Studio publishes its content under CC BY 4.0 "unless notified
// otherwise" (https://studio.blender.org/terms-and-conditions/); the oldest
// films carry earlier CC BY versions.
export const CREDITS =
  'Films © Blender Foundation | studio.blender.org, under Creative Commons Attribution licenses (CC BY 4.0 unless noted otherwise).';

// ── Streams ───────────────────────────────────────────────────────────────
// A widget runs in a sandboxed iframe on the host's own domain, so every media
// request is cross-site. A stream is only usable if its manifests AND segments
// answer that request with `Access-Control-Allow-Origin` — from the host's
// sandbox domain, and from the local DevTools playground people try the
// example in.
//
// These are public demo renditions hosted by Google (the Shaka Player demo
// assets) and Mux (their HLS test streams). They answer any origin, but
// Bitmovin does not control them, so they may change or disappear. (Bitmovin's
// own sample CDN, cdn.bitmovin.com, answers the Claude and ChatGPT sandbox
// origins but not localhost or other origins, so it cannot serve the local
// playground.)
//
// STREAM_ORIGINS is what src/server.ts allow-lists in the view CSP, and a unit
// test checks that every stream below is served from one of them.
export const STREAM_ORIGINS = ['https://storage.googleapis.com', 'https://test-streams.mux.dev'] as const;

// Google's Shaka Player demo assets. Sintel carries subtitles in ten languages,
// Tears of Steel in English and German.
const SINTEL: Stream = { url: 'https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd', type: 'dash' };
const TEARS_OF_STEEL: Stream = {
  url: 'https://storage.googleapis.com/shaka-demo-assets/tos-ttml/dash.mpd',
  type: 'dash',
};
// Mux's public HLS test stream of Big Buck Bunny.
const BIG_BUCK_BUNNY: Stream = { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'hls' };

const PREVIEW_SEC = 60;

// ── Palette — cohesive with the widget's dark canvas ──────────────────────
const EMBER = '#FF6A1A';
const SIGNAL = '#FF2D55';
const TURF = '#34D17A';
const ICEBLUE = '#5BC8FF';
const GOLD = '#E9B949';
const VIOLET = '#8A6BFF';
const MINT = '#46E0C0';

const studio = (slug: string) => `https://studio.blender.org/projects/${slug}/`;

export const FILMS: Film[] = [
  {
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    genre: 'Fantasy',
    logline:
      'A lone young woman crosses a hostile, frozen world in search of the baby dragon she once rescued and raised.',
    tags: ['fantasy', 'dragon', 'adventure', 'quest', 'animated', 'epic', 'snow'],
    cover: { from: '#1A0E22', to: '#06040A', accent: VIOLET, motif: 'summit' },
    watchUrl: studio('sintel'),
    runtimeSec: 888,
    preview: { stream: SINTEL, startSec: 30, durationSec: PREVIEW_SEC },
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    year: 2012,
    genre: 'Sci-fi',
    logline:
      'In a near-future Amsterdam, a group of warriors and scientists stage a last stand to save the world from destructive robots.',
    tags: ['sci-fi', 'robots', 'live action', 'vfx', 'amsterdam', 'future', 'action'],
    cover: { from: '#071822', to: '#02070B', accent: ICEBLUE, motif: 'orbit' },
    watchUrl: studio('tears-of-steel'),
    runtimeSec: 734,
    preview: { stream: TEARS_OF_STEEL, startSec: 90, durationSec: PREVIEW_SEC },
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    year: 2008,
    genre: 'Comedy',
    logline:
      'A gentle giant of a rabbit has had enough of three bullying rodents, and plans a comeback the whole meadow will remember.',
    tags: ['comedy', 'family', 'animals', 'rabbit', 'animated', 'kids', 'funny'],
    cover: { from: '#0A1A0E', to: '#030805', accent: TURF, motif: 'summit' },
    watchUrl: studio('big-buck-bunny'),
    runtimeSec: 635,
    preview: { stream: BIG_BUCK_BUNNY, startSec: 40, durationSec: PREVIEW_SEC },
  },
  {
    id: 'spring',
    title: 'Spring',
    year: 2019,
    genre: 'Fantasy',
    logline: 'A shepherd girl and her dog face ancient spirits to keep the cycle of life turning.',
    tags: ['fantasy', 'nature', 'spirits', 'dog', 'animated', 'beautiful'],
    cover: { from: '#081A16', to: '#020807', accent: MINT, motif: 'summit' },
    watchUrl: studio('spring'),
  },
  {
    id: 'sprite-fright',
    title: 'Sprite Fright',
    year: 2021,
    genre: 'Comedy',
    logline:
      'Rowdy teenagers trek into an isolated forest and meet peaceful mushroom creatures, who turn out to be an unexpected force of nature.',
    tags: ['comedy', 'horror', 'forest', 'teens', 'animated', 'spooky', 'halloween'],
    cover: { from: '#1C1006', to: '#080402', accent: GOLD, motif: 'stage' },
    watchUrl: studio('sprite-fright'),
  },
  {
    id: 'charge',
    title: 'Charge',
    year: 2022,
    genre: 'Action',
    logline:
      'In an energy-starved dystopia, an old man breaks into a battery factory and finds himself cornered by a deadly security droid.',
    tags: ['action', 'dystopia', 'robots', 'thriller', 'animated', 'tense'],
    cover: { from: '#200A0C', to: '#0A0304', accent: SIGNAL, motif: 'film' },
    watchUrl: studio('charge'),
  },
  {
    id: 'wing-it',
    title: 'Wing It!',
    year: 2023,
    genre: 'Comedy',
    logline:
      'An uptight engineer and an eager would-be pilot get launched skywards together inside an out-of-control spaceship.',
    tags: ['comedy', 'space', 'flight', 'animated', 'funny', 'family'],
    cover: { from: '#0D0B26', to: '#03020C', accent: VIOLET, motif: 'orbit' },
    watchUrl: studio('wing-it'),
  },
  {
    id: 'coffee-run',
    title: 'Coffee Run',
    year: 2020,
    genre: 'Drama',
    logline: 'Fuelled by caffeine, a young woman runs through the bittersweet memories of a past relationship.',
    tags: ['drama', 'romance', 'memories', 'animated', 'short'],
    cover: { from: '#22140A', to: '#090503', accent: EMBER, motif: 'film' },
    watchUrl: studio('coffee-run'),
  },
  {
    id: 'agent-327',
    title: 'Agent 327: Operation Barbershop',
    year: 2017,
    genre: 'Action',
    logline:
      "A secret agent's undercover visit to a barbershop goes sideways, fast. The first test for the Agent 327 project.",
    tags: ['action', 'spy', 'comedy', 'agent', 'animated'],
    cover: { from: '#1E1408', to: '#080503', accent: GOLD, motif: 'film' },
    watchUrl: studio('agent-327'),
  },
  {
    id: 'cosmos-laundromat',
    title: 'Cosmos Laundromat: First Cycle',
    year: 2015,
    genre: 'Sci-fi',
    logline:
      'On a desolate island, a disillusioned sheep meets a mysterious salesman who offers him the chance of a new life.',
    tags: ['sci-fi', 'surreal', 'sheep', 'animated', 'weird'],
    cover: { from: '#0A1820', to: '#03080B', accent: ICEBLUE, motif: 'globe' },
    watchUrl: studio('cosmos-laundromat'),
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    year: 2006,
    genre: 'Sci-fi',
    logline: 'Two men wander a vast, surreal machine of a world. Widely known as the first open movie ever made.',
    tags: ['sci-fi', 'surreal', 'classic', 'machine', 'animated'],
    cover: { from: '#1A0A1C', to: '#070308', accent: SIGNAL, motif: 'orbit' },
    watchUrl: studio('elephants-dream'),
  },
];

/**
 * Origins the "watch" links may open. src/server.ts declares them as the view's
 * redirect domains, so ChatGPT opens them without its safe-link interstitial.
 */
export const WATCH_ORIGINS: string[] = ['https://studio.blender.org'];

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Checks the fields the views trust. Cover colours are interpolated into SVG
 * markup, and the watch link goes to the host's link opener, so a film with
 * anything but #rrggbb colours or an https link on WATCH_ORIGINS is refused.
 * Run here once over the static data; a catalogue backend should run it on
 * every record it returns.
 */
export function checkFilm(f: Film): void {
  const url = URL.parse(f.watchUrl);
  if (!url || url.protocol !== 'https:' || !WATCH_ORIGINS.includes(url.origin)) {
    throw new Error(`${f.id}: watch link ${f.watchUrl} is not an https URL on WATCH_ORIGINS`);
  }
  for (const colour of [f.cover.from, f.cover.to, f.cover.accent]) {
    if (!HEX.test(colour)) {
      throw new Error(`${f.id}: cover colour ${colour} is not #rrggbb`);
    }
  }
}
FILMS.forEach(checkFilm);

const BY_ID = new Map(FILMS.map(f => [f.id, f]));

export function getFilm(id: string): Film | undefined {
  return BY_ID.get(id);
}

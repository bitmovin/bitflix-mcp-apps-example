// ─────────────────────────────────────────────────────────────────────────
// Bitflix — matchday
// ─────────────────────────────────────────────────────────────────────────
// A match centre for the live games: the scoreboard, the key moments, the
// stats, and the rest of the day's fixtures. Built for the "catch me up"
// conversation a fan has with an agent mid-game: the tool result carries the
// moments as text the model can narrate, and each moment plays as a replay
// clip in the same view.
//
// Fixtures, teams and moments are fictional. Live fixtures point at the live
// titles in the catalog, so the scoreboard agrees with the browse screens.
// Replay clips are windows into Bitmovin's sports mashup demo asset, each
// started where footage of the same sport begins.
// ─────────────────────────────────────────────────────────────────────────

import { BRAND, type Brand, type Cover, type Stream, type Title, getTitle } from './catalog.js';

/**
 * Bitmovin's 120-second sports mashup (HLS, 25 fps, up to 1440p). What plays where:
 *   0–15 stadium aerial · 16–23 football · 24–31 basketball · 32–55 track cycling
 *   56–63 basketball · 64–71 motor racing · 72–87 American football
 *   88–103 basketball · 104–111 football goal celebration · 112–119 outro
 *
 * The CDN restricts where this asset plays: it works in the local Skybridge
 * playground, but the ChatGPT and Claude widget sandboxes get a 403 until
 * their origins are allowlisted.
 */
export const SPORTS_HLS: Stream = {
  url: 'https://cdn.bitmovin.com/content/sports-mashup/sports-mashup-hls/m3u8/master.m3u8',
  type: 'hls',
};

export type Sport = 'football' | 'basketball' | 'american-football' | 'track-cycling';

export type MomentKind =
  | 'goal'
  | 'penalty'
  | 'card'
  | 'chance'
  | 'save'
  | 'sub'
  | 'basket'
  | 'block'
  | 'run'
  | 'fast-break'
  | 'play'
  | 'snap'
  | 'heat';

export const MOMENT_LABELS: Record<MomentKind, string> = {
  goal: 'Goal',
  penalty: 'Penalty',
  card: 'Yellow card',
  chance: 'Big chance',
  save: 'Save',
  sub: 'Substitution',
  basket: 'Basket',
  block: 'Block',
  run: 'Scoring run',
  'fast-break': 'Fast break',
  play: 'Big play',
  snap: 'At the line',
  heat: 'Win',
};

export interface Moment {
  id: string; // unique within its fixture
  clock: string; // "55'", "Q2 · 3:10"
  kind: MomentKind;
  side: 'home' | 'away';
  text: string;
  tags: string[]; // for free-text lookup ("equaliser", "the dunk")
  clipStartSec: number; // where the replay starts in the VOD asset
  clipEndSec: number; // where it stops, before the asset cuts to other footage
}

export interface Team {
  code: string; // three letters, as the catalog's score lines use
  name: string;
}

export interface Stat {
  label: string;
  home: number;
  away: number;
  unit?: '%';
}

interface FixtureBase {
  id: string;
  sport: Sport;
  competition: string;
  venue: string;
  home: Team;
  away: Team;
  tags: string[];
  moments: Moment[];
  stats: Stat[];
}

/**
 * A fixture on today's card, split by where it stands.
 *
 * Only a live fixture has a broadcast to watch, and only an upcoming one has no
 * score yet.
 */
export type Fixture =
  | (FixtureBase & { state: 'live'; titleId: string; clock: string; score: [number, number] })
  | (FixtureBase & { state: 'ft'; score: [number, number] })
  | (FixtureBase & { state: 'upcoming'; kickoff: string });

/** The length of the VOD asset the clips cut into, so a clip never starts past its end. */
export const CLIP_SOURCE_SEC = 120;

export const FIXTURES: Fixture[] = [
  {
    id: 'city-derby',
    state: 'live',
    titleId: 'live-derby',
    sport: 'football',
    competition: 'Premier Division · Matchday 11',
    venue: 'Riverside Park',
    home: { code: 'HAR', name: 'Harbour United' },
    away: { code: 'RIV', name: 'Riverside' },
    clock: "63'",
    score: [2, 0],
    tags: ['football', 'soccer', 'derby', 'harbour', 'riverside', 'premier', 'city'],
    // Harbour play in blue, Riverside in white, as in the footage.
    moments: [
      {
        id: 'solo-goal',
        clock: "12'",
        kind: 'goal',
        side: 'home',
        text: 'Okafor picks the ball up in midfield, runs at the Riverside back line, slips between two defenders and finishes past the keeper. Harbour lead.',
        tags: ['opener', 'first goal', 'solo', 'solo goal', 'run', 'dribble', 'okafor'],
        clipStartSec: 16,
        clipEndSec: 23.5,
      },
      {
        id: 'second-goal',
        clock: "58'",
        kind: 'goal',
        side: 'home',
        text: 'Adeyemi doubles the lead and the whole Harbour side piles on him by the corner flag. 2–0.',
        tags: ['second goal', 'celebration', 'pile on', 'adeyemi', '2-0', 'two nil'],
        clipStartSec: 104,
        clipEndSec: 111.5,
      },
    ],
    stats: [
      { label: 'Possession', home: 54, away: 46, unit: '%' },
      { label: 'Shots', home: 9, away: 5 },
      { label: 'On target', home: 5, away: 1 },
      { label: 'Expected goals', home: 1.8, away: 0.6 },
      { label: 'Corners', home: 6, away: 2 },
    ],
  },
  {
    id: 'pacific-g6',
    state: 'live',
    titleId: 'live-finals-g6',
    sport: 'basketball',
    competition: 'Pacific Finals · Game 6',
    venue: 'Surge Arena',
    home: { code: 'LAS', name: 'Los Angeles Surge' },
    away: { code: 'BOS', name: 'Boston Tide' },
    clock: 'Q3 · 7:42',
    score: [78, 74],
    tags: ['basketball', 'nba', 'finals', 'surge', 'tide', 'playoffs', 'game 6'],
    // The Surge play in yellow, the Tide in white, as in the footage.
    moments: [
      {
        id: 'quick-start',
        clock: 'Q1 · 9:40',
        kind: 'basket',
        side: 'home',
        text: 'The Surge push straight up the floor and attack the rim before the Tide defence is set.',
        tags: ['drive', 'layup', 'quick start', 'tip-off', 'first quarter', 'pace'],
        clipStartSec: 24,
        clipEndSec: 31.5,
      },
      {
        id: 'ball-movement',
        clock: 'Q2 · 4:50',
        kind: 'play',
        side: 'away',
        text: 'The Tide swing the ball side to side around the arc until the Surge defence breaks down.',
        tags: ['passing', 'ball movement', 'swing', 'tide', 'second quarter'],
        clipStartSec: 56,
        clipEndSec: 63.5,
      },
      {
        id: 'fast-break',
        clock: 'Q2 · 0:40',
        kind: 'fast-break',
        side: 'home',
        text: 'A defensive stop, and the Surge run the length of the floor in transition before the Tide can get back.',
        tags: ['fast break', 'transition', 'counter', 'stop', 'halftime'],
        clipStartSec: 88,
        clipEndSec: 95.5,
      },
      {
        id: 'lead-change',
        clock: 'Q3 · 8:20',
        kind: 'basket',
        side: 'home',
        text: 'A patient half-court set ends with Reyes driving the lane, and the Surge take their first lead since the opening minute.',
        tags: ['lead', 'drive', 'reyes', 'lead change', 'half-court', 'third quarter'],
        clipStartSec: 96,
        clipEndSec: 103.5,
      },
    ],
    stats: [
      { label: 'Field goals', home: 46, away: 44, unit: '%' },
      { label: 'Three-pointers', home: 9, away: 11 },
      { label: 'Rebounds', home: 31, away: 26 },
      { label: 'Assists', home: 17, away: 19 },
      { label: 'Turnovers', home: 7, away: 10 },
    ],
  },
  {
    id: 'coastal-semi',
    state: 'ft',
    sport: 'football',
    competition: 'Coastal Cup · Semi-final',
    venue: 'Northbay Stadium',
    home: { code: 'NOR', name: 'Northbay FC' },
    away: { code: 'PSA', name: 'Portside Athletic' },
    score: [1, 0],
    tags: ['football', 'soccer', 'cup', 'semi-final', 'northbay', 'portside', 'coastal'],
    // The mashup has one football goal, so this game's winner shows the
    // celebration, from two seconds into the derby’s second-goal clip.
    moments: [
      {
        id: 'late-winner',
        clock: "88'",
        kind: 'goal',
        side: 'home',
        text: 'Nakamura scores the late winner and the Northbay players bury him in a pile in front of their fans. Northbay go to the final.',
        tags: ['winner', 'late winner', 'goal', 'celebration', 'nakamura', 'final'],
        clipStartSec: 106,
        clipEndSec: 111.5,
      },
    ],
    stats: [
      { label: 'Possession', home: 41, away: 59, unit: '%' },
      { label: 'Shots', home: 8, away: 14 },
      { label: 'On target', home: 5, away: 3 },
      { label: 'Expected goals', home: 1.6, away: 0.9 },
    ],
  },
  {
    id: 'friday-lights',
    state: 'ft',
    sport: 'american-football',
    competition: 'Friday Night Lights · Week 9',
    venue: 'Northside Field',
    // The Knights play in black, the Rams in white, as in the footage.
    home: { code: 'NSK', name: 'Northside Knights' },
    away: { code: 'VAL', name: 'Valley Rams' },
    score: [24, 21],
    tags: [
      'american football',
      'gridiron',
      'nfl',
      'high school',
      'friday night',
      'knights',
      'rams',
      'northside',
      'valley',
    ],
    moments: [
      {
        id: 'at-the-line',
        clock: 'Q4 · 1:12',
        kind: 'snap',
        side: 'away',
        text: 'Down three, the Rams line up under the lights with the game on the line.',
        tags: ['line of scrimmage', 'snap', 'lineup', 'fourth quarter', 'rams'],
        clipStartSec: 72,
        clipEndSec: 79,
      },
      {
        id: 'breakaway-run',
        clock: 'Q4 · 1:05',
        kind: 'play',
        side: 'home',
        text: 'The Knights break a run into the open field and race for the end zone to seal it.',
        tags: ['run', 'breakaway', 'big play', 'end zone', 'knights', 'open field'],
        clipStartSec: 79,
        clipEndSec: 87.5,
      },
    ],
    stats: [
      { label: 'Total yards', home: 342, away: 318 },
      { label: 'Rushing yards', home: 168, away: 97 },
      { label: 'Penalties', home: 5, away: 7 },
      { label: 'Third-down conversions', home: 6, away: 4 },
    ],
  },
  {
    id: 'sprint-final',
    state: 'ft',
    sport: 'track-cycling',
    competition: 'Track Nations Cup · Sprint final',
    venue: 'City Velodrome',
    home: { code: 'KAI', name: 'Mila Kaiser' },
    away: { code: 'DUB', name: 'Léa Dubois' },
    // Heats won in the best-of-three final.
    score: [2, 1],
    tags: ['cycling', 'track cycling', 'velodrome', 'sprint', 'track', 'bike', 'kaiser', 'dubois', 'nations cup'],
    moments: [
      {
        id: 'heat-one',
        clock: 'Heat 1',
        kind: 'heat',
        side: 'away',
        text: 'Dubois leads out round the top of the banking and holds on down the home straight to take the first heat.',
        tags: ['heat 1', 'first heat', 'banking', 'dubois', 'lead out'],
        clipStartSec: 32,
        clipEndSec: 38,
      },
      {
        id: 'heat-two',
        clock: 'Heat 2',
        kind: 'heat',
        side: 'home',
        text: 'Kaiser dives down off the banking and comes past on the inside to level the final.',
        tags: ['heat 2', 'second heat', 'dive', 'inside', 'kaiser', 'level'],
        clipStartSec: 38,
        clipEndSec: 46.5,
      },
      {
        id: 'decider',
        clock: 'Heat 3',
        kind: 'heat',
        side: 'home',
        text: 'Shoulder to shoulder through the last lap, and Kaiser takes the decider and the title.',
        tags: ['heat 3', 'decider', 'final heat', 'last lap', 'kaiser', 'winner', 'title'],
        clipStartSec: 47,
        clipEndSec: 55.5,
      },
    ],
    stats: [
      { label: 'Top speed (km/h)', home: 74, away: 73 },
      { label: 'Last 200 m (s)', home: 10.4, away: 10.6 },
      { label: 'Heats won', home: 2, away: 1 },
    ],
  },
  {
    id: 'womens-series',
    state: 'upcoming',
    sport: 'football',
    competition: 'Women’s Champions Series · Group B',
    venue: 'Harbour Lane',
    home: { code: 'HRW', name: 'Harbour United Women' },
    away: { code: 'LKW', name: 'Lakeside Women' },
    kickoff: '20:45',
    tags: ['football', 'soccer', 'women', 'champions', 'harbour', 'lakeside'],
    moments: [],
    stats: [],
  },
];

const BY_ID = new Map(FIXTURES.map(f => [f.id, f]));

export function getFixture(id: string): Fixture | undefined {
  return BY_ID.get(id);
}

/** The fixture whose broadcast is the given live title, for a "match centre" link from the player. */
export function fixtureForTitle(titleId: string): Fixture | undefined {
  return FIXTURES.find(f => f.state === 'live' && f.titleId === titleId);
}

/** Words that say nothing about which game or moment is meant. */
const FILLER = new Set([
  'the',
  'a',
  'an',
  'of',
  'that',
  'this',
  'me',
  'show',
  'replay',
  'again',
  'moment',
  'game',
  'match',
  'v',
  'vs',
]);

/**
 * Score one bag of words against a query: whole tags and names weigh more than
 * a substring anywhere in the text. Every meaningful term must land somewhere,
 * so "red card" does not settle for a yellow one.
 */
function scoreTerms(query: string, words: string[], text: string): number {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t && !FILLER.has(t));
  if (!terms.length) {
    return 0;
  }
  const lower = words.map(w => w.toLowerCase());
  const hay = `${lower.join(' ')} ${text.toLowerCase()}`;
  let score = lower.includes(terms.join(' ')) ? 10 : 0;
  for (const term of terms) {
    if (!hay.includes(term)) {
      return 0;
    }
    score += lower.includes(term) ? 5 : 1;
  }
  return score;
}

/**
 * Resolve a fixture by id, by its live title's id, or by the best free-text
 * match on teams, competition and tags. Misses rather than guesses.
 */
export function resolveFixture(idOrQuery: string): Fixture | undefined {
  const exact = BY_ID.get(idOrQuery) ?? fixtureForTitle(idOrQuery);
  if (exact) {
    return exact;
  }
  const scored = FIXTURES.map(f => {
    const words = [f.home.code, f.home.name, f.away.code, f.away.name, f.competition, ...f.tags];
    return { f, score: scoreTerms(idOrQuery, words, `${f.venue} ${f.sport}`) };
  }).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.f;
}

/**
 * Resolve a moment within a fixture by id, or by the best free-text match on
 * its kind, clock, text and tags ("the equaliser", "55'", "the dunk").
 */
export function resolveMoment(fixture: Fixture, idOrQuery: string): Moment | undefined {
  const exact = fixture.moments.find(m => m.id === idOrQuery);
  if (exact) {
    return exact;
  }
  const scored = fixture.moments
    .map(m => {
      const team = fixture[m.side];
      const words = [m.kind, MOMENT_LABELS[m.kind], m.clock, team.code, team.name, ...m.tags];
      return { m, score: scoreTerms(idOrQuery, words, m.text) };
    })
    .filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.m;
}

const COVERS: Record<Sport, Cover> = {
  football: { from: '#04140B', to: '#020806', accent: '#34D17A', motif: 'pitch' },
  basketball: { from: '#2A0E04', to: '#0B0604', accent: '#FF8A3D', motif: 'court' },
  'american-football': { from: '#0B1220', to: '#03060B', accent: '#E8C547', motif: 'pitch' },
  'track-cycling': { from: '#1E1206', to: '#080402', accent: '#4FB3FF', motif: 'orbit' },
};

/** "HAR 2 — RIV 0", in the catalog's score-line format. Upcoming fixtures have none. */
export function scoreLine(f: Fixture): string | undefined {
  return f.state === 'upcoming' ? undefined : `${f.home.code} ${f.score[0]} — ${f.away.code} ${f.score[1]}`;
}

/**
 * A moment as a playable title: a replay clip cut from the sports mashup at the
 * moment's offset. The id is unique per fixture and moment, so the player
 * remounts on every switch.
 */
export function momentClip(f: Fixture, m: Moment): Title {
  return {
    id: `clip-${f.id}-${m.id}`,
    delivery: 'vod',
    title: `${m.clock} ${MOMENT_LABELS[m.kind]} · ${f[m.side].name}`,
    kind: 'highlight',
    kicker: `${f.competition} · Replay`,
    synopsis: m.text,
    badges: ['REPLAY'],
    tags: [f.sport, ...m.tags],
    cover: COVERS[f.sport],
    stream: SPORTS_HLS,
    sourceConfig: { options: { startOffset: m.clipStartSec } },
    clipEndSec: m.clipEndSec,
  };
}

export interface MatchdayPayload {
  view: 'matchday';
  brand: Brand;
  fixture: Fixture;
  live?: Title; // the broadcast, for a live fixture
  clips: Record<string, Title>; // replay clip per moment id
  focusMomentId?: string; // the moment to open on, when the user asked for one
  fixtures: Fixture[]; // the rest of today's card
  licenseKey: string;
}

/**
 * The match centre for one fixture, opening on a moment when one is given.
 */
export function matchdayPayload({
  licenseKey,
  fixture,
  moment,
  brand = BRAND,
}: {
  licenseKey: string;
  fixture: Fixture;
  moment?: Moment;
  brand?: Brand;
}): MatchdayPayload {
  return {
    view: 'matchday',
    brand,
    fixture,
    live: fixture.state === 'live' ? getTitle(fixture.titleId) : undefined,
    clips: Object.fromEntries(fixture.moments.map(m => [m.id, momentClip(fixture, m)])),
    focusMomentId: moment?.id,
    fixtures: FIXTURES.filter(f => f.id !== fixture.id),
    licenseKey,
  };
}

/** The fixture the match centre leads with when nobody names one: the first live game. */
export function defaultFixture(): Fixture {
  return FIXTURES.find(f => f.state === 'live') ?? FIXTURES[0]!;
}

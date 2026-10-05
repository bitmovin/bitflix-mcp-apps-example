// ─────────────────────────────────────────────────────────────────────────
// Bitflix Discover — search (server only)
// ─────────────────────────────────────────────────────────────────────────
// A small, deterministic scorer over the catalogue: good enough for "dragons",
// "something spooky" or "the bunny one", and honest about misses. A real
// catalogue would put a search service here; the tools would not change.
// ─────────────────────────────────────────────────────────────────────────

import { FILMS, getFilm } from './catalog.js';
import type { Film } from './model.js';

/** Words that carry no meaning in a film request and must not score on their own. */
const STOPWORDS = new Set(
  (
    'a an and any are about at be but by can do for from get give have i in into is it its just like me movie ' +
    'movies film films my of on one or play please preview previews put see show some something that the ' +
    'their them there these this to trailer trailers want watch what with you your'
  ).split(' '),
);

/** Only this many meaningful query words are scored, which bounds the work per request. */
export const MAX_QUERY_TOKENS = 8;

/** Longest query text considered at all; the tool schema caps input well below this. */
export const MAX_QUERY_CHARS = 200;

const MIN_PREFIX = 3; // shorter words only match whole words, never as a prefix
const MAX_SUFFIX = 2; // a prefix match may differ by this many letters: dragon/dragons, yes; run/runner, no

/**
 * Points per kind of hit. A title hit outweighs everything else, and a hit in
 * the logline alone is too weak to resolve a film by name (see resolveFilm).
 */
const WEIGHT = {
  exactTitle: 100, // the query is the title
  titlePhrase: 60, // the query appears in the title, from a word start ("big buck" → Big Buck Bunny)
  titleWord: 20,
  genre: 15,
  tagPhrase: 15, // a multi-word tag appears whole in the query ("live action")
  tagWord: 10,
  logline: 4,
};

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (s: string) => normalize(s).split(' ').filter(Boolean);

/** Bound a query's length at a word boundary, so a cut never leaves a fragment that prefix-matches. */
export function clip(query: string): string {
  if (query.length <= MAX_QUERY_CHARS) {
    return query;
  }
  const head = query.slice(0, MAX_QUERY_CHARS);
  const lastSpace = head.search(/\s\S*$/);
  return /\s/.test(query[MAX_QUERY_CHARS] ?? ' ') || lastSpace < 0 ? head : head.slice(0, lastSpace);
}

/** The meaningful words of a query: no stopwords, deduplicated, capped. */
export function queryTokens(query: string): string[] {
  return [...new Set(words(clip(query)).filter(t => !STOPWORDS.has(t)))].slice(0, MAX_QUERY_TOKENS);
}

/** A query normalized once, then scored against every film. */
interface Prepared {
  text: string;
  tokens: string[];
}

function prepare(query: string): Prepared {
  return { text: normalize(clip(query)), tokens: queryTokens(query) };
}

/**
 * Whole-word match, or a prefix match for words of 3+ letters that differ by a
 * short suffix only (dragon / dragons, robot / robots). A longer gap is another
 * word: "runner" must not find "Run", nor "bigfoot" find "Big".
 */
function wordMatches(token: string, candidate: string): boolean {
  if (token === candidate) {
    return true;
  }
  const shorter = token.length <= candidate.length ? token : candidate;
  const longer = shorter === token ? candidate : token;
  return shorter.length >= MIN_PREFIX && longer.length - shorter.length <= MAX_SUFFIX && longer.startsWith(shorter);
}

/** Whether `phrase` occurs in `text` starting at a word boundary ("big buck" in "big buck bunny", not "ring" in "spring"). */
const startsWordIn = (text: string, phrase: string) => text.startsWith(phrase) || text.includes(` ${phrase}`);

interface Indexed {
  film: Film;
  title: string;
  titleWords: string[];
  genre: string;
  tagPhrases: string[]; // multi-word tags, whole
  tagWords: string[];
  loglineWords: Set<string>;
}

// Tokenized once at module load, not per query.
const INDEX: Indexed[] = FILMS.map(film => {
  const tags = film.tags.map(normalize);
  return {
    film,
    title: normalize(film.title),
    titleWords: words(film.title),
    genre: normalize(film.genre),
    tagPhrases: tags.filter(t => t.includes(' ')),
    tagWords: [...new Set(tags.flatMap(t => t.split(' ')))],
    loglineWords: new Set(words(film.logline).filter(t => !STOPWORDS.has(t) && t.length > MIN_PREFIX)),
  };
});

export interface Score {
  total: number;
  strong: boolean; // matched the title, genre or a tag, not just loglines
  covered: boolean; // every meaningful query word matched something about this film
}

function score(entry: Indexed, { text: q, tokens }: Prepared): Score {
  let total = 0;
  let strong = false;
  let matched = 0;

  // Phrase matching only for queries with real words in them: "in" must not
  // find "S-in-tel".
  if (tokens.length > 0 && q.length >= MIN_PREFIX && startsWordIn(entry.title, q)) {
    total += entry.title === q ? WEIGHT.exactTitle : WEIGHT.titlePhrase;
    strong = true;
  }
  for (const phrase of entry.tagPhrases) {
    if (` ${q} `.includes(` ${phrase} `)) {
      total += WEIGHT.tagPhrase;
      strong = true;
    }
  }
  for (const t of tokens) {
    let hit = false;
    if (entry.titleWords.some(w => wordMatches(t, w))) {
      total += WEIGHT.titleWord;
      hit = true;
    }
    if (entry.genre === t || entry.genre.replace('-', '') === t.replace('-', '')) {
      total += WEIGHT.genre;
      hit = true;
    }
    if (entry.tagWords.some(w => wordMatches(t, w))) {
      total += WEIGHT.tagWord;
      hit = true;
    }
    strong ||= hit;
    if (entry.loglineWords.has(t)) {
      total += WEIGHT.logline;
      hit = true;
    }
    if (hit) {
      matched++;
    }
  }
  return { total, strong, covered: tokens.length > 0 && matched === tokens.length };
}

/** Score one film against a free-text query. Exposed for tests. */
export function scoreFilm(film: Film, query: string): Score {
  const entry = INDEX.find(e => e.film.id === film.id);
  return entry ? score(entry, prepare(query)) : { total: 0, strong: false, covered: false };
}

/** Films matching the query, best first. Ties keep catalogue order. */
export function searchFilms(query: string): Film[] {
  const prepared = prepare(query);
  return INDEX.map((entry, i) => ({ film: entry.film, i, s: score(entry, prepared) }))
    .filter(x => x.s.total > 0)
    .sort((a, b) => b.s.total - a.s.total || a.i - b.i)
    .map(x => x.film);
}

/**
 * Resolve a title id or a free-text name to one film, or to nothing. A film
 * qualifies only if the query hit its title, genre or a tag, AND every
 * meaningful word of the query matched it: "blade runner" shares "run" with
 * Coffee Run, and "man of steel" shares "steel" with Tears of Steel, but each
 * names some other film, so both must miss rather than guess. A tie misses
 * too ("animated" fits most films equally). A miss is cheap: the tool falls back
 * to search results for the same words.
 */
export function resolveFilm(needle: string): Film | undefined {
  const byId = getFilm(needle);
  if (byId) {
    return byId;
  }
  const prepared = prepare(needle);
  const [best, runnerUp] = INDEX.map(entry => ({ film: entry.film, s: score(entry, prepared) }))
    .filter(x => x.s.strong && x.s.covered)
    .sort((a, b) => b.s.total - a.s.total);
  return best && (!runnerUp || runnerUp.s.total < best.s.total) ? best.film : undefined;
}

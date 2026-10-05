// ─────────────────────────────────────────────────────────────────────────
// Bitflix Discover — screens (server only)
// ─────────────────────────────────────────────────────────────────────────
// Builds the structuredContent each tool returns: which rails a screen shows,
// in what order, with what copy. Kept apart from the data (catalog.ts) and the
// matching (search.ts) so a real catalogue backend only replaces those two.
// ─────────────────────────────────────────────────────────────────────────

import { BRAND, CREDITS, FILMS } from './catalog.js';
import {
  type DiscoverPayload,
  type Film,
  type FilmPayload,
  GENRES,
  type Genre,
  type Rail,
  type ReelPayload,
  hasPreview,
} from './model.js';
import { searchFilms } from './search.js';

export const GENRE_TITLES: Record<Genre, string> = {
  Fantasy: 'Fantasy & adventure',
  'Sci-fi': 'Science fiction',
  Comedy: 'Comedy',
  Action: 'Action',
  Drama: 'Drama',
};

const MIN_RAIL = 2; // a genre with fewer films folds into the catch-all rail on the home screen
const MAX_ECHO = 80; // longest query text repeated back in headlines and tool text

// Invisible characters that are not format controls (\p{Cf}): variation
// selectors, which can smuggle bytes, and blank fillers that render as nothing.
const INVISIBLE = /[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]+/gu;

/**
 * A query as it may be repeated back to the user and the model: one line,
 * no control or invisible characters, no double quotes, bounded. Tool inputs
 * are free text from a model that may itself be steered by content it read,
 * so nothing is echoed verbatim. Double quotes become single quotes, so a
 * query cannot close the quotes it is shown in and pass for server text.
 */
export function echo(text: string): string {
  const clean = text
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(INVISIBLE, ' ')
    .replace(/["“”„«»]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > MAX_ECHO ? `${clean.slice(0, MAX_ECHO - 1)}…` : clean;
}

/** How many of these films can be previewed here, phrased for a subhead. */
function previewNote(films: Film[]): string {
  const n = films.filter(hasPreview).length;
  if (n === 0) {
    return `watch on ${BRAND.watchProvider}`;
  }
  return n === films.length ? 'tap one to preview' : `${n} with a preview here`;
}

const count = (n: number) => `${n} film${n === 1 ? '' : 's'}`;

export interface DiscoverOptions {
  query?: string;
  genre?: Genre;
}

/**
 * The Discover screen: the home screen, a genre, or search results. A genre
 * filters on the film's genre exactly; a query is a free-text search over
 * titles, genres, tags and loglines. Both given: search within the genre.
 */
export function discoverPayload(opts: DiscoverOptions = {}): DiscoverPayload {
  const base = { view: 'discover' as const, brand: BRAND, credits: CREDITS };
  const raw = opts.query?.trim() || undefined; // searched in full
  const q = raw ? echo(raw) : undefined; // shown, and possibly shortened
  const genre = opts.genre;

  if (q || genre) {
    const pool = genre ? FILMS.filter(f => f.genre === genre) : FILMS;
    const results = raw ? searchFilms(raw).filter(f => pool.includes(f)) : pool;
    const where = genre ? GENRE_TITLES[genre] : undefined;
    const label = q ? `“${q}”${where ? ` in ${where}` : ''}` : (where ?? '');

    if (!results.length) {
      // Nothing matched: still offer something to watch, from inside the genre when one is set.
      const fallback = genre ? pool : FILMS.filter(hasPreview);
      return {
        ...base,
        query: q,
        genre,
        headline: `Nothing matched ${label}`,
        subhead: genre
          ? `Here is everything in ${where}.`
          : 'Try a genre (fantasy, sci-fi, comedy) or a mood (funny, spooky, epic).',
        rails: [
          genre
            ? { id: 'genre', title: `All of ${where}`, layout: 'poster', items: fallback }
            : { id: 'previewable', title: 'Preview these right here', layout: 'wide', items: fallback },
        ],
      };
    }

    return {
      ...base,
      query: q,
      genre,
      headline: q ? `Results for ${label}` : label,
      subhead: `${count(results.length)} · ${previewNote(results)}`,
      rails: [{ id: 'results', title: q ? 'Matches' : 'Films', layout: 'poster', items: results }],
    };
  }

  const previewable = FILMS.filter(hasPreview);
  const genreRails: Rail[] = GENRES.map(g => ({
    id: `genre-${g.toLowerCase()}`,
    title: GENRE_TITLES[g],
    layout: 'poster' as const,
    items: FILMS.filter(f => f.genre === g),
  }));
  const leftovers = genreRails.filter(r => r.items.length < MIN_RAIL).flatMap(r => r.items);

  return {
    ...base,
    headline: 'What are we watching?',
    subhead: `${FILMS.length} open movies. Preview ${previewable.length} of them right here, then watch any of them on ${BRAND.watchProvider}.`,
    featuredId: previewable[0]?.id,
    rails: [
      {
        id: 'previewable',
        title: 'Preview these right here',
        subtitle: 'In-chat previews',
        layout: 'wide',
        items: previewable,
      },
      ...genreRails.filter(r => r.items.length >= MIN_RAIL),
      ...(leftovers.length
        ? [{ id: 'more', title: 'More open movies', layout: 'poster' as const, items: leftovers }]
        : []),
    ],
  };
}

const MAX_RELATED = 4;

/**
 * Up to four other films, same genre first, then the rest in catalogue order.
 * The only source of "More like this": the view asks preview_film for it
 * rather than working it out from the films it happens to have on screen.
 */
export function relatedFilms(film: Film): Film[] {
  const others = FILMS.filter(f => f.id !== film.id);
  return [...others.filter(f => f.genre === film.genre), ...others.filter(f => f.genre !== film.genre)].slice(
    0,
    MAX_RELATED,
  );
}

export function filmPayload(film: Film): FilmPayload {
  return { view: 'film', brand: BRAND, credits: CREDITS, film, related: relatedFilms(film) };
}

export function reelPayload(): ReelPayload {
  return { view: 'reel', brand: BRAND, credits: CREDITS, films: FILMS.filter(hasPreview) };
}

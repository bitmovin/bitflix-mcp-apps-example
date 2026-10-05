// ─────────────────────────────────────────────────────────────────────────
// Bitflix Discover — shared model
// ─────────────────────────────────────────────────────────────────────────
// Types and small pure helpers shared by the server and the views. This module
// holds no catalogue data, so importing it from a view never ships the
// catalogue to the browser: the views only know the films the server sends.
// ESLint enforces that views import catalogue, search and screen modules for
// types only.
// ─────────────────────────────────────────────────────────────────────────

export type StreamType = 'hls' | 'dash';

export interface Stream {
  url: string;
  type: StreamType;
}

// Cover recipes use Bitflix's cover-art types, so both catalogues share one painter.
export type { Cover, Motif } from '../catalog.js';
import type { Cover } from '../catalog.js';

export const GENRES = ['Fantasy', 'Sci-fi', 'Comedy', 'Action', 'Drama'] as const;

/** Longest search text a tool accepts; the widget's search box uses the same limit. */
export const QUERY_MAX_CHARS = 100;

/** Playback this far before a preview window's start still counts as inside it (keyframe alignment). */
const PREVIEW_SLACK_SEC = 1;
export type Genre = (typeof GENRES)[number];

/**
 * An in-assistant preview: a window into the full film's stream, played from
 * `startSec` for `durationSec`, then handed off to the film's real home.
 */
export interface Preview {
  stream: Stream;
  startSec: number;
  durationSec: number;
}

export interface Film {
  id: string;
  title: string;
  year: number;
  genre: Genre;
  logline: string;
  tags: string[]; // for search
  cover: Cover;
  watchUrl: string; // where the full film lives
  runtimeSec?: number; // known for the films whose stream is hosted
  preview?: Preview; // absent when no stream is hosted for the title
}

export interface Rail {
  id: string;
  title: string;
  subtitle?: string;
  layout: 'poster' | 'wide';
  items: Film[];
}

export interface Brand {
  name: string;
  wordmark: string;
  tagline: string;
  watchProvider: string; // the service the "watch" links hand off to
}

// ── Payloads (a tool's structuredContent) ────────────────────────────────
// None of these carry the player license key: that travels in the tool
// result's `_meta`, which only the widget sees (see src/server.ts).

export interface DiscoverPayload {
  view: 'discover';
  brand: Brand;
  credits: string;
  headline: string;
  subhead?: string;
  query?: string;
  genre?: Genre;
  featuredId?: string; // set on the home screen only
  rails: Rail[];
}

export interface FilmPayload {
  view: 'film';
  brand: Brand;
  credits: string;
  film: Film;
  related: Film[];
}

export interface ReelPayload {
  view: 'reel';
  brand: Brand;
  credits: string;
  films: (Film & { preview: Preview })[];
}

/** What a tool result carries in `_meta`, for the widget only. */
export interface ViewMeta {
  licenseKey: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function hasPreview(f: Film): f is Film & { preview: Preview } {
  return f.preview !== undefined;
}

/**
 * Seconds left in a preview window at playback position `timeSec`, between 0
 * and the window's length (a position before the window counts as its start).
 */
export function previewRemaining(p: Pick<Preview, 'startSec' | 'durationSec'>, timeSec: number): number {
  return Math.min(p.durationSec, Math.max(0, p.startSec + p.durationSec - timeSec));
}

/** Whether playback position `timeSec` is before the preview window, e.g. after a seek back. */
export function isBeforePreview(p: Pick<Preview, 'startSec'>, timeSec: number): boolean {
  return timeSec < p.startSec - PREVIEW_SLACK_SEC;
}

/** Whether playback position `timeSec` has reached the end of the preview window. */
export function isPastPreview(p: Pick<Preview, 'startSec' | 'durationSec'>, timeSec: number): boolean {
  return timeSec >= p.startSec + p.durationSec;
}

/** The index after `i` in a list of `length`, wrapping; 0 for an empty list. */
export function nextIndex(i: number, length: number, step = 1): number {
  if (length <= 0) {
    return 0;
  }
  return (((i + step) % length) + length) % length;
}

// Integrity of the catalogue data itself. Expectations are derived from FILMS
// where possible, so adding a film exercises these checks instead of breaking them.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FILMS, STREAM_ORIGINS, WATCH_ORIGINS, checkFilm, getFilm } from '../../src/discover/catalog.js';
import { hasPreview } from '../../src/discover/model.js';

const HEX = /^#[0-9a-f]{6}$/i;

describe('catalogue data', () => {
  it('has unique ids that resolve back to their film', () => {
    const ids = FILMS.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const f of FILMS) {
      assert.equal(getFilm(f.id), f);
    }
  });

  it('links every film out over https to an origin the CSP allows as a redirect', () => {
    for (const f of FILMS) {
      const url = new URL(f.watchUrl);
      assert.equal(url.protocol, 'https:', f.id);
      assert.ok(WATCH_ORIGINS.includes(url.origin), `${f.id}: ${url.origin} missing from WATCH_ORIGINS`);
    }
  });

  it('streams previews only from allow-listed origins, as clear HLS or DASH', () => {
    for (const f of FILMS.filter(hasPreview)) {
      const { url, type } = f.preview.stream;
      assert.ok(
        STREAM_ORIGINS.some(o => url.startsWith(`${o}/`)),
        `${f.id} streams from ${new URL(url).origin}, which is not in STREAM_ORIGINS (the view CSP would block it)`,
      );
      assert.ok(type === 'hls' ? url.endsWith('.m3u8') : url.endsWith('.mpd'), `${f.id}: url does not match type`);
    }
  });

  it('knows the runtime of every previewable film, and keeps the preview window inside it', () => {
    for (const f of FILMS.filter(hasPreview)) {
      assert.ok(f.runtimeSec, `${f.id} has a preview but no runtime`);
      const { startSec, durationSec } = f.preview;
      assert.ok(startSec >= 0 && durationSec > 0, `${f.id} has an empty or negative window`);
      assert.ok(startSec + durationSec <= f.runtimeSec, `${f.id} preview runs past the end of the film`);
    }
  });

  it('uses only #rrggbb colours in cover recipes, since they are interpolated into SVG markup', () => {
    for (const f of FILMS) {
      for (const c of [f.cover.from, f.cover.to, f.cover.accent]) {
        assert.match(c, HEX, `${f.id}: ${c}`);
      }
    }
  });

  it('refuses a film whose colours or watch link the views could not trust', () => {
    const good = FILMS[0]!;
    assert.doesNotThrow(() => checkFilm(good));
    for (const bad of [
      { ...good, cover: { ...good.cover, accent: '"/><img src=x onerror=alert(1)>' } },
      { ...good, watchUrl: 'javascript:alert(1)' },
      { ...good, watchUrl: 'http://studio.blender.org/projects/sintel/' },
      { ...good, watchUrl: 'https://evil.example/sintel' },
    ]) {
      assert.throws(() => checkFilm(bad), /not/, `accepted ${bad.watchUrl} / ${bad.cover.accent}`);
    }
  });

  it('has both previewable and link-out-only films, so both paths are exercised', () => {
    assert.ok(FILMS.some(hasPreview));
    assert.ok(FILMS.some(f => !hasPreview(f)));
  });
});

// Integrity of the matchday data, and the lookups the `matchday` tool resolves
// free text with.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTitle } from '../../src/catalog.js';
import {
  CLIP_SOURCE_SEC,
  FIXTURES,
  defaultFixture,
  fixtureForTitle,
  getFixture,
  matchdayPayload,
  resolveFixture,
  resolveMoment,
  scoreLine,
} from '../../src/matchday.js';

const fixture = (id: string) => {
  const f = getFixture(id);
  assert.ok(f, id);
  return f;
};

describe('matchday data', () => {
  it('has unique fixture ids, and unique moment ids within each fixture', () => {
    assert.equal(new Set(FIXTURES.map(f => f.id)).size, FIXTURES.length);
    for (const f of FIXTURES) {
      assert.equal(new Set(f.moments.map(m => m.id)).size, f.moments.length, f.id);
    }
  });

  it('keeps every live fixture in step with the catalog title it broadcasts on', () => {
    for (const f of FIXTURES) {
      if (f.state !== 'live') {
        continue;
      }
      const t = getTitle(f.titleId);
      assert.ok(t && t.delivery === 'live', `${f.id} points at ${f.titleId}, which is not a live title`);
      assert.equal(t.score, scoreLine(f), `${f.id}: scoreboard disagrees with the catalog`);
      assert.equal(t.liveLabel, f.clock, `${f.id}: clock disagrees with the catalog`);
    }
  });

  it('keeps every replay clip inside the VOD asset, at least 5 seconds long', () => {
    for (const f of FIXTURES) {
      for (const m of f.moments) {
        assert.ok(m.clipStartSec >= 0 && m.clipEndSec <= CLIP_SOURCE_SEC, `${f.id}/${m.id}`);
        assert.ok(m.clipEndSec - m.clipStartSec >= 5, `${f.id}/${m.id} is too short`);
      }
    }
  });

  it('has no moments or stats for a game that has not started', () => {
    for (const f of FIXTURES.filter(x => x.state === 'upcoming')) {
      assert.deepEqual([f.moments, f.stats], [[], []], f.id);
    }
  });
});

describe('resolving a fixture', () => {
  it('opens on a live game by default', () => {
    assert.equal(defaultFixture().state, 'live');
  });

  it('finds a fixture by id, by its live title, by team and by competition', () => {
    assert.equal(resolveFixture('coastal-semi')?.id, 'coastal-semi');
    assert.equal(resolveFixture('live-derby')?.id, 'city-derby');
    assert.equal(resolveFixture('the derby')?.id, 'city-derby');
    assert.equal(resolveFixture('Boston')?.id, 'pacific-g6');
    assert.equal(resolveFixture('coastal cup')?.id, 'coastal-semi');
    assert.equal(fixtureForTitle('live-finals-g6')?.id, 'pacific-g6');
  });

  it('misses rather than guesses', () => {
    assert.equal(resolveFixture('cricket'), undefined);
    assert.equal(fixtureForTitle('live-newsroom'), undefined);
  });
});

describe('resolving a moment', () => {
  const derby = fixture('city-derby');

  it('finds a moment by id, by what happened and by clock', () => {
    assert.equal(resolveMoment(derby, 'solo-goal')?.id, 'solo-goal');
    assert.equal(resolveMoment(derby, 'the solo goal')?.id, 'solo-goal');
    assert.equal(resolveMoment(derby, 'celebration')?.id, 'second-goal');
    assert.equal(resolveMoment(derby, "12'")?.id, 'solo-goal');
    assert.equal(resolveMoment(fixture('pacific-g6'), 'fast break')?.id, 'fast-break');
  });

  it('misses rather than guesses', () => {
    assert.equal(resolveMoment(derby, 'red card'), undefined);
  });
});

describe('matchday payload', () => {
  it('carries the broadcast for a live game and a clip per moment', () => {
    const derby = fixture('city-derby');
    const p = matchdayPayload({ licenseKey: 'k', fixture: derby });
    assert.equal(p.live?.id, 'live-derby');
    assert.deepEqual(
      Object.keys(p.clips),
      derby.moments.map(m => m.id),
    );
    const clip = p.clips['second-goal'];
    assert.equal(clip?.sourceConfig?.options?.startOffset, 104);
    assert.equal(new Set(Object.values(p.clips).map(c => c.id)).size, derby.moments.length);
  });

  it('opens on the moment asked for, and lists the other fixtures', () => {
    const derby = fixture('city-derby');
    const p = matchdayPayload({ licenseKey: 'k', fixture: derby, moment: resolveMoment(derby, 'second goal') });
    assert.equal(p.focusMomentId, 'second-goal');
    assert.ok(!p.fixtures.some(f => f.id === derby.id));
    assert.equal(p.fixtures.length, FIXTURES.length - 1);
  });

  it('has no broadcast for a finished game', () => {
    assert.equal(matchdayPayload({ licenseKey: 'k', fixture: fixture('coastal-semi') }).live, undefined);
  });
});

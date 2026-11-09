import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  byCategory,
  categoryPayload,
  getTitle,
  homePayload,
  livePayload,
  playerPayload,
  recommendationsPayload,
  resolveTitle,
  TITLES,
} from '../../src/catalog.js';
import { EDITION_IDS, EDITIONS } from '../../src/editions.js';
import { FIXTURES, matchdayPayload } from '../../src/matchday.js';

const ids = (p: { sections: { items: { id: string }[] }[] }) => p.sections.flatMap(s => s.items.map(t => t.id));

describe('every edition', () => {
  for (const id of EDITION_IDS) {
    const ed = EDITIONS[id];

    it(`${id}: home, chips and entry points are consistent`, () => {
      const home = homePayload('k', ed);
      assert.ok(ids(home).length > 0);
      for (const t of ids(home)) {
        assert.ok(ed.includes(getTitle(t)!), `${id} home shows ${t}, which is outside the edition`);
      }
      assert.ok(ed.includes(getTitle(ed.home.featuredId)!), `${id} features a title outside the edition`);

      for (const c of ed.chips) {
        assert.ok(ed.tools.includes(c.tool), `${id}: chip ${c.key} calls ${c.tool}, which is not registered`);
        if (c.tool === 'browse_catalog' && c.category) {
          assert.ok(byCategory(c.category, ed).length > 0, `${id}: chip ${c.key} finds nothing`);
        }
      }
      for (const tool of [ed.entrypoints.global, ed.entrypoints.thread]) {
        assert.ok(!tool || ed.tools.includes(tool), `${id}: entry point ${tool} is not registered`);
      }
      assert.notEqual(
        ed.titles[ed.entrypoints.thread!],
        ed.brand.name,
        `${id}: thread entry title equals the app name`,
      );
    });

    it(`${id}: every screen stays inside the edition`, () => {
      const screens = [livePayload('k', ed), recommendationsPayload({ licenseKey: 'k', edition: ed })];
      for (const c of ed.categories) {
        screens.push(categoryPayload({ licenseKey: 'k', query: c, edition: ed }));
      }
      for (const p of screens) {
        for (const t of ids(p)) {
          assert.ok(ed.includes(getTitle(t)!), `${id}: "${p.headline}" shows ${t}`);
        }
        assert.deepEqual(p.brand, ed.brand);
        assert.deepEqual(p.chips, ed.chips);
      }
      for (const t of TITLES.filter(ed.includes)) {
        const up = playerPayload({ licenseKey: 'k', title: t, edition: ed }).upNext;
        assert.ok(
          up.every(u => ed.includes(u)),
          `${id}: up next for ${t.id} leaves the edition`,
        );
      }
    });
  }
});

describe('edition boundaries', () => {
  it('the all-in-one Bitflix keeps every title, Discover and the DRM Lab', () => {
    assert.equal(TITLES.filter(EDITIONS.all.includes).length, TITLES.length);
    assert.ok(EDITIONS.all.tools.includes('discover'));
    assert.ok(ids(homePayload('k')).includes('drm-widevine'));
  });

  it('sports carries games and highlights only; news only news; streaming no sport, news or DRM tests', () => {
    assert.ok(TITLES.filter(EDITIONS.sports.includes).every(t => t.tags.includes('sports')));
    assert.ok(TITLES.filter(EDITIONS.news.includes).every(t => t.kind === 'news'));
    for (const t of TITLES.filter(EDITIONS.streaming.includes)) {
      assert.ok(!['game', 'highlight', 'news'].includes(t.kind) && !t.tags.includes('drm'), t.id);
    }
  });

  it('sports has the match centre, carries every live broadcast, and links games to it', () => {
    const ed = EDITIONS.sports;
    assert.ok(ed.tools.includes('matchday'));
    assert.ok(ed.chips.some(c => c.tool === 'matchday'));
    for (const f of FIXTURES) {
      if (f.state !== 'live') {
        continue;
      }
      const live = getTitle(f.titleId);
      assert.ok(live && ed.includes(live), `${f.id} plays ${f.titleId}, which is outside Sports`);
    }
    const p = matchdayPayload({ licenseKey: 'k', fixture: FIXTURES[0]!, brand: ed.brand });
    assert.equal(p.brand.edition, 'Sports');
    const derby = getTitle('live-derby')!;
    assert.equal(playerPayload({ licenseKey: 'k', title: derby, edition: ed }).matchCentre, true);
    assert.equal(playerPayload({ licenseKey: 'k', title: derby, edition: EDITIONS.news }).matchCentre, false);
  });

  it('a title from another edition does not resolve', () => {
    assert.equal(resolveTitle('news-markets', EDITIONS.sports), undefined);
    assert.equal(resolveTitle('closing bell', EDITIONS.sports), undefined);
    assert.equal(resolveTitle('closing bell', EDITIONS.news)?.id, 'news-markets');
  });

  it("news turns recommendations into 'catch me up', with the live channel", () => {
    const p = recommendationsPayload({ licenseKey: 'k', edition: EDITIONS.news });
    assert.match(p.headline, /missed/);
    assert.ok(ids(p).includes('live-newsroom'));
    assert.ok(ids(p).includes('news-world'));
  });

  it('only the all-in-one Bitflix registers Discover, and each edition has one global entry point', () => {
    for (const id of EDITION_IDS) {
      const ed = EDITIONS[id];
      assert.equal(ed.tools.includes('discover'), id === 'all', id);
      assert.ok(ed.entrypoints.global, `${id} has no nav entry`);
    }
  });
});

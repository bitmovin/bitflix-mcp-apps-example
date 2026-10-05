// End-to-end check of what the server actually puts on the wire. It boots the
// built server (`npm run test:mcp` builds first), connects a real MCP client,
// and asserts the OpenAI plugin-extension metadata lands where the spec expects it.
// Spec: https://github.com/openai/mcp-extensions/blob/main/docs/spec.md

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { STREAM_ORIGINS } from '../src/discover/catalog.js';

const BOOT_TIMEOUT_MS = 30_000;
const TEST_KEY = 'test-key-not-a-real-license';

type Meta = Record<string, unknown> & {
  ui?: { resourceUri?: string; csp?: { connectDomains?: string[]; resourceDomains?: string[] } };
  'openai/ui'?: { entrypoints?: { type: string }[]; availableDisplayModes?: string[] };
  'openai/widgetCSP'?: { redirect_domains?: string[] };
  'openai/widgetAccessible'?: boolean;
  licenseKey?: string;
};

let server: ChildProcess | undefined;
let client: Client;
let base = '';

/** A port that was free a moment ago. Another process could take it before the server binds; that fails loudly at boot. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port')),
      );
    });
  });
}

/** Resolves once the server answers; rejects at once if the process exits first. */
function waitForServer(child: ChildProcess, log: () => string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    let settled = false;
    const done = (err?: Error) => {
      if (!settled) {
        settled = true;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    };
    child.once('exit', code => done(new Error(`server exited with code ${code} before it was ready\n${log()}`)));
    const poll = () => {
      fetch(`${base}/mcp`)
        .then(() => done())
        .catch(() => {
          if (Date.now() > deadline) {
            done(new Error(`server did not answer on ${base} within ${BOOT_TIMEOUT_MS / 1000}s\n${log()}`));
          } else if (!settled) {
            setTimeout(poll, 250);
          }
        });
    };
    poll();
  });
}

before(
  async () => {
    assert.ok(existsSync('dist'), 'no build found: run `npm run test:mcp`, which builds first');
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    let log = '';
    // `skybridge start` runs the server in a child process of its own, so it is
    // started as a process-group leader and the whole group is killed afterwards.
    server = spawn('node_modules/.bin/skybridge', ['start', '-p', String(port)], {
      env: { ...process.env, BITMOVIN_PLAYER_KEY: TEST_KEY },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    server.stdout?.on('data', d => (log += String(d)));
    server.stderr?.on('data', d => (log += String(d)));
    await waitForServer(server, () => log);
    client = new Client({ name: 'bitflix-test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  },
  { timeout: BOOT_TIMEOUT_MS + 10_000 }, // longer than the boot wait, so its error (with the server log) surfaces
);

after(async () => {
  await client?.close().catch(() => {});
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM'); // negative pid: the whole process group
    } catch {
      /* already gone */
    }
  }
});

async function tools() {
  const { tools } = await client.listTools();
  return new Map(tools.map(t => [t.name, t]));
}

async function tool(name: string) {
  const t = (await tools()).get(name);
  assert.ok(t, `tool ${name} missing`);
  return { ...t, meta: (t._meta ?? {}) as Meta };
}

async function viewMeta(name: string): Promise<Meta> {
  const uri = (await tool(name)).meta.ui?.resourceUri;
  assert.ok(uri, `${name} has no view resource`);
  const res = await client.readResource({ uri });
  const content = res.contents[0];
  assert.ok(content, `no content for ${uri}`);
  return content._meta ?? {};
}

describe('tools/list', () => {
  it('exposes the three Discover tools next to the Bitflix ones', async () => {
    assert.deepEqual([...(await tools()).keys()].sort(), [
      'browse_catalog',
      'discover',
      'get_recommendations',
      'play_title',
      'preview_film',
      'run_diagnostics',
      'trailer_reel',
      'whats_live',
    ]);
  });

  it('declares at most one global and one thread entry point for the whole app, as ChatGPT allows', async () => {
    const types = [...(await tools()).values()].flatMap(
      t => ((t._meta ?? {}) as Meta)['openai/ui']?.entrypoints?.map(e => e.type) ?? [],
    );
    assert.deepEqual(types.sort(), ['global', 'thread']);
  });

  it('declares discover as a global (left nav) entry point', async () => {
    const t = await tool('discover');
    assert.deepEqual(t.meta['openai/ui']?.entrypoints, [{ type: 'global' }]);
    assert.equal(t.title, 'Discover');
  });

  it('declares trailer_reel as a thread (side panel) entry point with a title distinct from the app', async () => {
    const t = await tool('trailer_reel');
    assert.deepEqual(t.meta['openai/ui']?.entrypoints, [{ type: 'thread' }]);
    assert.equal(t.title, 'Trailer Reel');
  });

  it('does not make preview_film an entry point', async () => {
    assert.equal((await tool('preview_film')).meta['openai/ui'], undefined);
  });

  it('marks for ChatGPT exactly the tools the widget calls itself', async () => {
    for (const name of ['discover', 'preview_film']) {
      assert.equal((await tool(name)).meta['openai/widgetAccessible'], true, name);
    }
    assert.notEqual((await tool('trailer_reel')).meta['openai/widgetAccessible'], true);
  });

  it('keeps every entry-point input optional, since the host calls them with {}', async () => {
    for (const name of ['discover', 'trailer_reel']) {
      assert.deepEqual((await tool(name)).inputSchema.required ?? [], [], `${name} has required inputs`);
    }
  });
});

describe('view resources', () => {
  for (const name of ['discover', 'trailer_reel', 'preview_film']) {
    it(`${name}: declares display modes before render, without clobbering the CSP`, async () => {
      const meta = await viewMeta(name);
      assert.deepEqual(meta['openai/ui']?.availableDisplayModes, ['inline', 'fullscreen']);
      // view._meta is spread over the generated block; a stray `ui` key would wipe this.
      const connect = meta.ui?.csp?.connectDomains ?? [];
      for (const origin of [...STREAM_ORIGINS, 'https://licensing.bitmovin.com']) {
        assert.ok(connect.includes(origin), `${origin} missing from connectDomains`);
      }
      assert.ok(!connect.some(d => d.includes('*.bitmovin.com')), 'no wildcard Bitmovin origin needed');
      assert.ok(
        !(meta.ui?.csp?.resourceDomains ?? []).some(d => d.includes('bitmovin')),
        'nothing loads from Bitmovin',
      );
      // A literal, not WATCH_ORIGINS: this must fail if a new origin is added unnoticed.
      assert.deepEqual(meta['openai/widgetCSP']?.redirect_domains, ['https://studio.blender.org']);
    });
  }
});

describe('tools/call', () => {
  it('discover answers the entry-point call {} with the home screen', async () => {
    const r = await client.callTool({ name: 'discover', arguments: {} });
    const p = r.structuredContent as { view: string; query?: string };
    assert.equal(p.view, 'discover');
    assert.equal(p.query, undefined);
  });

  it('sends the player license key to the widget in _meta, never in structuredContent', async () => {
    for (const [name, args] of [
      ['discover', {}],
      ['trailer_reel', {}],
      ['preview_film', { query: 'Sintel' }],
    ] as const) {
      const r = await client.callTool({ name, arguments: args });
      assert.equal(r._meta?.licenseKey, TEST_KEY, `${name}: key missing from _meta`);
      assert.ok(!JSON.stringify(r.structuredContent).includes(TEST_KEY), `${name}: key leaked into structuredContent`);
      assert.ok(!JSON.stringify(r.content).includes(TEST_KEY), `${name}: key leaked into the text content`);
    }
  });

  it('discover filters by genre exactly and rejects a genre outside the enum', async () => {
    const r = await client.callTool({ name: 'discover', arguments: { genre: 'Comedy' } });
    const p = r.structuredContent as { genre?: string; rails: { items: { genre: string }[] }[] };
    assert.equal(p.genre, 'Comedy');
    assert.ok(p.rails.flatMap(x => x.items).every(f => f.genre === 'Comedy'));
    assert.equal((await client.callTool({ name: 'discover', arguments: { genre: 'Western' } })).isError, true);
  });

  it('rejects oversized free-text input', async () => {
    const r = await client.callTool({ name: 'discover', arguments: { query: 'x'.repeat(101) } });
    assert.equal(r.isError, true);
  });

  it('trailer_reel answers the entry-point call {} with previewable films only', async () => {
    const r = await client.callTool({ name: 'trailer_reel', arguments: {} });
    const p = r.structuredContent as { view: string; films: { preview?: unknown }[] };
    assert.equal(p.view, 'reel');
    assert.ok(p.films.length > 0 && p.films.every(f => f.preview));
  });

  it('preview_film resolves free text and reports the watch link to the model', async () => {
    const r = await client.callTool({ name: 'preview_film', arguments: { query: 'the bunny one' } });
    const p = r.structuredContent as { view: string; film: { id: string } };
    assert.equal(p.view, 'film');
    assert.equal(p.film.id, 'big-buck-bunny');
    const text = (r.content as { text?: string }[]).map(c => c.text ?? '').join(' ');
    assert.match(text, /studio\.blender\.org\/projects\/big-buck-bunny/);
  });

  it('preview_film falls back to the query when the id is unknown', async () => {
    const r = await client.callTool({ name: 'preview_film', arguments: { id: 'tos', query: 'Tears of Steel' } });
    assert.equal((r.structuredContent as { film?: { id: string } }).film?.id, 'tears-of-steel');
  });

  it('preview_film degrades to a search screen on a miss, and says so plainly', async () => {
    const miss = await client.callTool({ name: 'preview_film', arguments: { query: 'the godfather' } });
    assert.notEqual(miss.isError, true);
    assert.equal((miss.structuredContent as { view: string }).view, 'discover');
    assert.match((miss.content as { text?: string }[])[0]?.text ?? '', /No film in Bitflix Discover matches/);

    const none = await client.callTool({ name: 'preview_film', arguments: {} });
    assert.match((none.content as { text?: string }[])[0]?.text ?? '', /No film was named/);
  });
});

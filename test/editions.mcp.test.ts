// End-to-end check of the Bitflix Editions: boots the built server once per
// edition (BITFLIX_EDITION) and checks what each one puts on the wire.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EDITIONS } from '../src/editions.js';
import { BOOT_TIMEOUT_MS, startServer } from './server.js';

type ToolMeta = { 'openai/ui'?: { entrypoints?: { type: string }[] } };

for (const id of ['sports', 'news', 'streaming'] as const) {
  const edition = EDITIONS[id];

  describe(`${edition.brand.name} (BITFLIX_EDITION=${id})`, { timeout: BOOT_TIMEOUT_MS + 30_000 }, () => {
    it('reports its own name, registers only its tools, and declares its own entry points', async () => {
      const { client, stop } = await startServer({ BITFLIX_EDITION: id });
      try {
        assert.equal(client.getServerVersion()?.name, edition.serverName);

        const { tools } = await client.listTools();
        assert.deepEqual(tools.map(t => t.name).sort(), [...edition.tools].sort());

        const entry = (type: string) =>
          tools
            .filter(t => ((t._meta ?? {}) as ToolMeta)['openai/ui']?.entrypoints?.some(e => e.type === type))
            .map(t => t.name);
        assert.deepEqual(entry('global'), edition.entrypoints.global ? [edition.entrypoints.global] : []);
        assert.deepEqual(entry('thread'), edition.entrypoints.thread ? [edition.entrypoints.thread] : []);

        const thread = tools.find(t => t.name === edition.entrypoints.thread);
        assert.ok(thread?.title && thread.title !== edition.brand.name, 'a thread entry point needs its own title');

        const home = await client.callTool({ name: 'browse_catalog', arguments: {} });
        const p = home.structuredContent as {
          brand: { edition?: string };
          chips: { tool: string }[];
          sections: { items: { id: string; tags: string[]; kind: string }[] }[];
        };
        assert.equal(p.brand.edition, edition.brand.edition);
        assert.ok(
          p.chips.every(c => (edition.tools as readonly string[]).includes(c.tool)),
          'a chip calls a tool this edition lacks',
        );
        const items = p.sections.flatMap(s => s.items);
        assert.ok(items.length > 0);
        assert.ok(
          items.every(t => edition.includes(t as never)),
          `home shows titles from outside ${edition.brand.name}`,
        );
      } finally {
        await stop();
      }
    });
  });
}

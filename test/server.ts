// Boots the built server (`skybridge start`) on a free port with the given
// environment, and connects a real MCP client to it. Shared by the
// integration tests.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

export const BOOT_TIMEOUT_MS = 30_000;
export const TEST_KEY = 'test-key-not-a-real-license';

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
function waitForServer(child: ChildProcess, base: string, log: () => string): Promise<void> {
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

export interface RunningServer {
  client: Client;
  stop: () => Promise<void>;
}

/** Starts the server with `env` added to the environment; `stop()` ends the whole process group. */
export async function startServer(env: Record<string, string> = {}): Promise<RunningServer> {
  assert.ok(existsSync('dist'), 'no build found: run `npm run test:mcp`, which builds first');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let log = '';
  // `skybridge start` runs the server in a child process of its own, so it is
  // started as a process-group leader and the whole group is killed afterwards.
  const server: ChildProcess = spawn('node_modules/.bin/skybridge', ['start', '-p', String(port)], {
    env: { ...process.env, BITMOVIN_PLAYER_KEY: TEST_KEY, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout?.on('data', d => (log += String(d)));
  server.stderr?.on('data', d => (log += String(d)));
  const stop = async () => {
    await client.close().catch(() => {});
    if (server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM'); // negative pid: the whole process group
      } catch {
        /* already gone */
      }
    }
  };
  const client = new Client({ name: 'bitflix-test', version: '0.0.0' });
  try {
    await waitForServer(server, base, () => log);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  } catch (e) {
    await stop();
    throw e;
  }
  return { client, stop };
}

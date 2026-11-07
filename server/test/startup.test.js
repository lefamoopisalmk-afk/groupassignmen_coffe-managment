import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('server opens its port and reports 503 when Redis cannot be reached', async (t) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/index.js', import.meta.url))], {
    env: { ...process.env, PORT: '0', REDIS_URL: 'redis://127.0.0.1:1' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(() => child.kill());

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The port never opened')), 10_000);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });

  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 503);
  assert.deepEqual(await health.json(), { status: 'unavailable', database: 'disconnected' });

  const menu = await fetch(`http://127.0.0.1:${port}/api/menu`);
  assert.equal(menu.status, 503);
});

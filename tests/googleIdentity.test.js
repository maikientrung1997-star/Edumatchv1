import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let identity;
let api;
const scripts = [];
const storage = new Map();
before(async () => {
  globalThis.window = new EventTarget();
  window.location = new URL('http://localhost:5173');
  window.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  globalThis.document = {
    getElementById: (id) => scripts.find((script) => script.id === id) || null,
    createElement: () => {
      const script = new EventTarget();
      script.remove = () => scripts.splice(scripts.indexOf(script), 1);
      return script;
    },
    head: { appendChild: (script) => scripts.push(script) },
  };
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  identity = await server.ssrLoadModule('/src/services/googleIdentity.js');
  ({ api } = await server.ssrLoadModule('/src/services/api.js'));
});
after(async () => {
  await server?.close();
  delete globalThis.window;
  delete globalThis.document;
});

test('SDK preparation coalesces concurrent mounts, retries failed loads and reuses loaded Google SDK', async () => {
  const first = identity.loadGoogleIdentity();
  const duplicate = identity.loadGoogleIdentity();
  assert.equal(first, duplicate);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
  scripts[0].dispatchEvent(new Event('error'));
  await assert.rejects(first, /Chưa thể tải/);
  assert.equal(scripts.length, 0);
  const retry = identity.loadGoogleIdentity();
  window.google = { accounts: { id: { initialize() {}, renderButton() {} } } };
  scripts[0].dispatchEvent(new Event('load'));
  assert.equal(await retry, window.google.accounts.id);
  assert.equal(await identity.loadGoogleIdentity(), window.google.accounts.id);
  assert.equal(scripts.length, 1);
});

test('Google challenge is deduplicated for StrictMode and renewed after a completed exchange', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => {
    calls++;
    assert.equal(config.url, '/auth/google/challenge');
    return { data: { nonce: 'a'.repeat(64), expires_in: 600 }, status: 200, headers: {}, config };
  };
  const first = identity.getGoogleChallenge();
  assert.equal(first, identity.getGoogleChallenge());
  assert.equal((await first).nonce, 'a'.repeat(64));
  await identity.getGoogleChallenge();
  assert.equal(calls, 1);
  identity.clearGoogleChallenge();
  await identity.getGoogleChallenge();
  assert.equal(calls, 2);
});

test('failed challenge can be retried and malformed responses are rejected', async () => {
  identity.clearGoogleChallenge();
  api.defaults.adapter = async () => { throw new Error('Offline'); };
  await assert.rejects(identity.getGoogleChallenge(), /Offline/);
  api.defaults.adapter = async (config) => ({ data: { nonce: 'invalid' }, status: 200, headers: {}, config });
  await assert.rejects(identity.getGoogleChallenge(), /Chưa thể khởi tạo/);
});

test('auth route changes reuse Google initialization and detach old credential callbacks', () => {
  const configurations = [];
  const google = { initialize: (config) => configurations.push(config) };
  let oldCalls = 0;
  let currentCalls = 0;
  const old = identity.bindGoogleIdentity(google, { clientId: 'test', nonce: 'first', callback: () => oldCalls++ });
  const current = identity.bindGoogleIdentity(google, { clientId: 'test', nonce: 'first', callback: () => currentCalls++ });
  assert.equal(configurations.length, 1);
  old();
  configurations[0].callback({ credential: 'valid' });
  assert.equal(oldCalls, 0);
  assert.equal(currentCalls, 1);
  current();
  configurations[0].callback({ credential: 'late' });
  assert.equal(currentCalls, 1);
  identity.bindGoogleIdentity(google, { clientId: 'test', nonce: 'second', callback: () => currentCalls++ });
  assert.equal(configurations.length, 2);
  configurations[0].callback({ credential: 'old-nonce' });
  assert.equal(currentCalls, 1);
  configurations[1].callback({ credential: 'fresh' });
  assert.equal(currentCalls, 2);
});

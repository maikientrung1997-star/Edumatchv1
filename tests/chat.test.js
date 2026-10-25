import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

let server, api, chatService, state, createPusherChannelPool, pusherConfiguration;
const values = new Map();
before(async () => {
  globalThis.window = new EventTarget();
  window.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  ({ api } = await server.ssrLoadModule('/src/services/api.js'));
  ({ chatService } = await server.ssrLoadModule('/src/services/chatService.js'));
  state = await server.ssrLoadModule('/src/utils/chatState.js');
  ({ createPusherChannelPool } = await server.ssrLoadModule('/src/services/pusherChannelPool.js'));
  ({ pusherConfiguration } = await server.ssrLoadModule('/src/services/pusherService.js'));
});
after(async () => { await server?.close(); delete globalThis.window; });
beforeEach(() => { values.clear(); chatService.clearAttachments(); });
const response = (config, data) => ({ config, data, status: 200, headers: {}, statusText: 'OK' });

test('notification and chat leases share one private channel without unsubscribing each other', () => {
  const calls = [];
  const pusher = { subscribe: (name) => { calls.push(`subscribe:${name}`); return { name }; }, unsubscribe: (name) => calls.push(`unsubscribe:${name}`) };
  const pool = createPusherChannelPool(() => pusher);
  const notification = pool.acquire('private-user.1');
  const chat = pool.acquire('private-user.1');
  assert.equal(notification.channel, chat.channel);
  notification.release(); notification.release();
  assert.deepEqual(calls, ['subscribe:private-user.1']);
  chat.release();
  assert.deepEqual(calls, ['subscribe:private-user.1', 'unsubscribe:private-user.1']);
});

test('cleanup from an old session cannot unsubscribe the new session channel', () => {
  let unsubscribed = 0;
  const pool = createPusherChannelPool(() => ({ subscribe: (name) => ({ name }), unsubscribe: () => unsubscribed++ }));
  const old = pool.acquire('private-user.1');
  pool.clear();
  const fresh = pool.acquire('private-user.1');
  old.release();
  assert.equal(unsubscribed, 0);
  fresh.release();
  assert.equal(unsubscribed, 1);
  assert.deepEqual(pusherConfiguration().enabledTransports, ['ws', 'wss']);
});

test('optimistic, websocket and HTTP messages reconcile to one row and preserve newer reactions', () => {
  const pending = { id: 'local:uuid', client_id: 'uuid', sender_user_id: 1, pending: true, revision: 0, sent_at: '2026-10-25T10:00:00Z' };
  const socket = { ...pending, id: 21, pending: false, body: 'Delivered', reactions: [{ emoji: '👍' }], revision: 2 };
  const result = state.mergeChatMessages([pending], [socket, { ...socket, revision: 0, reactions: [] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 21);
  assert.equal(result[0].pending, false);
  assert.equal(result[0].revision, 2);
  assert.equal(result[0].reactions[0].emoji, '👍');
  assert.equal(state.mergeChatMessages(result, [pending])[0].id, 21);
});

test('late inbox snapshots cannot overwrite a newer preview or unread count', () => {
  const current = [{ id: 1, revision: 5, unread_count: 0, preview: 'Newest', last_message_at: '2026-10-25T10:00:00Z' }];
  const result = state.mergeConversations(current, [{ id: 1, revision: 3, unread_count: 8, preview: 'Old' }]);
  assert.equal(result[0].preview, 'Newest');
  assert.equal(result[0].unread_count, 0);
  const patched = state.applyReaction({ id: 8, revision: 3, reactions: ['new'] }, { message_id: 8, revision: 1, reactions: ['old'] });
  assert.deepEqual(patched.reactions, ['new']);
});

test('chat send uses multipart, a retry-safe client ID and only allowed fields', async () => {
  const calls = [];
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/chat/conversations/4/messages');
    assert.ok(config.data instanceof FormData);
    assert.equal(config.data.get('client_id'), 'same-retry-uuid');
    assert.equal(config.data.get('sender_user_id'), null);
    assert.equal(config.data.get('body'), 'Actual body');
    assert.equal(JSON.parse(config.data.get('metadata')).formula, 'x^2');
    assert.equal(config.data.getAll('files[]').length, 1);
    calls.push(config.data.get('client_id'));
    return response(config, { data: { id: 7 } });
  };
  const payload = { client_id: 'same-retry-uuid', body: 'Actual body', files: [new File(['file content'], 'notes.txt')], metadata: { formula: 'x^2', math: true }, sender_user_id: 999 };
  await chatService.send(4, payload);
  await chatService.send(4, payload);
  assert.deepEqual(calls, ['same-retry-uuid', 'same-retry-uuid']);
});

test('read receipts send a visible message watermark rather than a client clock', async () => {
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/chat/conversations/4/read');
    assert.deepEqual(JSON.parse(config.data), { last_message_id: 18 });
    return response(config, { last_read_message_id: 18 });
  };
  await chatService.read(4, 18);
});

test('note autosaves are serialized so a slow older save cannot overwrite the newer note', async () => {
  const calls = [];
  let release;
  api.defaults.adapter = async (config) => {
    const notes = JSON.parse(config.data).notes;
    calls.push(notes);
    if (notes === 'old') await new Promise((resolve) => { release = resolve; });
    return response(config, { notes });
  };
  const first = chatService.saveNote(9, 'old');
  const second = chatService.saveNote(9, 'latest');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['old']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['old', 'latest']);
});

test('private attachment reads use the bearer token and cannot share cached blobs between accounts', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => {
    calls++;
    assert.equal(config.url, '/chat/attachments/3');
    assert.equal(config.responseType, 'blob');
    assert.ok(config.headers.Authorization.startsWith('Bearer '));
    return response(config, new Blob(['private file']));
  };
  values.set('access_token', JSON.stringify('one'));
  await Promise.all([chatService.attachment(3, true), chatService.attachment(3, true)]);
  assert.equal(calls, 1);
  values.set('access_token', JSON.stringify('two'));
  await chatService.attachment(3, true);
  assert.equal(calls, 2);
});

test('queued private notes are canceled on account switch rather than using the next user token', async () => {
  let release;
  const calls = [];
  values.set('access_token', JSON.stringify('account-a'));
  api.defaults.adapter = async (config) => {
    calls.push(config.headers.Authorization);
    if (calls.length === 1) await new Promise((resolve) => { release = resolve; });
    return response(config, {});
  };
  const first = chatService.saveNote(4, 'private A');
  const queued = chatService.saveNote(4, 'private A newer');
  await new Promise((resolve) => setTimeout(resolve, 0));
  values.set('access_token', JSON.stringify('account-b'));
  release();
  await first;
  await assert.rejects(queued, /Phiên đăng nhập/);
  await assert.rejects(chatService.saveNote(4, 'old note flushed on unmount', 'account-a'), /Phiên đăng nhập/);
  assert.deepEqual(calls, ['Bearer account-a']);
});

test('history reads are coalesced and use server cursors', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => { calls++; assert.deepEqual(config.params, { before_id: 50 }); return response(config, { data: [], meta: { has_more: false } }); };
  await Promise.all([chatService.messages(8, { before_id: 50 }), chatService.messages(8, { before_id: 50 })]);
  assert.equal(calls, 1);
});

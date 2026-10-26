import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createThreadStore } from '../src/services/chatThreadStore.js';
import { createPusherChannelPool } from '../src/services/pusherChannelPool.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fakeChannel(subscribed = false) {
  const handlers = new Map();
  return { subscribed,
    bind: (name, fn) => handlers.set(name, [...(handlers.get(name) || []), fn]),
    unbind: (name, fn) => handlers.set(name, (handlers.get(name) || []).filter((item) => item !== fn)),
    emit: (name, data) => (handlers.get(name) || []).forEach((fn) => fn(data)) };
}
function setup({ subscribed = true, conversation = null } = {}) {
  const calls = [];
  const channels = new Map();
  const released = [];
  const api = {
    conversation: async (id) => { calls.push(`conversation:${id}`); return { data: { id, last_message_id: 2, read_receipts: [{ user_id: 9, last_read_message_id: 1 }], participants: [] } }; },
    messages: async (id, params) => { calls.push(`messages:${id}:${JSON.stringify(params)}`); return params.after_id
      ? { data: [{ id: 3, conversation_id: id, sender_user_id: 9, attachments: [{ id: 1 }] }], meta: { has_more: false, latest_id: 3 } }
      : { data: [{ id: 1, conversation_id: id, sender_user_id: 9 }, { id: 2, conversation_id: id, sender_user_id: 1 }], meta: { has_more: false, latest_id: 2 } }; },
    message: async (id) => ({ id, conversation_id: 5, sender_user_id: 9 }),
  };
  const store = createThreadStore({ api, getConversation: () => conversation,
    acquire: (name) => { const channel = channels.get(name) || fakeChannel(subscribed); channels.set(name, channel); return { channel, release: () => released.push(name) }; } });
  return { store, calls, channels, released };
}

test('opening twice only fetches once and re-opening a cached thread costs no requests', async () => {
  const { store, calls } = setup();
  const release = store.retain(5);
  await tick(); await tick();
  assert.deepEqual(calls, ['conversation:5', 'messages:5:{}']);
  assert.equal(store.snapshot(5).loading, false);
  assert.equal(store.snapshot(5).messages.length, 2);
  release();
  store.retain(5);
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(store.snapshot(5).loading, false);
});

test('websocket events keep a cached but unmounted thread up to date', async () => {
  const { store, calls, channels } = setup();
  const release = store.retain(5);
  await tick(); await tick();
  release();
  const channel = channels.get('private-chat.conversation.5');
  channel.emit('message.sent', { id: 4, conversation_id: 5, sender_user_id: 9, attachments: [] });
  channel.emit('message.reacted', { conversation_id: 5, message_id: 4, revision: 1, reactions: [{ emoji: 'x', count: 1, user_ids: [1] }] });
  channel.emit('message.read', { conversation_id: 5, read_by_user_id: 9, last_read_message_id: 2 });
  await tick();
  const snap = store.snapshot(5);
  assert.equal(snap.messages.at(-1).id, 4);
  assert.equal(snap.messages.at(-1).reactions[0].emoji, 'x');
  assert.equal(snap.receipts[9], 2);
  assert.equal(calls.length, 2);
});

test('only a re-subscription (reconnect) triggers an HTTP catch-up', async () => {
  const { store, calls, channels } = setup({ subscribed: false });
  store.retain(5);
  await tick(); await tick();
  const channel = channels.get('private-chat.conversation.5');
  channel.emit('pusher:subscription_succeeded');
  await tick();
  assert.equal(calls.length, 2, 'first subscription must not refetch when the inbox is not newer');
  channel.emit('pusher:subscription_succeeded');
  await tick(); await tick(); await tick();
  assert.deepEqual(calls.slice(2), ['conversation:5', 'messages:5:{"after_id":2}']);
});

test('first subscription fetches only the delta when the inbox is newer than the cache', async () => {
  const { store, calls, channels } = setup({ subscribed: false, conversation: { last_message_id: 3 } });
  store.retain(5);
  await tick(); await tick();
  channels.get('private-chat.conversation.5').emit('pusher:subscription_succeeded');
  await tick(); await tick();
  assert.deepEqual(calls.slice(2), ['messages:5:{"after_id":2}']);
  assert.equal(store.snapshot(5).latestId, 3);
});

test('media cache is reused until a new attachment arrives', async () => {
  const { store, channels } = setup();
  store.retain(5);
  await tick(); await tick();
  const version = store.snapshot(5).mediaVersion;
  store.setMedia(5, 'image', { items: [1] }, version);
  assert.deepEqual(store.getMedia(5, 'image'), { items: [1] });
  channels.get('private-chat.conversation.5').emit('message.sent', { id: 8, conversation_id: 5, sender_user_id: 9, attachments: [{ id: 3 }] });
  assert.equal(store.getMedia(5, 'image'), null);
  store.setMedia(5, 'image', { items: [2] }, version);
  assert.equal(store.getMedia(5, 'image'), null, 'stale fetch is rejected');
});

test('idle entries are evicted and release their channel; dispose releases everything', async () => {
  const { store, released } = setup();
  const releases = [];
  for (let id = 1; id <= 14; id++) { releases.push(store.retain(id)); }
  releases.forEach((release) => release());
  store.retain(100);
  assert.ok(released.length >= 3);
  const before = released.length;
  store.dispose();
  assert.ok(released.length > before);
});

test('channel pool grace period reuses a live subscription instead of re-authorizing', async () => {
  const calls = [];
  const pusher = { subscribe: (name) => { calls.push(`subscribe:${name}`); return { name }; }, unsubscribe: (name) => calls.push(`unsubscribe:${name}`) };
  const pool = createPusherChannelPool(() => pusher, { graceMs: (name) => (name.startsWith('private-chat.') ? 40 : 0) });
  pool.acquire('private-chat.conversation.1').release();
  pool.acquire('private-chat.conversation.1').release();
  assert.deepEqual(calls, ['subscribe:private-chat.conversation.1']);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(calls, ['subscribe:private-chat.conversation.1', 'unsubscribe:private-chat.conversation.1']);
  pool.acquire('private-user.1').release();
  assert.equal(calls.at(-1), 'unsubscribe:private-user.1');
});

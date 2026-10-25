import { applyReaction, mergeChatMessages } from '../utils/chatState.js';

const EMPTY = Object.freeze({ detail: null, messages: [], hasOlder: false, receipts: {}, loading: true, error: '', latestId: 0, mediaVersion: 0 });
const NOOP = () => {};

/**
 * In-memory conversation cache driven by Pusher events.
 *
 * - A conversation is fetched over HTTP once; afterwards it is kept fresh only by websocket events
 *   (message.sent / message.read / message.reacted), even while its view is not mounted.
 * - Re-opening a cached conversation therefore costs 0 requests.
 * - HTTP catch-up happens only when a missed-event gap is possible: the channel re-subscribes
 *   after a reconnect, or the inbox says a newer message exists than the one we hold.
 * - No timers, no focus/visibility listeners, no polling.
 */
export function createThreadStore({ acquire, api, formatError = (failure) => String(failure?.message || failure), getConversation = () => null, onDetail = NOOP, limit = 12 }) {
  const entries = new Map();
  let lookupConversation = getConversation;

  const alive = (entry) => entries.get(entry.id) === entry;
  const emit = (entry) => entry.listeners.forEach((listener) => listener());
  const update = (entry, patch) => { entry.snapshot = { ...entry.snapshot, ...patch }; emit(entry); };
  const peek = (id) => entries.get(Number(id));

  function entryFor(id) {
    const key = Number(id);
    let entry = entries.get(key);
    if (!entry) {
      entry = { id: key, refs: 0, usedAt: Date.now(), snapshot: { ...EMPTY }, listeners: new Set(), latestId: 0, oldestId: null,
        patches: new Map(), retries: new Map(), media: new Map(), notes: null, loaded: false, started: false,
        lease: null, bindings: [], subscribedOnce: false, gapChecked: false, flight: null, again: null };
      entries.set(key, entry);
    }
    return entry;
  }

  function ingest(entry, incoming) {
    if (!incoming.length) return;
    const previousLatest = entry.latestId;
    const known = new Map(entry.snapshot.messages.map((message) => [message.id, message]));
    const patched = incoming.map((message) => {
      const value = entry.patches.has(message.id) ? applyReaction(message, entry.patches.get(message.id)) : message;
      return typeof value.id === 'number' ? { ...value, pending: false, failed: false } : value;
    });
    let newAttachment = false;
    for (const message of patched) {
      if (typeof message.id !== 'number') continue;
      entry.latestId = Math.max(entry.latestId, message.id);
      entry.oldestId = entry.oldestId ? Math.min(entry.oldestId, message.id) : message.id;
      if (message.client_id) entry.retries.delete(message.client_id);
      if (entry.loaded && message.id > previousLatest && message.attachments?.length && !known.get(message.id)?.attachments?.length) newAttachment = true;
    }
    update(entry, { messages: mergeChatMessages(entry.snapshot.messages, patched), latestId: entry.latestId,
      ...(newAttachment ? { mediaVersion: entry.snapshot.mediaVersion + 1 } : {}) });
  }

  function mergeReceipts(entry, items) {
    const next = { ...entry.snapshot.receipts };
    let changed = false;
    for (const item of items) {
      const value = Math.max(next[item.user_id] || 0, Number(item.last_read_message_id) || 0);
      if (value !== next[item.user_id]) { next[item.user_id] = value; changed = true; }
    }
    if (changed) update(entry, { receipts: next });
  }

  function reacted(entry, event) {
    const previous = entry.patches.get(event.message_id);
    if (previous && previous.revision > event.revision) return;
    entry.patches.set(event.message_id, event);
    update(entry, { messages: entry.snapshot.messages.map((message) => applyReaction(message, event)) });
  }

  /** Coalesced HTTP sync. Fetches detail only when asked, and only messages newer than what is cached. */
  function sync(entry, { refreshDetail = false } = {}) {
    if (entry.flight) {
      entry.again = { refreshDetail: Boolean(entry.again?.refreshDetail || refreshDetail) };
      return entry.flight;
    }
    entry.flight = (async () => {
      try {
        let detail = entry.snapshot.detail;
        if (refreshDetail || !detail) {
          detail = (await api.conversation(entry.id)).data;
          if (!alive(entry)) return;
          update(entry, { detail });
          onDetail(detail);
          mergeReceipts(entry, detail.read_receipts || []);
        }
        const target = Math.max(Number(detail.last_message_id || 0), Number(lookupConversation(entry.id)?.last_message_id || 0));
        let cursor = entry.loaded ? entry.latestId : 0;
        while (true) {
          const response = await api.messages(entry.id, cursor ? { after_id: cursor } : {});
          if (!alive(entry)) return;
          ingest(entry, response.data);
          if (!cursor) update(entry, { hasOlder: Boolean(response.meta.has_more) });
          const next = Number(response.meta.latest_id || cursor);
          const stalled = next === cursor;
          cursor = next;
          if (!response.meta.has_more || cursor >= target || stalled) break;
        }
        entry.loaded = true;
        update(entry, { loading: false, error: '' });
        gapCheck(entry);
      } catch (failure) {
        if (alive(entry)) update(entry, { loading: false, error: formatError(failure) });
      }
    })().finally(() => {
      entry.flight = null;
      const again = entry.again;
      entry.again = null;
      if (again && alive(entry)) void sync(entry, again);
    });
    return entry.flight;
  }

  /** After the first subscription, fetch only if the inbox reports a message newer than the cache. */
  function gapCheck(entry) {
    if (!entry.loaded || !entry.subscribedOnce || entry.gapChecked) return;
    entry.gapChecked = true;
    if (Number(lookupConversation(entry.id)?.last_message_id || 0) > entry.latestId) void sync(entry);
  }

  function bind(entry) {
    const { channel } = entry.lease;
    const handlers = {
      'message.sent': async (event) => {
        if (Number(event.conversation_id) !== entry.id) return;
        try {
          const message = event.requires_fetch ? await api.message(event.id) : event;
          if (alive(entry)) ingest(entry, [message]);
        } catch (failure) { if (alive(entry)) update(entry, { error: formatError(failure) }); }
      },
      'message.read': (event) => {
        if (Number(event.conversation_id) === entry.id) mergeReceipts(entry, [{ user_id: event.read_by_user_id, last_read_message_id: event.last_read_message_id }]);
      },
      'message.reacted': (event) => { if (Number(event.conversation_id) === entry.id) reacted(entry, event); },
      'pusher:subscription_succeeded': () => {
        if (!entry.subscribedOnce) { entry.subscribedOnce = true; gapCheck(entry); return; }
        void sync(entry, { refreshDetail: true }); // Re-subscribed after a reconnect: events may have been missed.
      },
    };
    entry.bindings = Object.entries(handlers);
    entry.bindings.forEach(([name, handler]) => channel.bind(name, handler));
    if (channel.subscribed) { entry.subscribedOnce = true; entry.gapChecked = true; }
  }

  function stop(entry) {
    if (entry.lease) {
      entry.bindings.forEach(([name, handler]) => entry.lease.channel.unbind(name, handler));
      entry.lease.release();
    }
    entry.lease = null; entry.bindings = []; entry.started = false;
    entries.delete(entry.id);
  }

  function evict() {
    if (entries.size <= limit) return;
    const idle = [...entries.values()].filter((entry) => !entry.refs && !entry.listeners.size).sort((a, b) => a.usedAt - b.usedAt);
    for (const entry of idle) {
      if (entries.size <= limit) break;
      stop(entry);
    }
  }

  function start(entry) {
    if (entry.started) return;
    entry.started = true;
    entry.lease = acquire(`private-chat.conversation.${entry.id}`);
    if (entry.lease) bind(entry);
    void sync(entry);
  }

  return {
    /** Lets the owner point the store at the live inbox list (used to detect a missed-message gap). */
    setConversationLookup(lookup) { lookupConversation = lookup || getConversation; },
    subscribe(id, listener) {
      if (!Number(id)) return NOOP;
      const entry = entryFor(id);
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    snapshot: (id) => (Number(id) ? entryFor(id).snapshot : EMPTY),
    /** Mount: keep the entry (and its channel) alive; fetches only when it has never been loaded. */
    retain(id) {
      const entry = entryFor(id);
      entry.refs++; entry.usedAt = Date.now();
      if (entry.started) {
        // Already cached: show it as-is. Only a thread whose first load failed is retried.
        if (!entry.loaded && !entry.flight) void sync(entry);
        else if (entry.snapshot.error) update(entry, { error: '' });
      } else start(entry);
      evict();
      return () => { entry.refs = Math.max(0, entry.refs - 1); entry.usedAt = Date.now(); };
    },
    /** Explicit, user-initiated refresh. */
    refresh: (id) => { const entry = peek(id); return entry ? sync(entry, { refreshDetail: true }) : Promise.resolve(); },
    ingest: (id, messages) => { const entry = peek(id); if (entry) ingest(entry, messages); },
    mergeReceipts: (id, items) => { const entry = peek(id); if (entry) mergeReceipts(entry, items); },
    reacted: (id, event) => { const entry = peek(id); if (entry) reacted(entry, event); },
    markFailed(id, clientId) {
      const entry = peek(id);
      if (entry) update(entry, { messages: entry.snapshot.messages.map((message) => message.client_id === clientId && typeof message.id !== 'number' ? { ...message, pending: false, failed: true } : message) });
    },
    setError(id, error) { const entry = peek(id); if (entry && entry.snapshot.error !== error) update(entry, { error }); },
    async loadOlder(id) {
      const entry = peek(id);
      if (!entry?.oldestId) return;
      try {
        const response = await api.messages(entry.id, { before_id: entry.oldestId });
        if (alive(entry)) { ingest(entry, response.data); update(entry, { hasOlder: Boolean(response.meta.has_more) }); }
      } catch (failure) { if (alive(entry)) update(entry, { error: formatError(failure) }); }
    },
    rememberRetry: (id, clientId, payload) => peek(id)?.retries.set(clientId, payload),
    getRetry: (id, clientId) => peek(id)?.retries.get(clientId),
    /** Shared media cache, valid until a new attachment arrives or the user refreshes it. */
    getMedia(id, type) {
      const entry = peek(id);
      const cached = entry?.media.get(type);
      return cached && cached.version === entry.snapshot.mediaVersion ? cached.data : null;
    },
    setMedia(id, type, data, version) {
      const entry = peek(id);
      if (entry && entry.snapshot.mediaVersion === version) entry.media.set(type, { version, data });
    },
    invalidateMedia(id) {
      const entry = peek(id);
      if (!entry) return;
      entry.media.clear();
      update(entry, { mediaVersion: entry.snapshot.mediaVersion + 1 });
    },
    getNotes: (id, fallback = '') => peek(id)?.notes ?? fallback,
    setNotes(id, notes) { const entry = peek(id); if (entry) entry.notes = notes; },
    /** Drop everything (logout / account switch). The store can be reused afterwards. */
    dispose() { [...entries.values()].forEach(stop); entries.clear(); },
  };
}

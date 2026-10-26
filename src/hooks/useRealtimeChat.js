import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { acquirePusherChannel } from '@/services/pusherService';
import { chatService, chatError } from '@/services/chatService';

const lastForeignId = (messages, userId) => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (typeof message.id === 'number' && Number(message.sender_user_id) !== Number(userId)) return message.id;
  }
  return 0;
};

/**
 * View over the cached, websocket-driven conversation in the chat thread store.
 * Opening a conversation that is already cached costs zero HTTP requests; focus/visibility never refetch.
 * The only requests made here are user actions: send, react, read receipt (when there is something unread),
 * older history, and explicit refresh.
 */
export function useRealtimeChat(conversationId) {
  const { user, token } = useAuth();
  const userId = user?.id;
  const { threads, conversations } = useChat();
  const subscribe = useCallback((notify) => threads.subscribe(conversationId, notify), [threads, conversationId]);
  const read = useCallback(() => threads.snapshot(conversationId), [threads, conversationId]);
  const snap = useSyncExternalStore(subscribe, read, read);
  const [typingIds, setTypingIds] = useState([]);
  const channelRef = useRef(null);
  const activeRef = useRef(false);
  const clientTyping = useRef(false);
  const typingSentAt = useRef(0);
  const typingTimers = useRef(new Map());
  const memberIds = useRef(new Set());
  const atEnd = useRef(true);
  const readState = useRef({ flight: false, requested: 0, completed: 0 });
  const fresh = useRef({ foreignId: 0, ownRead: 0 });

  const currentReceipts = { ...snap.receipts };
  conversations.find((item) => Number(item.id) === Number(conversationId))?.read_receipts?.forEach((item) => {
    currentReceipts[item.user_id] = Math.max(currentReceipts[item.user_id] || 0, Number(item.last_read_message_id));
  });
  const foreignId = lastForeignId(snap.messages, user?.id);
  const ownRead = Math.max(currentReceipts[user?.id] || 0, Number(snap.detail?.last_read_message_id || 0));

  useEffect(() => {
    fresh.current = { foreignId, ownRead };
    memberIds.current = new Set((snap.detail?.participants || []).map((member) => Number(member.id)));
  });

  /** Read receipt: one request per new message from someone else, only while the user is actually looking. */
  const markRead = useCallback(async () => {
    const state = readState.current;
    if (state.flight) return;
    state.flight = true;
    try {
      // Loop (rather than recurse) so a message that lands while a receipt is in flight is acknowledged right after.
      while (activeRef.current && atEnd.current && document.visibilityState === 'visible' && document.hasFocus()) {
        state.completed = Math.max(state.completed, fresh.current.ownRead);
        state.requested = Math.max(state.requested, fresh.current.foreignId);
        if (state.requested <= state.completed) break;
        const target = state.requested;
        const response = await chatService.read(conversationId, target);
        state.completed = Math.max(state.completed, target, Number(response.last_read_message_id) || 0);
        threads.mergeReceipts(conversationId, [{ user_id: userId, last_read_message_id: state.completed }]);
      }
    } catch (failure) {
      threads.setError(conversationId, chatError(failure));
    } finally {
      state.flight = false;
    }
  }, [threads, conversationId, userId]);

  // Keep the cached conversation (and its websocket channel) alive while this view is mounted.
  useEffect(() => {
    if (!conversationId || !user?.id || !token) return;
    activeRef.current = true;
    readState.current = { flight: false, requested: 0, completed: 0 };
    const release = threads.retain(conversationId);
    return () => { activeRef.current = false; release(); };
  }, [threads, conversationId, user?.id, token]);

  useEffect(() => { void markRead(); }, [markRead, foreignId, ownRead, snap.loading]);

  // Returning to the tab only re-sends a read receipt if something unread is on screen. It never refetches.
  useEffect(() => {
    const visible = () => { void markRead(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
  }, [markRead]);

  // Typing indicator is the only thing this view needs from the channel directly.
  useEffect(() => {
    if (!conversationId || !user?.id || !token) return;
    let active = true;
    const timers = typingTimers.current;
    void chatService.config().then((config) => { if (active) clientTyping.current = config.client_typing; }).catch(() => {});
    const lease = acquirePusherChannel(`private-chat.conversation.${conversationId}`);
    channelRef.current = lease?.channel || null;
    const typing = (event) => {
      const id = Number(event.user_id);
      if (!id || id === Number(user.id) || !active || !memberIds.current.has(id)) return;
      clearTimeout(timers.get(id));
      setTypingIds((current) => [...new Set([...current, id])]);
      timers.set(id, setTimeout(() => { if (active) setTypingIds((current) => current.filter((value) => value !== id)); }, 5000));
    };
    const handlers = { 'message.typing': typing, 'client-typing': typing };
    Object.entries(handlers).forEach(([name, handler]) => lease?.channel.bind(name, handler));
    return () => {
      active = false;
      Object.entries(handlers).forEach(([name, handler]) => lease?.channel.unbind(name, handler));
      lease?.release(); channelRef.current = null;
      timers.forEach(clearTimeout); timers.clear();
    };
  }, [conversationId, user?.id, token]);

  // Shared-media cache lives in the store so the details panel never refetches what it already has.
  const getMedia = useCallback((type) => threads.getMedia(conversationId, type), [threads, conversationId]);
  const setMedia = useCallback((type, data, version) => threads.setMedia(conversationId, type, data, version), [threads, conversationId]);
  const invalidateMedia = useCallback(() => threads.invalidateMedia(conversationId), [threads, conversationId]);

  const send = async (payload, clientId = crypto.randomUUID()) => {
    const optimistic = { id: `local:${clientId}`, client_id: clientId, conversation_id: conversationId, sender_user_id: user.id,
      sender: { id: user.id, name: user.name, avatar_url: user.avatar }, body: payload.body || '', metadata: payload.metadata || {},
      attachments: [], reactions: [], revision: 0, sent_at: new Date().toISOString(), pending: true };
    threads.rememberRetry(conversationId, clientId, payload);
    threads.ingest(conversationId, [optimistic]);
    try {
      const response = await chatService.send(conversationId, { ...payload, client_id: clientId });
      threads.ingest(conversationId, [{ ...response.data, pending: false, failed: false }]);
      threads.setError(conversationId, '');
      return response;
    } catch (failure) {
      threads.markFailed(conversationId, clientId);
      threads.setError(conversationId, chatError(failure));
      throw failure;
    }
  };

  return { messages: snap.messages, detail: snap.detail, loading: snap.loading, error: snap.error, hasOlder: snap.hasOlder, typingIds, receipts: currentReceipts,
    mediaVersion: snap.mediaVersion, getMedia, setMedia, invalidateMedia,
    getNotes: (fallback) => threads.getNotes(conversationId, fallback),
    setNotes: (notes) => threads.setNotes(conversationId, notes),
    setAtEnd: (value) => { atEnd.current = value; if (value) void markRead(); },
    send,
    retryMessage: (message) => { const payload = threads.getRetry(conversationId, message.client_id); return payload ? send(payload, message.client_id) : Promise.resolve(); },
    refresh: () => threads.refresh(conversationId),
    loadOlder: () => threads.loadOlder(conversationId),
    react: async (message, emoji) => {
      try { threads.reacted(conversationId, await chatService.react(message.id, emoji)); }
      catch (failure) { threads.setError(conversationId, chatError(failure)); }
    },
    sendTyping: () => {
      if (Date.now() - typingSentAt.current < 2100) return;
      typingSentAt.current = Date.now();
      const channel = channelRef.current;
      if (clientTyping.current && channel?.subscribed) {
        try { channel.trigger('client-typing', { user_id: user.id }); } catch { /* No polling fallback. */ }
      } else void chatService.typing(conversationId).catch(() => {});
    },
  };
}

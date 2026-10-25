import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { acquirePusherChannel } from '@/services/pusherService';
import { chatService, chatError } from '@/services/chatService';
import { applyReaction, mergeChatMessages } from '@/utils/chatState';

/** Event-driven history catch-up. No interval, polling or local message store. */
export function useRealtimeChat(conversationId) {
  const { user, token } = useAuth();
  const { upsert, conversations } = useChat();
  const [messages, setMessages] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const [typingIds, setTypingIds] = useState([]);
  const [receipts, setReceipts] = useState({});
  const latestId = useRef(0);
  const oldestId = useRef(null);
  const reactionPatches = useRef(new Map());
  const retries = useRef(new Map());
  const channelRef = useRef(null);
  const resyncRef = useRef(null);
  const readRef = useRef(null);
  const activeRef = useRef(false);
  const clientTyping = useRef(false);
  const typingSentAt = useRef(0);
  const typingTimers = useRef(new Map());
  const atEnd = useRef(true);
  const memberIds = useRef(new Set());

  const ingest = useCallback((incoming) => {
    const patched = incoming.map((message) => {
      const value = reactionPatches.current.has(message.id) ? applyReaction(message, reactionPatches.current.get(message.id)) : message;
      return typeof value.id === 'number' ? { ...value, pending: false, failed: false } : value;
    });
    for (const message of patched) {
      if (typeof message.id === 'number') {
        latestId.current = Math.max(latestId.current, message.id);
        oldestId.current = oldestId.current ? Math.min(oldestId.current, message.id) : message.id;
        if (message.client_id) retries.current.delete(message.client_id);
      }
    }
    setMessages((current) => mergeChatMessages(current, patched));
  }, []);
  const mergeReceipts = useCallback((items) => setReceipts((current) => {
    const next = { ...current };
    items.forEach((item) => { next[item.user_id] = Math.max(next[item.user_id] || 0, Number(item.last_read_message_id)); });
    return next;
  }), []);

  useEffect(() => {
    if (!conversationId || !user?.id || !token) return;
    let active = true;
    activeRef.current = true;
    let readFlight = false;
    let readRequested = 0;
    let readCompleted = 0;
    const markRead = async () => {
      if (!active || !atEnd.current || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      readRequested = Math.max(readRequested, latestId.current);
      if (readFlight || readRequested <= readCompleted) return;
      readFlight = true;
      const target = readRequested;
      try {
        const response = await chatService.read(conversationId, target);
        if (!active) return;
        readCompleted = Math.max(readCompleted, response.last_read_message_id);
        mergeReceipts([{ user_id: user.id, last_read_message_id: readCompleted }]);
      } catch (failure) {
        if (active) setError(chatError(failure));
      } finally {
        readFlight = false;
        if (active && readRequested > target) void markRead();
      }
    };
    readRef.current = markRead;
    let syncFlight = null;
    let syncAgain = false;
    const resync = () => {
      if (!active) return Promise.resolve();
      if (syncFlight) { syncAgain = true; return syncFlight; }
      syncFlight = (async () => {
        try {
          const data = (await chatService.conversation(conversationId)).data;
          if (!active) return;
          setDetail(data); upsert(data); mergeReceipts(data.read_receipts || []);
          memberIds.current = new Set((data.participants || []).map((member) => Number(member.id)));
          readCompleted = Math.max(readCompleted, data.last_read_message_id || 0);
          const target = data.last_message_id || 0;
          let cursor = latestId.current;
          do {
            const response = await chatService.messages(conversationId, cursor ? { after_id: cursor } : {});
            if (!active) return;
            ingest(response.data);
            if (!cursor) setHasOlder(response.meta.has_more);
            cursor = response.meta.latest_id || cursor;
            if (!response.meta.has_more || cursor >= target) break;
          } while (active);
          if (active) { setError(''); void markRead(); }
        } catch (failure) {
          if (active) setError(chatError(failure));
        } finally {
          if (active) setLoading(false);
        }
      })().finally(() => {
        syncFlight = null;
        if (active && syncAgain) { syncAgain = false; void resync(); }
      });
      return syncFlight;
    };
    resyncRef.current = resync;
    void resync();
    void chatService.config().then((config) => { if (active) clientTyping.current = config.client_typing; }).catch(() => {});
    const lease = acquirePusherChannel(`private-chat.conversation.${conversationId}`);
    const received = async (event) => {
      if (!active || Number(event.conversation_id) !== Number(conversationId)) return;
      try {
        const message = event.requires_fetch ? await chatService.message(event.id) : event;
        if (!active) return;
        ingest([message]);
        if (message.sender_user_id !== user.id) void markRead();
      } catch (failure) { if (active) setError(chatError(failure)); }
    };
    const read = (event) => {
      if (Number(event.conversation_id) === Number(conversationId)) mergeReceipts([{ user_id: event.read_by_user_id, last_read_message_id: event.last_read_message_id }]);
    };
    const reacted = (event) => {
      if (Number(event.conversation_id) !== Number(conversationId)) return;
      const previous = reactionPatches.current.get(event.message_id);
      if (previous && previous.revision > event.revision) return;
      reactionPatches.current.set(event.message_id, event);
      setMessages((current) => current.map((message) => applyReaction(message, event)));
    };
    const typing = (event) => {
      const id = Number(event.user_id);
      if (!id || id === Number(user.id) || !active || !memberIds.current.has(id)) return;
      clearTimeout(typingTimers.current.get(id));
      setTypingIds((current) => [...new Set([...current, id])]);
      typingTimers.current.set(id, setTimeout(() => { if (active) setTypingIds((current) => current.filter((value) => value !== id)); }, 5000));
    };
    channelRef.current = lease?.channel || null;
    const handlers = { 'message.sent': received, 'message.read': read, 'message.reacted': reacted,
      'message.typing': typing, 'client-typing': typing, 'pusher:subscription_succeeded': resync };
    Object.entries(handlers).forEach(([name, handler]) => lease?.channel.bind(name, handler));
    const focus = () => { if (document.visibilityState === 'visible') { void resync(); void markRead(); } };
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('focus', focus);
    const timers = typingTimers.current;
    return () => {
      active = false; activeRef.current = false;
      Object.entries(handlers).forEach(([name, handler]) => lease?.channel.unbind(name, handler));
      lease?.release(); channelRef.current = null;
      timers.forEach(clearTimeout); timers.clear();
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('focus', focus);
    };
  }, [conversationId, user?.id, token, ingest, mergeReceipts, upsert]);

  const send = async (payload, clientId = crypto.randomUUID()) => {
    const optimistic = { id: `local:${clientId}`, client_id: clientId, conversation_id: conversationId, sender_user_id: user.id,
      sender: { id: user.id, name: user.name, avatar_url: user.avatar }, body: payload.body || '', metadata: payload.metadata || {},
      attachments: [], reactions: [], revision: 0, sent_at: new Date().toISOString(), pending: true };
    retries.current.set(clientId, payload);
    ingest([optimistic]);
    try {
      const response = await chatService.send(conversationId, { ...payload, client_id: clientId });
      if (activeRef.current) { ingest([{ ...response.data, pending: false, failed: false }]); void readRef.current?.(); }
      return response;
    } catch (failure) {
      if (activeRef.current) {
        setMessages((current) => current.map((message) => message.client_id === clientId && typeof message.id !== 'number' ? { ...message, pending: false, failed: true } : message));
        setError(chatError(failure));
      }
      throw failure;
    }
  };

  const currentReceipts = { ...receipts };
  conversations.find((item) => Number(item.id) === Number(conversationId))?.read_receipts?.forEach((item) => {
    currentReceipts[item.user_id] = Math.max(currentReceipts[item.user_id] || 0, Number(item.last_read_message_id));
  });
  return { messages, detail, loading, error, hasOlder, typingIds, receipts: currentReceipts,
    setAtEnd: (value) => { atEnd.current = value; if (value) void readRef.current?.(); },
    send,
    retryMessage: (message) => { const payload = retries.current.get(message.client_id); return payload ? send(payload, message.client_id) : Promise.resolve(); },
    refresh: () => resyncRef.current?.(),
    loadOlder: async () => {
      if (!oldestId.current) return;
      try {
        const response = await chatService.messages(conversationId, { before_id: oldestId.current });
        if (activeRef.current) { ingest(response.data); setHasOlder(response.meta.has_more); }
      } catch (failure) { if (activeRef.current) setError(chatError(failure)); }
    },
    react: async (message, emoji) => {
      try {
        const event = await chatService.react(message.id, emoji);
        if (activeRef.current) {
          reactionPatches.current.set(event.message_id, event);
          setMessages((current) => current.map((item) => applyReaction(item, event)));
        }
      } catch (failure) { if (activeRef.current) setError(chatError(failure)); }
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

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { acquirePusherChannel } from '@/services/pusherService';
import { chatService, chatError } from '@/services/chatService';
import { createThreadStore } from '@/services/chatThreadStore';
import { mergeConversations } from '@/utils/chatState';
import { ChatContext } from '@/contexts/ChatStateContext';

// How long to wait for the realtime subscription before loading the inbox over HTTP anyway.
const INBOX_SUBSCRIBE_WAIT_MS = 3000;

const empty = { userId: null, conversations: [], counts: { total: 0, unread: 0, unread_messages: 0 }, revision: -1,
  connection: 'connecting', online: new Set(), presenceReady: false, error: '', incomingId: null, loaded: false, page: 1, lastPage: 1 };
function reducer(state, action) {
  if (action.type === 'reset') return { ...empty, userId: action.userId };
  if (state.userId !== action.userId) return state;
  if (action.type === 'snapshot') {
    const fresh = Number(action.revision) >= state.revision;
    return { ...state, conversations: mergeConversations(state.conversations, action.items), loaded: true,
      ...(action.page ? { page: Math.max(state.page, action.page), lastPage: action.lastPage || state.lastPage } : {}),
      ...(fresh ? { counts: action.counts, revision: Number(action.revision) } : {}), error: '' };
  }
  if (action.type === 'upsert') return { ...state, conversations: mergeConversations(state.conversations, [action.item]) };
  if (action.type === 'incoming') return { ...state, incomingId: action.id };
  if (action.type === 'connection') return { ...state, connection: action.value, ...(action.value === 'connected' ? {} : { presenceReady: false, online: new Set() }) };
  if (action.type === 'presence') return { ...state, online: new Set(action.ids.map(String)), presenceReady: true };
  if (action.type === 'member') {
    const online = new Set(state.online);
    if (action.add) online.add(String(action.id)); else online.delete(String(action.id));
    return { ...state, online };
  }
  if (action.type === 'error') return { ...state, error: action.error };
  return state;
}

/**
 * Realtime chat state. The inbox is loaded over HTTP once and then kept current by `private-user.{id}` events.
 * There are no focus / visibility / interval refetches: the websocket is the source of truth, and HTTP is only
 * used to re-sync after the realtime subscription has genuinely been (re)established.
 */
export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const userId = user?.id;
  const [state, dispatch] = useReducer(reducer, empty);
  const visible = state.userId === userId ? state : empty;
  const conversationsRef = useRef([]);
  const pageRef = useRef(1);
  useEffect(() => { conversationsRef.current = visible.conversations; pageRef.current = visible.page; });

  const ingest = useCallback((response) => dispatch({ type: 'snapshot', userId, items: response.data,
    counts: response.meta.counts, revision: response.meta.revision, page: response.meta.page, lastPage: response.meta.last_page }), [userId]);
  const upsert = useCallback((item) => dispatch({ type: 'upsert', userId, item }), [userId]);
  const refresh = useCallback(() => chatService.conversations().then((response) => { ingest(response); return response; }), [ingest]);
  const loadMore = useCallback(() => chatService.conversations({ page: pageRef.current + 1 }).then((response) => { ingest(response); return response; }), [ingest]);

  const threads = useMemo(() => createThreadStore({
    acquire: acquirePusherChannel, api: chatService, formatError: chatError,
    onDetail: (detail) => dispatch({ type: 'upsert', userId, item: detail }),
  }), [userId]);
  useEffect(() => {
    threads.setConversationLookup((id) => conversationsRef.current.find((item) => Number(item.id) === Number(id)));
    return () => threads.dispose();
  }, [threads]);

  useEffect(() => {
    dispatch({ type: 'reset', userId });
    if (!userId || !token) return;
    let active = true;
    const resync = () => refresh().catch((error) => { if (active) dispatch({ type: 'error', userId, error: chatError(error) }); });
    const userLease = acquirePusherChannel(`private-user.${userId}`);
    const presenceLease = acquirePusherChannel('presence-online');
    if (!userLease || !presenceLease) {
      void resync();
      dispatch({ type: 'connection', userId, value: 'unavailable' });
      return () => { active = false; chatService.clearAttachments(); };
    }
    const { channel, pusher } = userLease;
    // Load the inbox once the subscription is live so no event can slip between the HTTP read and the subscribe.
    let firstLoad = true;
    let fallback = null;
    const loadFirst = () => { if (!firstLoad) return false; firstLoad = false; clearTimeout(fallback); void resync(); return true; };
    // Later successes are re-subscriptions after a reconnect: events may have been missed, so re-sync once.
    const subscribed = () => { if (!loadFirst()) void resync(); };
    const update = (event) => {
      if (!active || !event?.conversation?.id) return;
      ingest({ data: [event.conversation], meta: { counts: event.counts, revision: event.revision } });
      if (event.conversation.last_sender_user_id !== userId && event.conversation.unread_count > 0) dispatch({ type: 'incoming', userId, id: event.conversation.id });
    };
    const presence = presenceLease.channel;
    const here = (members) => dispatch({ type: 'presence', userId, ids: Object.keys(members.members || {}) });
    const joining = (member) => dispatch({ type: 'member', userId, id: member.id, add: true });
    const leaving = (member) => dispatch({ type: 'member', userId, id: member.id, add: false });
    const connection = ({ current }) => dispatch({ type: 'connection', userId, value: current });
    const subscriptionError = () => {
      dispatch({ type: 'error', userId, error: 'Chưa kết nối được kênh realtime. Bạn có thể thử kết nối lại.' });
      loadFirst();
    };
    channel.bind('conversation.updated', update);
    channel.bind('pusher:subscription_succeeded', subscribed);
    channel.bind('pusher:subscription_error', subscriptionError);
    presence.bind('pusher:subscription_succeeded', here);
    presence.bind('pusher:member_added', joining);
    presence.bind('pusher:member_removed', leaving);
    presence.bind('pusher:subscription_error', subscriptionError);
    if (presence.subscribed) here(presence.members);
    dispatch({ type: 'connection', userId, value: pusher.connection.state });
    pusher.connection.bind('state_change', connection);
    if (channel.subscribed) loadFirst();
    else fallback = setTimeout(loadFirst, INBOX_SUBSCRIBE_WAIT_MS);
    return () => {
      active = false;
      clearTimeout(fallback);
      chatService.clearAttachments();
      channel.unbind('conversation.updated', update);
      channel.unbind('pusher:subscription_succeeded', subscribed);
      channel.unbind('pusher:subscription_error', subscriptionError);
      presence.unbind('pusher:subscription_succeeded', here);
      presence.unbind('pusher:member_added', joining);
      presence.unbind('pusher:member_removed', leaving);
      presence.unbind('pusher:subscription_error', subscriptionError);
      pusher.connection.unbind('state_change', connection);
      userLease.release(); presenceLease.release();
    };
  }, [userId, token, ingest, refresh]);

  return <ChatContext.Provider value={{ ...visible, ingest, upsert, refresh, loadMore, threads }}>{children}</ChatContext.Provider>;
}

import { useCallback, useEffect, useReducer } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { acquirePusherChannel } from '@/services/pusherService';
import { chatService, chatError } from '@/services/chatService';
import { mergeConversations } from '@/utils/chatState';
import { ChatContext } from '@/contexts/ChatStateContext';

const empty = { userId: null, conversations: [], counts: { total: 0, unread: 0, unread_messages: 0 }, revision: -1,
  connection: 'connecting', online: new Set(), presenceReady: false, error: '', incomingId: null };
function reducer(state, action) {
  if (action.type === 'reset') return { ...empty, userId: action.userId };
  if (state.userId !== action.userId) return state;
  if (action.type === 'snapshot') {
    const fresh = Number(action.revision) >= state.revision;
    return { ...state, conversations: mergeConversations(state.conversations, action.items),
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

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const userId = user?.id;
  const [state, dispatch] = useReducer(reducer, empty);
  const ingest = useCallback((response) => dispatch({ type: 'snapshot', userId, items: response.data,
    counts: response.meta.counts, revision: response.meta.revision }), [userId]);
  const upsert = useCallback((item) => dispatch({ type: 'upsert', userId, item }), [userId]);
  const refresh = useCallback(() => chatService.conversations().then((response) => { ingest(response); return response; }), [ingest]);

  useEffect(() => {
    dispatch({ type: 'reset', userId });
    if (!userId || !token) return;
    let active = true;
    const resync = () => refresh().catch((error) => { if (active) dispatch({ type: 'error', userId, error: chatError(error) }); });
    void resync();
    const userLease = acquirePusherChannel(`private-user.${userId}`);
    const presenceLease = acquirePusherChannel('presence-online');
    if (!userLease || !presenceLease) {
      dispatch({ type: 'connection', userId, value: 'unavailable' });
      return () => { active = false; chatService.clearAttachments(); };
    }
    const { channel, pusher } = userLease;
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
    const subscriptionError = () => dispatch({ type: 'error', userId, error: 'Chưa kết nối được kênh realtime. Bạn có thể thử kết nối lại.' });
    channel.bind('conversation.updated', update);
    channel.bind('pusher:subscription_succeeded', resync);
    channel.bind('pusher:subscription_error', subscriptionError);
    presence.bind('pusher:subscription_succeeded', here);
    presence.bind('pusher:member_added', joining);
    presence.bind('pusher:member_removed', leaving);
    presence.bind('pusher:subscription_error', subscriptionError);
    if (presence.subscribed) here(presence.members);
    dispatch({ type: 'connection', userId, value: pusher.connection.state });
    pusher.connection.bind('state_change', connection);
    const onFocus = () => { if (document.visibilityState === 'visible') void resync(); };
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      chatService.clearAttachments();
      channel.unbind('conversation.updated', update);
      channel.unbind('pusher:subscription_succeeded', resync);
      channel.unbind('pusher:subscription_error', subscriptionError);
      presence.unbind('pusher:subscription_succeeded', here);
      presence.unbind('pusher:member_added', joining);
      presence.unbind('pusher:member_removed', leaving);
      presence.unbind('pusher:subscription_error', subscriptionError);
      pusher.connection.unbind('state_change', connection);
      userLease.release(); presenceLease.release();
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, token, ingest, refresh]);

  const visible = state.userId === userId ? state : empty;
  return <ChatContext.Provider value={{ ...visible, ingest, upsert, refresh }}>{children}</ChatContext.Provider>;
}



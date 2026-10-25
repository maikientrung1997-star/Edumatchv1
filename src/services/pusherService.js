import Pusher from 'pusher-js';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';
import { createPusherChannelPool } from './pusherChannelPool';

const appKey = import.meta.env.VITE_PUSHER_APP_KEY;
const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap1';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const authEndpoint = import.meta.env.VITE_PUSHER_AUTH_ENDPOINT || `${apiBaseUrl.replace(/\/api\/?$/, '')}/broadcasting/auth`;

let client = null;
let clientToken = null;
// Conversation channels stay subscribed briefly after being left, so flipping between chats does not re-authorize them.
const CONVERSATION_CHANNEL_GRACE_MS = 30000;
const channelPool = createPusherChannelPool(() => getPusherClient(), {
  graceMs: (name) => (name.startsWith('private-chat.conversation.') ? CONVERSATION_CHANNEL_GRACE_MS : 0),
});
const enabledTransports = ['ws', 'wss'];

export const pusherConfiguration = () => ({ appKey, cluster, authEndpoint, enabledTransports });

export const getPusherClient = () => {
  if (!appKey) return null;
  const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN) || '';
  if (client && token !== clientToken) disconnectPusher();
  if (!client) {
    clientToken = token;
    Pusher.logToConsole = false;
    client = new Pusher(appKey, {
      cluster,
      forceTLS: true,
      enabledTransports,
      authEndpoint,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
  return client;
};

/** A user channel is shared by chat and notifications. Release only our lease. */
export const acquirePusherChannel = (name) => {
  return channelPool.acquire(name);
};

/** Subscribe to the authenticated user's private notification channel. */
export const subscribeUserNotifications = (userId, onNotificationReceived) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId < 1) return () => {};

  const channelName = `private-user.${numericUserId}`;
  const lease = acquirePusherChannel(channelName);
  if (!lease) return () => {};
  const { channel } = lease;
  const listener = (notification) => onNotificationReceived?.(notification);
  channel.bind('notification.created', listener);

  return () => {
    channel.unbind('notification.created', listener);
    lease.release();
  };
};

/** Close the singleton on logout or when the active token becomes invalid. */
export const disconnectPusher = () => {
  if (!client) return;
  client.disconnect();
  client = null;
  clientToken = null;
  channelPool.clear();
};

import api from './api';
import { resolveChatAvatarUrl } from '@/utils/chatAvatar';
import { sharedGet } from './sharedGet';
import { storage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const parameters = (values = {}) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false));
const noteQueues = new Map();
const attachments = new Map();
const sessionConfig = () => ({ headers: { Authorization: `Bearer ${storage.get(STORAGE_KEYS.ACCESS_TOKEN) || ''}` } });

export const chatService = {
  // Server limits/feature flags rarely change: fetch once per session (cache is keyed by token).
  config: () => sharedGet('/chat/config', {}, { ttlMs: 3600000 }),
  conversations: (params) => sharedGet('/chat/conversations', parameters(params)),
  conversation: (id) => sharedGet(`/chat/conversations/${id}`),
  openDirect: async (recipientId) => (await api.post('/chat/conversations', { recipient_id: Number(recipientId) }, sessionConfig())).data,
  startDirect: async (recipientId, body) => {
    const id = Number(recipientId);
    if (!Number.isSafeInteger(id) || id < 1) {
      const error = new Error('Người dạy này chưa có tài khoản được liên kết. Hãy tìm người dùng trong mục Tin nhắn.');
      error.chatMessage = true;
      throw error;
    }
    const conversation = await chatService.openDirect(id);
    if (body?.trim()) await chatService.send(conversation.id, { body: body.trim(), client_id: crypto.randomUUID() });
    return conversation;
  },
  createGroup: async (title, memberIds) => (await api.post('/chat/groups', { title, member_ids: memberIds.map(Number) }, sessionConfig())).data,
  searchUsers: async (q) => (await sharedGet('/chat/users/search', { q })).data,
  messages: (id, params) => sharedGet(`/chat/conversations/${id}/messages`, parameters(params)),
  message: async (id) => (await sharedGet(`/chat/messages/${id}`)).data,
  send: (id, { body, files = [], metadata, client_id }) => {
    const data = new FormData();
    data.append('client_id', client_id);
    if (body) data.append('body', body);
    if (metadata && Object.keys(metadata).length) data.append('metadata', JSON.stringify(metadata));
    files.forEach((file) => data.append('files[]', file));
    return api.post(`/chat/conversations/${id}/messages`, data, { headers: { ...sessionConfig().headers, 'Content-Type': undefined }, timeout: 120000 });
  },
  read: (id, lastMessageId) => api.post(`/chat/conversations/${id}/read`, { last_message_id: lastMessageId }, sessionConfig()),
  react: async (id, emoji) => (await api.post(`/chat/messages/${id}/reactions`, { emoji }, sessionConfig())).data,
  media: (id, params) => sharedGet(`/chat/conversations/${id}/media`, parameters(params)),
  saveNote: (id, notes, expectedToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN)) => {
    const token = expectedToken;
    if (storage.get(STORAGE_KEYS.ACCESS_TOKEN) !== token) return Promise.reject(new Error('Phiên đăng nhập đã thay đổi.'));
    const key = `${token}:${id}`;
    // Serialize autosaves for a conversation so slow older requests cannot win.
    const previous = noteQueues.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => {
      if (storage.get(STORAGE_KEYS.ACCESS_TOKEN) !== token) throw new Error('Phiên đăng nhập đã thay đổi.');
      return api.put(`/chat/conversations/${id}/notes`, { notes }, { headers: { Authorization: `Bearer ${token || ''}` } });
    });
    noteQueues.set(key, next);
    next.finally(() => { if (noteQueues.get(key) === next) noteQueues.delete(key); }).catch(() => {});
    return next;
  },
  typing: (id) => api.post(`/chat/conversations/${id}/typing`, {}, sessionConfig()),
  attachment: (id, inline = false) => {
    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const key = `${token}:${id}:${inline}`;
    if (!attachments.has(key)) {
      const pending = api.get(`/chat/attachments/${id}`, { ...sessionConfig(), params: inline ? { inline: 1 } : {}, responseType: 'blob' })
        .catch((error) => { attachments.delete(key); throw error; });
      attachments.set(key, pending);
      if (attachments.size > 8) attachments.delete(attachments.keys().next().value);
    }
    return attachments.get(key);
  },
  clearAttachments: () => attachments.clear(),
};

export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
export const CHAT_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt';
export const chatRole = (role) => ({ student: 'Học viên', teacher: 'Giáo viên', center: 'Trung tâm', admin: 'Quản trị viên', super_admin: 'Quản trị viên' }[role] || 'Người dùng');
export const chatError = (error) => error.response?.status === 413 ? 'Tổng dung lượng tệp vượt giới hạn máy chủ.' : error.response?.data?.message || (error.chatMessage ? error.message : 'Chưa thể kết nối. Vui lòng thử lại.');

export const chatAvatarUrl = (source) => resolveChatAvatarUrl(source, api.defaults.baseURL);

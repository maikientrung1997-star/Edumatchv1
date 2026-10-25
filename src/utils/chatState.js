export function mergeConversations(current, incoming) {
  const map = new Map(current.map((item) => [Number(item.id), item]));
  for (const item of incoming) {
    const previous = map.get(Number(item.id));
    if (!previous || Number(item.revision) >= Number(previous.revision)) {
      map.set(Number(item.id), { ...previous, ...item });
    }
  }
  return [...map.values()].sort((a, b) => (Date.parse(b.last_message_at) || 0) - (Date.parse(a.last_message_at) || 0) || b.id - a.id);
}

export function mergeChatMessages(current, incoming) {
  const list = [...current];
  for (const message of incoming) {
    const index = list.findIndex((item) => item.id === message.id || (message.client_id && item.client_id === message.client_id && Number(item.sender_user_id) === Number(message.sender_user_id)));
    if (index < 0) list.push(message);
    else {
      const previous = list[index];
      if (typeof previous.id === 'number' && typeof message.id !== 'number') continue;
      list[index] = Number(previous.revision || 0) > Number(message.revision || 0)
        ? { ...previous, ...message, reactions: previous.reactions, revision: previous.revision }
        : { ...previous, ...message };
    }
  }
  return list.sort((a, b) => typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id
    : (Date.parse(a.sent_at) || 0) - (Date.parse(b.sent_at) || 0) || String(a.id).localeCompare(String(b.id)));
}

export function applyReaction(message, event) {
  if (Number(message.id) !== Number(event.message_id) || Number(message.revision || 0) > Number(event.revision)) return message;
  return { ...message, reactions: event.reactions, revision: event.revision };
}

export function chatDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const chatTime = (value) => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

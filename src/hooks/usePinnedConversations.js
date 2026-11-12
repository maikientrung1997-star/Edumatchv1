import { useCallback, useEffect, useState } from 'react';
import { getPinnedConversationIds, togglePinnedConversation } from '@/features/learning/marketplace';

/** Danh sách ID hội thoại đã ghim của người dùng, đồng bộ giữa danh sách, header và bảng thông tin. */
export function usePinnedConversations(userId) {
  const [state, setState] = useState(() => ({ userId, ids: getPinnedConversationIds(userId) }));
  const ids = state.userId === userId ? state.ids : getPinnedConversationIds(userId);
  if (state.userId !== userId) setState({ userId, ids });

  useEffect(() => {
    const sync = () => setState({ userId, ids: getPinnedConversationIds(userId) });
    window.addEventListener('edumatch:pinned-conversations-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('edumatch:pinned-conversations-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);

  const isPinned = useCallback((conversationId) => ids.includes(String(conversationId)), [ids]);
  const togglePin = useCallback((conversationId) => togglePinnedConversation(userId, conversationId), [userId]);

  return { pinnedIds: ids, isPinned, togglePin };
}

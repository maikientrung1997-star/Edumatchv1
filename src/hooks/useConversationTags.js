import { useEffect, useState } from 'react';
import {
  deleteMessageTag,
  getConversationTags,
  getMessageTags,
  saveMessageTag,
  setConversationTags,
} from '@/features/learning/marketplace';

export const MAX_CONVERSATION_TAGS = 2;
const LIMIT_NOTICE = `Mỗi cuộc trò chuyện chỉ gắn tối đa ${MAX_CONVERSATION_TAGS} thẻ.`;

const tagIdFromName = (value) => {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug) return slug;
  return `tag-${[...value].reduce((total, character) => (total * 31 + character.codePointAt(0)) >>> 0, 7)}`;
};

/** Thẻ của một hội thoại và thư viện thẻ của người dùng; dùng chung cho thanh thẻ desktop và bảng thẻ mobile. */
export function useConversationTags(userId, conversationId) {
  const currentKey = `${userId}:${conversationId}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  const [tags, setTags] = useState(() => getConversationTags(userId, conversationId));
  const [library, setLibrary] = useState(() => getMessageTags(userId));
  const [notice, setNotice] = useState('');

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setTags(getConversationTags(userId, conversationId));
    setLibrary(getMessageTags(userId));
    setNotice('');
  }

  useEffect(() => {
    const handleUpdate = () => {
      if (!userId || !conversationId) return;
      setTags(getConversationTags(userId, conversationId));
      setLibrary(getMessageTags(userId));
    };
    window.addEventListener('edumatch:conversation-tags-updated', handleUpdate);
    window.addEventListener('edumatch:message-tags-updated', handleUpdate);
    return () => {
      window.removeEventListener('edumatch:conversation-tags-updated', handleUpdate);
      window.removeEventListener('edumatch:message-tags-updated', handleUpdate);
    };
  }, [conversationId, userId]);

  const toggleTag = (tag) => {
    const isApplied = tags.some((item) => item.id === tag.id);
    if (!isApplied && tags.length >= MAX_CONVERSATION_TAGS) {
      setNotice(LIMIT_NOTICE);
      return false;
    }
    setConversationTags(userId, conversationId, isApplied ? tags.filter((item) => item.id !== tag.id) : [...tags, tag]);
    setNotice('');
    return true;
  };

  const createTag = (rawName, color) => {
    const name = rawName.trim();
    if (!name) return false;
    if (tags.length >= MAX_CONVERSATION_TAGS) {
      setNotice(LIMIT_NOTICE);
      return false;
    }
    const newTag = { id: tagIdFromName(name), name, color };
    saveMessageTag(userId, newTag);
    if (!tags.some((item) => item.id === newTag.id)) {
      setConversationTags(userId, conversationId, [...tags, newTag]);
    }
    setNotice('');
    return true;
  };

  const deleteTag = (tagId) => deleteMessageTag(userId, tagId);

  return { tags, library, notice, setNotice, toggleTag, createTag, deleteTag };
}

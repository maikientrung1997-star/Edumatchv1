import React, { useEffect, useRef, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import {
  TAG_COLORS,
  deleteMessageTag,
  getConversationTags,
  getMessageTags,
  saveMessageTag,
  setConversationTags,
} from '@/features/learning/marketplace';

const tagIdFromName = (value) => {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug) return slug;
  return `tag-${[...value].reduce((total, character) => (total * 31 + character.codePointAt(0)) >>> 0, 7)}`;
};

export function ConversationTagBar({ conversationId, user }) {
  const userId = user?.id;
  const currentKey = `${userId}:${conversationId}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  const [tags, setTags] = useState(() => getConversationTags(userId, conversationId));
  const [library, setLibrary] = useState(() => getMessageTags(userId));
  const [showCreator, setShowCreator] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);
  const [notice, setNotice] = useState('');
  const tagBarRef = useRef(null);

  useEffect(() => {
    if (!showCreator) return;
    const closeCreatorOutside = (event) => {
      if (!tagBarRef.current?.contains(event.target)) {
        setShowCreator(false);
        setNotice('');
      }
    };
    document.addEventListener('pointerdown', closeCreatorOutside, true);
    return () => document.removeEventListener('pointerdown', closeCreatorOutside, true);
  }, [showCreator]);

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setTags(getConversationTags(userId, conversationId));
    setLibrary(getMessageTags(userId));
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

  if (!userId || !conversationId) return null;

  const handleToggleTag = (tag) => {
    const isApplied = tags.some((t) => t.id === tag.id);
    if (!isApplied && tags.length >= 2) {
      setNotice('Mỗi cuộc trò chuyện chỉ gắn tối đa 2 thẻ.');
      return;
    }
    const nextTags = isApplied
      ? tags.filter((t) => t.id !== tag.id)
      : [...tags, tag];
    setConversationTags(userId, conversationId, nextTags);
    setNotice('');
  };

  const handleCreateTag = (event) => {
    event.preventDefault();
    const name = tagName.trim();
    if (!name) return;
    if (tags.length >= 2) {
      setNotice('Mỗi cuộc trò chuyện chỉ gắn tối đa 2 thẻ.');
      return;
    }
    const id = tagIdFromName(name);
    const newTag = { id, name, color: tagColor };
    saveMessageTag(userId, newTag);
    if (!tags.some((t) => t.id === id)) {
      setConversationTags(userId, conversationId, [...tags, newTag]);
    }
    setTagName('');
    setNotice('');
    setShowCreator(false);
  };

  const handleDeleteLibraryTag = (tagId, event) => {
    event.stopPropagation();
    deleteMessageTag(userId, tagId);
  };

  return (
    <div className="chat-tag-bar-wrap" ref={tagBarRef}>
      <nav className="chat-tag-bar" aria-label="Gắn thẻ cuộc trò chuyện">
        <span>
          <Tag size={14} /> Thẻ:
        </span>
        <div className="chat-tag-bar__list">
          {tags.length > 0
            ? tags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  className="chat-tag-pill is-applied"
                  style={{ '--tag-color': tag.color }}
                  onClick={() => handleToggleTag(tag)}
                  title={`Bỏ thẻ ${tag.name}`}
                >
                  <i />
                  <span>{tag.name}</span>
                  <X size={12} />
                </button>
              ))
            : <small className="chat-tag-bar__hint">Chưa gắn thẻ nào</small>}

          {library
            .filter((libTag) => !tags.some((t) => t.id === libTag.id))
            .map((tag) => (
              <button
                type="button"
                key={tag.id}
                className="chat-tag-pill"
                style={{ '--tag-color': tag.color }}
                onClick={() => handleToggleTag(tag)}
                title={`Gắn thẻ ${tag.name}`}
              >
                <i />
                <span>{tag.name}</span>
              </button>
            ))}
        </div>
        <button
          type="button"
          className="chat-tag-bar__create"
          onClick={() => {
            setShowCreator((val) => !val);
            setNotice('');
          }}
        >
          <Plus size={14} /> {showCreator ? 'Đóng' : 'Tạo thẻ'}
        </button>
      </nav>

      {showCreator && (
        <section className="chat-tag-creator">
          <form onSubmit={handleCreateTag}>
            <label>
              Tên thẻ mới
              <span className="tag-name-input">
                <input
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value.slice(0, 25))}
                  placeholder="Ví dụ: Cần tư vấn, VIP..."
                  maxLength="25"
                  autoFocus
                />
                <small className={tagName.length >= 25 ? 'is-limit' : ''}>
                  {tagName.length}/25
                </small>
              </span>
            </label>
            <fieldset>
              <span className="tag-color-picker">
                {TAG_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.id}
                    className={tagColor === color.value ? 'is-active' : ''}
                    style={{ '--tag-color': color.value }}
                    onClick={() => setTagColor(color.value)}
                    aria-label={`Chọn màu ${color.label}`}
                  />
                ))}
              </span>
            </fieldset>
            <button type="submit" disabled={!tagName.trim()}>
              Tạo và gắn thẻ
            </button>
          </form>
          {notice && <p className="chat-tag-creator__notice">{notice}</p>}
          {library.length > 0 && (
            <div className="chat-tag-creator__library">
              <span>Thẻ đã tạo:</span>
              <div>
                {library.map((tag) => (
                  <span key={tag.id} style={{ '--tag-color': tag.color }}>
                    {tag.name}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteLibraryTag(tag.id, e)}
                      aria-label={`Xóa thẻ ${tag.name}`}
                      title={`Xóa thẻ ${tag.name}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/feedback/Modal';
import { TAG_COLORS } from '@/features/learning/marketplace';
import { useConversationTags } from '@/hooks/useConversationTags';

const TAG_NAME_LIMIT = 25;

export function ConversationTagBar({ conversationId, user }) {
  const userId = user?.id;
  const { tags, library, notice, setNotice, toggleTag, createTag, deleteTag } = useConversationTags(userId, conversationId);
  const [showCreator, setShowCreator] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);
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
  }, [showCreator, setNotice]);

  if (!userId || !conversationId) return null;

  const handleToggleTag = (tag) => toggleTag(tag);

  const handleCreateTag = (event) => {
    event.preventDefault();
    if (!createTag(tagName, tagColor)) return;
    setTagName('');
    setShowCreator(false);
  };

  const handleDeleteLibraryTag = (tagId, event) => {
    event.stopPropagation();
    deleteTag(tagId);
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
                  onChange={(e) => setTagName(e.target.value.slice(0, TAG_NAME_LIMIT))}
                  placeholder="Ví dụ: Cần tư vấn, VIP..."
                  maxLength={TAG_NAME_LIMIT}
                  autoFocus
                />
                <small className={tagName.length >= TAG_NAME_LIMIT ? 'is-limit' : ''}>
                  {tagName.length}/{TAG_NAME_LIMIT}
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

/** Bảng gắn thẻ dạng trượt từ dưới lên, dùng trên mobile: chọn, tìm, tạo và xóa thẻ. */
export function ConversationTagSheet({ open, onClose, conversationId, user }) {
  const { tags, library, notice, setNotice, toggleTag, createTag, deleteTag } = useConversationTags(user?.id, conversationId);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const close = () => {
    setQuery('');
    setCreating(false);
    setTagName('');
    setConfirmDeleteId(null);
    setNotice('');
    onClose();
  };

  const needle = query.trim().toLocaleLowerCase('vi');
  const shownTags = needle ? library.filter((tag) => tag.name.toLocaleLowerCase('vi').includes(needle)) : library;

  const startCreating = () => {
    setCreating(true);
    setTagName(query.trim().slice(0, TAG_NAME_LIMIT));
    setConfirmDeleteId(null);
  };

  const submitNewTag = (event) => {
    event.preventDefault();
    if (!createTag(tagName, tagColor)) return;
    setTagName('');
    setQuery('');
    setCreating(false);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Gắn thẻ hội thoại"
      size="sm"
      className="em-tag-sheet"
      overlayClassName="em-tag-sheet-overlay"
    >
      {library.length > 0 && (
        <label className="em-tag-sheet__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm kiếm thẻ"
            aria-label="Tìm kiếm thẻ"
          />
        </label>
      )}
      {notice && <p className="em-tag-sheet__notice" role="status">{notice}</p>}

      {shownTags.length > 0 && (
        <ul className="em-tag-sheet__list">
          {shownTags.map((tag) => {
            const isApplied = tags.some((item) => item.id === tag.id);
            const isConfirming = confirmDeleteId === tag.id;
            return (
              <li key={tag.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isApplied}
                  className="em-tag-sheet__row"
                  onClick={() => {
                    setConfirmDeleteId(null);
                    toggleTag(tag);
                  }}
                >
                  <span className={`em-tag-sheet__check ${isApplied ? 'is-checked' : ''}`} aria-hidden="true">
                    {isApplied && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="em-tag-sheet__pill" style={{ '--tag-color': tag.color }}>
                    <span className="em-tag-sheet__pill-name">{tag.name}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`em-tag-sheet__delete ${isConfirming ? 'is-confirming' : ''}`}
                  onClick={() => (isConfirming ? deleteTag(tag.id) : setConfirmDeleteId(tag.id))}
                  aria-label={isConfirming ? `Xác nhận xóa thẻ ${tag.name}` : `Xóa thẻ ${tag.name}`}
                  title={isConfirming ? 'Bấm lần nữa để xóa' : `Xóa thẻ ${tag.name}`}
                >
                  {isConfirming ? 'Xóa' : <Trash2 size={15} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!library.length && !creating && (
        <p className="em-tag-sheet__empty">Chưa có thẻ nào. Tạo thẻ để phân loại hội thoại.</p>
      )}
      {library.length > 0 && needle && !shownTags.length && (
        <p className="em-tag-sheet__empty">Không có thẻ nào tên “{query.trim()}”.</p>
      )}

      {creating ? (
        <form className="em-tag-sheet__creator" onSubmit={submitNewTag}>
          <span className="em-tag-sheet__name">
            <input
              value={tagName}
              onChange={(event) => setTagName(event.target.value.slice(0, TAG_NAME_LIMIT))}
              placeholder="Tên thẻ, ví dụ: Cần tư vấn"
              aria-label="Tên thẻ mới"
              maxLength={TAG_NAME_LIMIT}
              autoFocus
            />
            <small className={tagName.length >= TAG_NAME_LIMIT ? 'is-limit' : ''}>{tagName.length}/{TAG_NAME_LIMIT}</small>
          </span>
          <span className="tag-color-picker em-tag-sheet__colors" role="radiogroup" aria-label="Màu thẻ">
            {TAG_COLORS.map((color) => (
              <button
                type="button"
                key={color.id}
                role="radio"
                aria-checked={tagColor === color.value}
                className={tagColor === color.value ? 'is-active' : ''}
                style={{ '--tag-color': color.value }}
                onClick={() => setTagColor(color.value)}
                aria-label={`Chọn màu ${color.label}`}
              />
            ))}
          </span>
          <div className="em-tag-sheet__creator-actions">
            <button type="button" onClick={() => setCreating(false)}>Hủy</button>
            <button type="submit" disabled={!tagName.trim()}>Tạo và gắn thẻ</button>
          </div>
        </form>
      ) : (
        <button type="button" className="em-tag-sheet__new" onClick={startCreating}>
          <Plus size={15} aria-hidden="true" /> Tạo thẻ mới
        </button>
      )}
    </Modal>
  );
}

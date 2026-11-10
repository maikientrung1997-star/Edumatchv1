import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Tag, X } from 'lucide-react';
import { chatError, chatService } from '@/services/chatService';

export function ConversationTagBar({ conversationId, tags, library, ready, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const pickerId = useId();
  const tagBarRef = useRef(null);
  const triggerRef = useRef(null);
  const appliedIds = new Set(tags.map((tag) => tag.id));

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event) => {
      if (!tagBarRef.current?.contains(event.target)) {
        setPickerOpen(false);
        setNotice('');
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && tagBarRef.current?.contains(event.target)) {
        setPickerOpen(false);
        setNotice('');
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpen]);

  const changeTag = async (tag, applied) => {
    if (saving) return;
    if (applied && tags.length >= 2) {
      setNotice('Mỗi cuộc trò chuyện chỉ gắn tối đa 2 thẻ.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      onChange(await chatService.assignTag(conversationId, tag.id, applied));
      setPickerOpen(false);
      if (pickerOpen) triggerRef.current?.focus();
    } catch (failure) {
      setNotice(chatError(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="chat-tag-bar-wrap" ref={tagBarRef}>
      <nav className="chat-tag-bar" aria-label="Thẻ đã gắn cho cuộc trò chuyện">
        <span><Tag size={14} /> Thẻ:</span>
        <div className="chat-tag-bar__list">
          {tags.length > 0 ? tags.map((tag) => (
            <button
              type="button"
              key={tag.id}
              className="chat-tag-pill is-applied"
              style={{ '--tag-color': tag.color }}
              disabled={saving}
              onClick={() => void changeTag(tag, false)}
              aria-label={`Bỏ thẻ ${tag.name}`}
              title={`Bỏ thẻ ${tag.name}`}
            >
              <i aria-hidden="true" />
              <span>{tag.name}</span>
              <X size={12} aria-hidden="true" />
            </button>
          )) : <small className="chat-tag-bar__hint">Chưa gắn thẻ nào</small>}
        </div>
        <button
          type="button"
          ref={triggerRef}
          className="chat-tag-bar__picker"
          disabled={!ready}
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? pickerId : undefined}
          onClick={() => {
            setPickerOpen((current) => !current);
            setNotice('');
          }}
        >
          Phân loại <ChevronDown size={13} aria-hidden="true" />
        </button>
      </nav>

      {pickerOpen && (
        <div id={pickerId} className="chat-tag-picker" role="group" aria-label="Thẻ phân loại có sẵn">
          <p>Chọn tối đa 2 thẻ</p>
          {library.filter((tag) => tag.is_preset).map((tag) => (
            <button
              type="button"
              key={tag.id}
              aria-pressed={appliedIds.has(tag.id)}
              disabled={saving}
              onClick={() => void changeTag(tag, !appliedIds.has(tag.id))}
            >
              <i aria-hidden="true" style={{ backgroundColor: tag.color }} />
              <span>{tag.name}</span>
              {appliedIds.has(tag.id) && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          {notice && <p className="chat-tag-bar__notice" role="alert">{notice}</p>}
        </div>
      )}
      {!pickerOpen && notice && <p className="chat-tag-bar__notice" role="alert">{notice}</p>}
    </div>
  );
}

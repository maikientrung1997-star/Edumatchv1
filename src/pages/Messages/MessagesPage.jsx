import { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, FileText, Forward, ListFilter, MailOpen, MessageCircle, MoreHorizontal, Pencil, Plus, Reply, Search, Send, Tag, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { createConversationId, deleteMessageTag, deleteMessageTemplate, getCourse, getConversationsForUser, getMessageTags, getMessageTemplates, markConversationRead, removeMessageTagFromUserConversations, saveConversation, saveMessageTag, saveMessageTemplate, setConversationTags } from '@/features/learning/marketplace';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import { setChatWidget } from '@/features/learning/chatWidget';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { formatMessageDayDivider, formatMessageTime, formatMessageTimestamp, messageNeedsDayDivider } from '@/utils/messageTime';
import './messages.css';

const threadKey = (message) => `${message.courseId}:${message.studentId}:${message.teacherId}`;

const TAG_COLORS = [
  { id: 'emerald', label: 'Xanh lá', value: '#087f69' },
  { id: 'teal', label: 'Xanh ngọc', value: '#0f766e' },
  { id: 'cyan', label: 'Xanh cyan', value: '#0891b2' },
  { id: 'sky', label: 'Xanh da trời', value: '#0284c7' },
  { id: 'blue', label: 'Xanh dương', value: '#2563eb' },
  { id: 'indigo', label: 'Chàm', value: '#4f46e5' },
  { id: 'violet', label: 'Tím', value: '#7c3aed' },
  { id: 'fuchsia', label: 'Hồng tím', value: '#c026d3' },
  { id: 'rose', label: 'Hồng', value: '#c74d68' },
  { id: 'red', label: 'Đỏ', value: '#dc2626' },
  { id: 'orange', label: 'Cam', value: '#ea580c' },
  { id: 'amber', label: 'Cam', value: '#b87918' },
  { id: 'lime', label: 'Xanh chanh', value: '#65a30d' },
  { id: 'slate', label: 'Xám xanh', value: '#475569' },
];
const normalizeTag = (tag) => typeof tag === 'string'
  ? { id: tag.toLowerCase(), name: tag, color: TAG_COLORS[0].value }
  : tag;
const getThreadTags = (thread) => (thread?.messages?.[0]?.tags || []).map(normalizeTag);
const tagIdFromName = (value) => {
  const slug = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug) return slug;
  return `tag-${[...value].reduce((total, character) => ((total * 31) + character.codePointAt(0)) >>> 0, 7)}`;
};

export function MessagesPage() {
  const { user } = useAuth();
  const { isOnline } = useOnlinePresence(user?.id);
  const [messages, setMessages] = useState(() => getConversationsForUser(user?.id));
  const [selectedKey, setSelectedKey] = useState(() => {
    const first = getConversationsForUser(user?.id)[0];
    return first ? threadKey(first) : null;
  });
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);
  const [tagLibrary, setTagLibrary] = useState(() => getMessageTags(user?.id));
  const [tagNotice, setTagNotice] = useState('');
  const [messageTemplates, setMessageTemplates] = useState(() => getMessageTemplates(user?.id));
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [templateNotice, setTemplateNotice] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const messageHistoryRef = useRef(null);
  const messageRefs = useRef(new Map());
  const longPressTimer = useRef(null);
  const replyHighlightTimer = useRef(null);
  const [openMessageMenu, setOpenMessageMenu] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const threads = useMemo(() => {
    const groups = new Map();
    messages.forEach((message) => {
      const key = threadKey(message);
      const course = getCourse(message.courseId);
      const isTeacher = message.teacherId === user?.id;
      const contactName = isTeacher
        ? message.studentName || 'Học viên EduMatch'
        : message.teacherName || course?.teacher?.name || 'Giáo viên EduMatch';
      const contactId = isTeacher ? message.studentId : message.teacherId;
      const contactAvatar = isTeacher
        ? message.studentAvatar || ''
        : message.teacherAvatar || course?.teacher?.avatar || '';
      const contactRole = isTeacher ? 'student' : course?.teacher?.role || 'teacher';
      const current = groups.get(key) || { key, course, contactName, contactId, contactAvatar, contactRole, messages: [] };
      if (!current.contactAvatar && contactAvatar) current.contactAvatar = contactAvatar;
      current.messages.push(message);
      groups.set(key, current);
    });
    return [...groups.values()].map((thread) => ({ ...thread, messages: [...thread.messages].reverse() }));
  }, [messages, user?.id]);
  const isThreadUnread = (thread) => thread.messages.some((message) => (message.unreadFor || []).includes(user?.id));
  const allTags = useMemo(() => {
    const uniqueTags = new Map();
    tagLibrary.forEach((tag) => uniqueTags.set(tag.id, normalizeTag(tag)));
    threads.forEach((thread) => getThreadTags(thread).forEach((tag) => uniqueTags.set(tag.id, tag)));
    return [...uniqueTags.values()];
  }, [tagLibrary, threads]);
  const tagCounts = useMemo(() => new Map(allTags.map((tag) => [
    tag.id,
    threads.filter((thread) => getThreadTags(thread).some((item) => item.id === tag.id)).length,
  ])), [allTags, threads]);
  const filteredThreads = threads.filter((thread) =>
    `${thread.contactName} ${thread.course?.title || ''}`.toLowerCase().includes(query.toLowerCase())
    && (!showUnreadOnly || isThreadUnread(thread))
    && (!selectedTagIds.length || getThreadTags(thread).some((tag) => selectedTagIds.includes(tag.id)))
  );
  const selectedThread = threads.find((thread) => thread.key === selectedKey) || filteredThreads[0];
  const filteredMessageTemplates = useMemo(() => {
    const normalizedQuery = templateQuery.trim().toLocaleLowerCase('vi');
    if (!normalizedQuery) return messageTemplates;
    return messageTemplates.filter((template) => `${template.title} ${template.text}`.toLocaleLowerCase('vi').includes(normalizedQuery));
  }, [messageTemplates, templateQuery]);

  useEffect(() => {
    if (user?.id && selectedThread?.key) setChatWidget(user.id, selectedThread.key);
  }, [selectedThread?.key, user?.id]);

  useEffect(() => {
    const history = messageHistoryRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [selectedThread?.key, selectedThread?.messages.length]);

  useEffect(() => () => window.clearTimeout(replyHighlightTimer.current), []);

  useEffect(() => {
    const refreshTemplates = () => setMessageTemplates(getMessageTemplates(user?.id));
    window.addEventListener('edumatch:message-templates-updated', refreshTemplates);
    window.addEventListener('storage', refreshTemplates);
    return () => {
      window.removeEventListener('edumatch:message-templates-updated', refreshTemplates);
      window.removeEventListener('storage', refreshTemplates);
    };
  }, [user?.id]);

  const send = (event) => {
    event.preventDefault();
    if (isTemplateEditorOpen) return;
    if (!draft.trim() || !selectedThread) return;
    const seed = selectedThread.messages[0];
    const next = {
      id: createConversationId(),
      courseId: seed.courseId,
      teacherId: seed.teacherId,
      teacherName: seed.teacherName || selectedThread.course?.teacher?.name || 'Giáo viên EduMatch',
      teacherAvatar: seed.teacherAvatar || selectedThread.course?.teacher?.avatar || '',
      studentId: seed.studentId,
      studentName: seed.studentName || 'Học viên EduMatch',
      studentAvatar: seed.studentAvatar || '',
      senderId: user.id,
      text: draft.trim(),
      replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderId === user.id ? 'Bạn' : selectedThread.contactName } : null,
      createdAt: new Date().toISOString(),
    };
    const readMessages = markConversationRead(selectedThread, user.id);
    saveConversation(next);
    setMessages([next, ...readMessages.filter((message) => message.studentId === user.id || message.teacherId === user.id)]);
    setDraft('');
    setReplyingTo(null);
  };

  const forwardMessage = (target) => {
    if (!forwarding) return;
    const next = {
      id: createConversationId('forwarded-message'),
      courseId: target.messages[0].courseId,
      teacherId: target.messages[0].teacherId,
      teacherName: target.messages[0].teacherName || target.course?.teacher?.name || 'Giáo viên EduMatch',
      teacherAvatar: target.messages[0].teacherAvatar || target.course?.teacher?.avatar || '',
      studentId: target.messages[0].studentId,
      studentName: target.messages[0].studentName || 'Học viên EduMatch',
      studentAvatar: target.messages[0].studentAvatar || '',
      senderId: user.id,
      text: forwarding.text,
      forwarded: true,
      createdAt: new Date().toISOString(),
    };
    saveConversation(next);
    setMessages((current) => [next, ...current]);
    setForwarding(null);
  };

  const startLongPress = (messageId) => {
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setOpenMessageMenu(messageId), 450);
  };
  const clearLongPress = () => window.clearTimeout(longPressTimer.current);

  const scrollToOriginalMessage = (messageId) => {
    const target = messageRefs.current.get(messageId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.clearTimeout(replyHighlightTimer.current);
    replyHighlightTimer.current = window.setTimeout(() => setHighlightedMessageId(null), 1400);
  };

  const markSelectedRead = () => {
    if (!selectedThread || !user?.id) return;
    const next = markConversationRead(selectedThread, user.id);
    setMessages(next.filter((message) => message.studentId === user.id || message.teacherId === user.id));
  };

  const selectThread = (thread) => {
    setSelectedKey(thread.key);
    if (user?.id) setChatWidget(user.id, thread.key);
    if (!user?.id || !isThreadUnread(thread)) return;
    const next = markConversationRead(thread, user.id);
    setMessages(next.filter((message) => message.studentId === user.id || message.teacherId === user.id));
  };

  const addTag = (event) => {
    event.preventDefault();
    const tag = tagDraft.trim();
    if (!tag || !selectedThread) return;
    const tags = getThreadTags(selectedThread);
    if (tags.some((item) => item.name.toLowerCase() === tag.toLowerCase())) { setTagDraft(''); return; }
    if (tags.length >= 2) { setTagNotice('Mỗi cuộc trò chuyện chỉ gắn tối đa 2 thẻ.'); return; }
    const id = tagIdFromName(tag);
    const nextTag = { id, name: tag, color: tagColor };
    setTagLibrary(saveMessageTag(user?.id, nextTag));
    const next = setConversationTags(selectedThread, [...tags, nextTag]);
    setMessages(next.filter((message) => message.studentId === user?.id || message.teacherId === user?.id));
    setTagDraft('');
    setTagNotice('');
    setShowTagCreator(false);
  };

  const toggleTag = (tag) => {
    if (!selectedThread) return;
    const current = getThreadTags(selectedThread);
    const hasTag = current.some((item) => item.id === tag.id);
    if (!hasTag && current.length >= 2) { setTagNotice('Mỗi cuộc trò chuyện chỉ gắn tối đa 2 thẻ.'); return; }
    const next = setConversationTags(selectedThread, hasTag ? current.filter((item) => item.id !== tag.id) : [...current, tag]);
    setMessages(next.filter((message) => message.studentId === user?.id || message.teacherId === user?.id));
    setTagNotice('');
  };

  const deleteTag = (tagId) => {
    setTagLibrary(deleteMessageTag(user?.id, tagId));
    setMessages(removeMessageTagFromUserConversations(user?.id, tagId));
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
  };

  const resetTemplateEditor = () => {
    setIsTemplateEditorOpen(false);
    setEditingTemplateId(null);
    setTemplateTitle('');
    setTemplateText('');
    setTemplateNotice('');
  };
  const openTemplateEditor = (template = null) => {
    setShowTemplatePanel(true);
    setIsTemplateEditorOpen(true);
    setEditingTemplateId(template?.id || null);
    setTemplateTitle(template?.title || '');
    setTemplateText(template?.text || '');
    setTemplateNotice('');
  };
  const saveTemplate = (event) => {
    event.preventDefault();
    const title = templateTitle.trim();
    const text = templateText.trim();
    if (!title || !text) {
      setTemplateNotice('Hãy nhập tên và nội dung tin nhắn mẫu.');
      return;
    }
    const template = {
      id: editingTemplateId || `message-template-${Date.now()}`,
      title,
      text,
      ...(editingTemplateId ? {} : { createdAt: new Date().toISOString() }),
    };
    setMessageTemplates(saveMessageTemplate(user?.id, template));
    resetTemplateEditor();
  };
  const insertTemplate = (template) => {
    setDraft((current) => current.trim() ? `${current}${current.endsWith('\n') ? '' : '\n'}${template.text}` : template.text);
    setShowTemplatePanel(false);
    setTemplateNotice('');
  };
  const removeTemplate = (templateId) => {
    setMessageTemplates(deleteMessageTemplate(user?.id, templateId));
    if (editingTemplateId === templateId) resetTemplateEditor();
  };

  const toggleTagFilter = (tagId) => setSelectedTagIds((current) =>
    current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
  );

  const unreadCount = threads.filter(isThreadUnread).length;

  return (
    <section className="messages-page">
      <div className="messages-shell">
        <aside className="conversation-list" aria-label="Danh sách hội thoại">
          <div className="conversation-list__head">
            <div><span>EDUMATCH CHAT</span><h1>Tin nhắn</h1></div>
            <span className="conversation-list__count">{threads.length}</span>
          </div>
          <div className="conversation-search-row"><label className="conversation-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm cuộc trò chuyện" /></label><div className="conversation-filter"><button type="button" className={showTagFilter || selectedTagIds.length ? 'is-active' : ''} onClick={() => setShowTagFilter((value) => !value)}><ListFilter size={16} /> Lọc theo{selectedTagIds.length ? ` (${selectedTagIds.length})` : ''}</button>{showTagFilter && <div className="conversation-filter__menu"><div><strong>Lọc theo thẻ</strong><button type="button" onClick={() => setSelectedTagIds([])} disabled={!selectedTagIds.length}>Xóa lọc</button></div>{allTags.length ? allTags.map((tag) => <label key={tag.id}><input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => toggleTagFilter(tag.id)} /><i style={{ '--tag-color': tag.color }} />{tag.name}<small>{tagCounts.get(tag.id) || 0}</small></label>) : <p>Chưa có thẻ để lọc.</p>}</div>}</div></div>
          <div className="conversation-filter-tabs" aria-label="Bộ lọc hội thoại">
            <button type="button" className={!showUnreadOnly ? 'is-active' : ''} onClick={() => setShowUnreadOnly(false)}>Tất cả</button>
            <button type="button" className={showUnreadOnly ? 'is-active' : ''} onClick={() => setShowUnreadOnly((value) => !value)}><MailOpen size={14} /> Chưa đọc{unreadCount ? ` (${unreadCount})` : ''}</button>
          </div>
          {selectedTagIds.length > 0 && <div className="conversation-active-filter"><Tag size={13} /> Đang lọc {selectedTagIds.length} thẻ<button type="button" onClick={() => setSelectedTagIds([])}>Xóa</button></div>}
          <div className="conversation-list__items">
            {filteredThreads.length ? filteredThreads.map((thread) => {
              const latest = thread.messages.at(-1);
              const isUnread = isThreadUnread(thread);
              return <button className={`conversation-item ${selectedThread?.key === thread.key ? 'is-selected' : ''} ${isUnread ? 'is-unread' : ''}`} key={thread.key} onClick={() => selectThread(thread)}><span className={`conversation-item__avatar ${isOnline(thread.contactId) ? 'is-online' : ''}`}>{thread.contactAvatar ? <img src={thread.contactAvatar} alt="" /> : <DefaultRoleAvatar role={thread.contactRole} size={18} />}</span><span className="conversation-item__copy"><strong>{thread.contactName}</strong>{thread.course?.title && <small>{thread.course.title}</small>}<em>{latest?.text}</em>{getThreadTags(thread).length > 0 && <span className="conversation-item__tags">{getThreadTags(thread).map((tag) => <i key={tag.id} style={{ '--tag-color': tag.color }}>{tag.name}</i>)}</span>}</span>{isUnread && <b className="conversation-item__unread" aria-label="Có tin nhắn chưa đọc" />}</button>;
            }) : <div className="conversation-empty"><MessageCircle size={24} /><p>Chưa có cuộc trò chuyện nào.</p></div>}
          </div>
        </aside>
        <main className="chat-window">
          {selectedThread ? <>
            <header className="chat-window__head">
              <span className={`chat-window__avatar ${isOnline(selectedThread.contactId) ? 'is-online' : ''}`}>{selectedThread.contactAvatar ? <img src={selectedThread.contactAvatar} alt="" /> : <DefaultRoleAvatar role={selectedThread.contactRole} size={20} />}</span>
              <div className="chat-window__contact">
                <h2>{selectedThread.contactName}</h2>
                {selectedThread.course?.title && <p>{selectedThread.course.title}</p>}
                {getThreadTags(selectedThread).length > 0 && <div className="chat-window__profile-tags">{getThreadTags(selectedThread).map((tag) => <span key={tag.id} style={{ '--tag-color': tag.color }}>{tag.name}</span>)}</div>}
              </div>
              <span className={`chat-window__status ${isOnline(selectedThread.contactId) ? 'is-online' : ''}`}>{isOnline(selectedThread.contactId) ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
              <button type="button" className="chat-window__unread" onClick={markSelectedRead} disabled={!isThreadUnread(selectedThread)}><MailOpen size={15} /> Đánh dấu đã đọc</button>
            </header>
            <div className="message-history" ref={messageHistoryRef}>{selectedThread.messages.map((message, index) => <div className="message-history__group" key={message.id}>{messageNeedsDayDivider(message.createdAt, selectedThread.messages[index - 1]?.createdAt) && <div className="message-day-divider"><span>{formatMessageDayDivider(message.createdAt)}</span></div>}<article className={`chat-bubble ${message.senderId === user?.id || (!message.senderId && message.studentId === user?.id) ? 'is-own' : ''} ${highlightedMessageId === message.id ? 'is-highlighted' : ''}`} ref={(node) => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id); }} onMouseLeave={() => setOpenMessageMenu((current) => current === message.id ? null : current)} onTouchStart={() => startLongPress(message.id)} onTouchEnd={clearLongPress} onTouchCancel={clearLongPress} onTouchMove={clearLongPress}>{message.forwarded && <small className="chat-bubble__forwarded">Đã chuyển tiếp</small>}{message.replyTo && <button type="button" className="chat-bubble__quote" onClick={() => scrollToOriginalMessage(message.replyTo.id)} aria-label="Xem tin nhắn gốc"><strong>{message.replyTo.senderName}</strong><span>{message.replyTo.text}</span></button>}<p>{message.text}</p><div className="chat-bubble__meta"><time>{formatMessageTime(message.createdAt)}</time><div className="chat-bubble__menu-wrap"><button type="button" className="chat-bubble__more" onClick={() => setOpenMessageMenu((current) => current === message.id ? null : message.id)} aria-label="Thao tác tin nhắn"><MoreHorizontal size={17} /></button>{openMessageMenu === message.id && <div className="chat-bubble__menu"><button type="button" onClick={() => { setReplyingTo(message); setOpenMessageMenu(null); }}><Reply size={14} /> Trả lời</button><button type="button" onClick={() => { setForwarding(message); setOpenMessageMenu(null); }}><Forward size={14} /> Chuyển tiếp</button></div>}</div></div><span className="chat-bubble__timestamp">{formatMessageTimestamp(message.createdAt)}</span></article></div>)}</div>
            {showTagCreator && <section className="chat-tag-creator"><form onSubmit={addTag}><label>Tạo thẻ mới<span className="tag-name-input"><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value.slice(0, 25))} placeholder="Ví dụ: Cần tư vấn" maxLength="25" aria-describedby="tag-character-count" autoFocus /><small id="tag-character-count" className={tagDraft.length >= 25 ? 'is-limit' : ''}>{tagDraft.length}/25</small></span></label><fieldset><span className="tag-color-picker">{TAG_COLORS.map((color) => <button type="button" key={color.id} className={tagColor === color.value ? 'is-active' : ''} style={{ '--tag-color': color.value }} onClick={() => setTagColor(color.value)} aria-label={`Chọn màu ${color.label}`} />)}</span></fieldset><button type="submit" disabled={!tagDraft.trim()}>Tạo và gắn thẻ</button></form>{tagNotice && <p className="chat-tag-creator__notice">{tagNotice}</p>}{allTags.length > 0 && <div className="chat-tag-creator__library"><span>Thẻ đã tạo</span><div>{allTags.map((tag) => <span key={tag.id} style={{ '--tag-color': tag.color }}>{tag.name}<button type="button" onClick={() => deleteTag(tag.id)} aria-label={`Xóa thẻ ${tag.name}`} title={`Xóa thẻ ${tag.name}`}><X size={12} /></button></span>)}</div></div>}</section>}
            <nav className="chat-tag-bar" aria-label="Gắn thẻ"><span><Tag size={14} /> Gắn thẻ</span><div>{allTags.length ? allTags.map((tag) => { const isApplied = getThreadTags(selectedThread).some((item) => item.id === tag.id); return <button type="button" key={tag.id} className={isApplied ? 'is-applied' : ''} style={{ '--tag-color': tag.color }} onClick={() => toggleTag(tag)} aria-pressed={isApplied} title={isApplied ? `Bỏ thẻ ${tag.name}` : `Gắn thẻ ${tag.name}`}>{tag.name}{isApplied && <X size={12} />}</button>; }) : <small>Chưa có thẻ</small>}</div><button type="button" className="chat-tag-bar__create" onClick={() => setShowTagCreator((value) => !value)}><Plus size={14} /> {showTagCreator ? 'Đóng' : 'Tạo thẻ'}</button></nav>
            <form className="chat-composer" onSubmit={send}>
              {replyingTo && <div className="chat-composer__reply"><span>Đang trả lời: {replyingTo.text}</span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời"><X size={15} /></button></div>}
              {showTemplatePanel && <section className="message-template-panel" aria-label="Tin nhắn mẫu">
                <header><div><FileText size={16} /><strong>Tin nhắn mẫu</strong></div><button type="button" onClick={() => { setShowTemplatePanel(false); resetTemplateEditor(); }} aria-label="Đóng tin nhắn mẫu"><X size={16} /></button></header>
                {isTemplateEditorOpen ? <div className="message-template-editor"><label><span>Tên mẫu</span><input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value.slice(0, 50))} placeholder="Ví dụ: Lời chào học viên" maxLength={50} autoFocus /></label><label><span>Nội dung</span><textarea value={templateText} onChange={(event) => setTemplateText(event.target.value.slice(0, 1000))} placeholder="Nhập nội dung muốn dùng lại..." rows={12} maxLength={1000} /></label>{templateNotice && <p role="alert">{templateNotice}</p>}<div><button type="button" onClick={resetTemplateEditor}>Hủy</button><button type="button" className="message-template-editor__save" onClick={saveTemplate}>{editingTemplateId ? 'Lưu thay đổi' : 'Lưu tin nhắn mẫu'}</button></div></div> : <><label className="message-template-search"><Search size={15} /><input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Tìm tin nhắn mẫu" type="search" /></label><div className="message-template-list">{filteredMessageTemplates.length ? filteredMessageTemplates.map((template) => <article key={template.id}><button type="button" className="message-template-list__use" onClick={() => insertTemplate(template)}><strong>{template.title}</strong><span>{template.text}</span></button><div><button type="button" onClick={() => openTemplateEditor(template)} aria-label={`Chỉnh sửa mẫu ${template.title}`}><Pencil size={14} /></button><button type="button" onClick={() => removeTemplate(template.id)} aria-label={`Xóa mẫu ${template.title}`}><Trash2 size={14} /></button></div></article>) : <p className="message-template-panel__empty">{messageTemplates.length ? 'Không tìm thấy tin nhắn mẫu phù hợp.' : 'Chưa có tin nhắn mẫu nào.'}</p>}</div><button type="button" className="message-template-panel__create" onClick={() => openTemplateEditor()}><Plus size={15} /> Tạo tin nhắn mẫu</button></>}
              </section>}
              <div className="chat-composer__row"><button type="button" className={`chat-composer__templates ${showTemplatePanel ? 'is-active' : ''}`} onClick={() => { setShowTemplatePanel((current) => !current); if (showTemplatePanel) resetTemplateEditor(); }} aria-expanded={showTemplatePanel}><BookmarkPlus size={17} /><span>Tin nhắn mẫu</span></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder="Soạn tin nhắn" rows="1" /><button type="submit" aria-label="Gửi tin nhắn"><Send size={18} /></button></div>
            </form>
            {forwarding && <div className="chat-forward" role="dialog" aria-modal="true" aria-label="Chuyển tiếp tin nhắn"><div className="chat-forward__panel"><header><strong>Chuyển tiếp tin nhắn</strong><button type="button" onClick={() => setForwarding(null)} aria-label="Đóng"><X size={17} /></button></header><p>{forwarding.text}</p><span>Chọn người đã từng nhắn tin</span><div>{threads.filter((thread) => thread.key !== selectedThread.key).length ? threads.filter((thread) => thread.key !== selectedThread.key).map((thread) => <button type="button" key={thread.key} onClick={() => forwardMessage(thread)}>{thread.contactName}</button>) : <small>Chưa có cuộc trò chuyện khác để chuyển tiếp.</small>}</div></div></div>}
          </> : <div className="chat-window__empty"><span><MessageCircle size={32} /></span><h2>Bắt đầu một cuộc trò chuyện</h2><p>Khi bạn đăng ký học một khóa học, lời nhắn sẽ xuất hiện tại đây.</p></div>}
        </main>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Forward, Minus, Reply, Search, Send, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ROUTES } from '@/constants/routes';
import { createConversationId, getCourse, getConversationsForUser, getMessageTemplates, saveConversation } from '@/features/learning/marketplace';
import { conversationThreadKey, getChatWidgets, setChatWidget, updateChatWidget } from '@/features/learning/chatWidget';
import { formatMessageDayDivider, formatMessageTime, formatMessageTimestamp, messageNeedsDayDivider } from '@/utils/messageTime';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import './floating-chat.css';

function FloatingChatWindow({ user, widget, messages }) {
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState(() => getMessageTemplates(user?.id));
  const [templateQuery, setTemplateQuery] = useState('');
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const historyRef = useRef(null);
  const messageRefs = useRef(new Map());
  const replyHighlightTimer = useRef(null);
  const previousMessageCount = useRef(0);
  const forceScrollToBottom = useRef(true);
  const threadMessages = messages.filter((message) => conversationThreadKey(message) === widget.threadKey).reverse();
  const reference = threadMessages[0];
  const course = reference ? getCourse(reference.courseId) : null;
  const isTeacher = reference?.teacherId === user?.id;
  const contactName = isTeacher ? reference?.studentName || 'Học viên EduMatch' : reference?.teacherName || course?.teacher?.name || 'Giáo viên EduMatch';
  const contactAvatar = isTeacher ? reference?.studentAvatar || '' : reference?.teacherAvatar || course?.teacher?.avatar || '';
  const contactRole = isTeacher ? 'student' : course?.teacher?.role || 'teacher';

  useEffect(() => {
    const history = historyRef.current;
    if (!history || !threadMessages.length) return;
    const hadMessages = previousMessageCount.current > 0;
    const isNearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 36;
    if (forceScrollToBottom.current || !hadMessages || isNearBottom) {
      history.scrollTop = history.scrollHeight;
      setShowNewMessages(false);
    } else if (threadMessages.length > previousMessageCount.current) setShowNewMessages(true);
    previousMessageCount.current = threadMessages.length;
    forceScrollToBottom.current = false;
  }, [threadMessages.length, widget.threadKey]);

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
  if (!reference) return null;

  const minimize = () => updateChatWidget(user.id, widget.threadKey, { isMinimized: !widget.isMinimized });
  const close = () => updateChatWidget(user.id, widget.threadKey, { isClosed: true });
  const scrollToLatest = () => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    setShowNewMessages(false);
  };
  const scrollToOriginalMessage = (messageId) => {
    const target = messageRefs.current.get(messageId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.clearTimeout(replyHighlightTimer.current);
    replyHighlightTimer.current = window.setTimeout(() => setHighlightedMessageId(null), 1400);
  };
  const send = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    saveConversation({
      id: createConversationId('floating-message'), courseId: reference.courseId, teacherId: reference.teacherId,
      teacherName: reference.teacherName || course?.teacher?.name || 'Giáo viên EduMatch', teacherAvatar: reference.teacherAvatar || course?.teacher?.avatar || '',
      studentId: reference.studentId, studentName: reference.studentName || 'Học viên EduMatch', studentAvatar: reference.studentAvatar || '', senderId: user.id,
      text: draft.trim(), replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderId === user.id ? 'Bạn' : contactName } : null,
      createdAt: new Date().toISOString(),
    });
    setDraft(''); setReplyingTo(null); forceScrollToBottom.current = true;
  };
  const forwardTargets = [...new Map(messages.filter((message) => conversationThreadKey(message) !== widget.threadKey).map((message) => [conversationThreadKey(message), message])).values()];
  const forwardMessage = (target) => {
    if (!forwarding) return;
    saveConversation({
      id: createConversationId('forwarded-message'), courseId: target.courseId, teacherId: target.teacherId, teacherName: target.teacherName,
      teacherAvatar: target.teacherAvatar || getCourse(target.courseId)?.teacher?.avatar || '', studentId: target.studentId, studentName: target.studentName,
      studentAvatar: target.studentAvatar || '', senderId: user.id, text: forwarding.text, forwarded: true,
      forwardedFrom: forwarding.senderId === user.id ? 'Bạn' : contactName, createdAt: new Date().toISOString(),
    });
    setForwarding(null);
  };
  const insertTemplate = (template) => {
    setDraft((current) => current.trim() ? `${current}${current.endsWith('\n') ? '' : '\n'}${template.text}` : template.text);
    setShowTemplates(false);
  };
  const filteredMessageTemplates = messageTemplates.filter((template) => `${template.title} ${template.text}`.toLocaleLowerCase('vi').includes(templateQuery.trim().toLocaleLowerCase('vi')));

  if (widget.isMinimized) return <div className="floating-chat__minimized-item"><button type="button" className="floating-chat__minimized" onClick={minimize} aria-label={`Mở chat với ${contactName}`}><span className="floating-chat__minimized-avatar">{contactAvatar ? <img src={contactAvatar} alt="" /> : <DefaultRoleAvatar role={contactRole} size={17} />}</span></button><button type="button" className="floating-chat__minimized-close" onClick={close} aria-label={`Đóng chat với ${contactName}`}><X size={14} /></button></div>;

  return <aside className="floating-chat" aria-label={`Cửa sổ chat với ${contactName}`}>
    <header className="floating-chat__head"><span>{contactAvatar ? <img src={contactAvatar} alt="" /> : <DefaultRoleAvatar role={contactRole} size={18} />}</span><div><strong>{contactName}</strong>{course?.title && <small>{course.title}</small>}</div><button type="button" onClick={minimize} aria-label="Thu nhỏ cửa sổ chat"><Minus size={16} /></button><button type="button" onClick={close} aria-label="Đóng cửa sổ chat"><X size={17} /></button></header>
    <div className="floating-chat__history" ref={historyRef} onScroll={() => { const history = historyRef.current; if (history && history.scrollHeight - history.scrollTop - history.clientHeight < 36) setShowNewMessages(false); }}>{threadMessages.map((message, index) => <div className="floating-chat__message-group" key={message.id}>{messageNeedsDayDivider(message.createdAt, threadMessages[index - 1]?.createdAt) && <div className="floating-chat__day-divider"><span>{formatMessageDayDivider(message.createdAt)}</span></div>}<article className={`${message.senderId === user.id || (!message.senderId && message.studentId === user.id) ? 'is-own' : ''} ${highlightedMessageId === message.id ? 'is-highlighted' : ''}`} ref={(node) => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id); }}>{message.forwarded && <span className="floating-chat__forwarded">Đã chuyển tiếp</span>}{message.replyTo && <button type="button" className="floating-chat__reply-preview" onClick={() => scrollToOriginalMessage(message.replyTo.id)} aria-label="Xem tin nhắn gốc"><strong>{message.replyTo.senderName}</strong><span>{message.replyTo.text}</span></button>}<p>{message.text}</p><div className="floating-chat__message-meta"><time>{formatMessageTime(message.createdAt)}</time><span className="floating-chat__message-actions"><button type="button" onClick={() => setReplyingTo(message)} aria-label="Trả lời tin nhắn"><Reply size={13} /></button><button type="button" onClick={() => setForwarding(message)} aria-label="Chuyển tiếp tin nhắn"><Forward size={13} /></button></span></div><span className="floating-chat__timestamp">{formatMessageTimestamp(message.createdAt)}</span></article></div>)}</div>
    {showNewMessages && <button type="button" className="floating-chat__new-message" onClick={scrollToLatest}>Xem tin nhắn mới nhất</button>}
    <form className="floating-chat__composer" onSubmit={send}>{replyingTo && <div className="floating-chat__replying"><span>Đang trả lời: {replyingTo.text}</span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời"><X size={14} /></button></div>}{showTemplates && <section className="floating-chat__template-menu" aria-label="Tin nhắn mẫu"><header><span>Tin nhắn mẫu</span><button type="button" onClick={() => setShowTemplates(false)} aria-label="Đóng tin nhắn mẫu"><X size={14} /></button></header><label className="floating-chat__template-search"><Search size={14} /><input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Tìm tin nhắn mẫu" type="search" aria-label="Tìm tin nhắn mẫu" /></label><div>{filteredMessageTemplates.length ? filteredMessageTemplates.map((template) => <button type="button" key={template.id} onClick={() => insertTemplate(template)}><strong>{template.title}</strong><span>{template.text}</span></button>) : <small>{messageTemplates.length ? 'Không tìm thấy tin nhắn mẫu phù hợp.' : 'Chưa có tin nhắn mẫu nào.'}</small>}</div></section>}<div><button type="button" className={`floating-chat__template-toggle ${showTemplates ? 'is-active' : ''}`} onClick={() => setShowTemplates((current) => !current)} aria-label="Chọn tin nhắn mẫu" aria-expanded={showTemplates}><BookmarkPlus size={17} /></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={submitOnPlainEnter} rows="1" placeholder="Viết tin nhắn..." /><button type="submit" aria-label="Gửi tin nhắn"><Send size={17} /></button></div></form>
    {forwarding && <div className="floating-chat__forward-dialog" role="dialog" aria-modal="true" aria-label="Chuyển tiếp tin nhắn"><div><header><strong>Chuyển tiếp tin nhắn</strong><button type="button" onClick={() => setForwarding(null)} aria-label="Đóng"><X size={17} /></button></header><p>{forwarding.text}</p><span>Chọn người đã từng nhắn tin</span><section>{forwardTargets.length ? forwardTargets.map((target) => <button type="button" key={conversationThreadKey(target)} onClick={() => forwardMessage(target)}>{target.teacherId === user.id ? target.studentName || 'Học viên EduMatch' : target.teacherName || 'Giáo viên EduMatch'}</button>) : <small>Chưa có cuộc trò chuyện khác để chuyển tiếp.</small>}</section></div></div>}
  </aside>;
}

export function FloatingChat() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [, setRevision] = useState(0);
  const seenIncomingMessageIds = useRef(null);
  const messages = getConversationsForUser(user?.id);
  const widgets = getChatWidgets(user?.id).filter((widget) => !widget.isClosed);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('edumatch:chat-widget-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('edumatch:chat-widget-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    const incoming = messages.filter((message) => message.senderId && message.senderId !== user.id);
    const incomingIds = new Set(incoming.map((message) => message.id));
    if (seenIncomingMessageIds.current === null) { seenIncomingMessageIds.current = incomingIds; return; }
    const newestIncoming = incoming.find((message) => !seenIncomingMessageIds.current.has(message.id));
    seenIncomingMessageIds.current = incomingIds;
    if (newestIncoming) setChatWidget(user.id, conversationThreadKey(newestIncoming), { isClosed: false, isMinimized: false });
  }, [messages, user?.id]);

  if (!user || pathname === ROUTES.MESSAGES || !widgets.length) return null;
  const openedWidgets = widgets.filter((widget) => !widget.isMinimized);
  const minimizedWidgets = widgets.filter((widget) => widget.isMinimized);
  return <div className="floating-chat-layer"><div className="floating-chat-layer__open">{openedWidgets.map((widget) => <FloatingChatWindow key={widget.threadKey} user={user} widget={widget} messages={messages} />)}</div><div className="floating-chat-layer__minimized">{minimizedWidgets.map((widget) => <FloatingChatWindow key={widget.threadKey} user={user} widget={widget} messages={messages} />)}</div></div>;
}

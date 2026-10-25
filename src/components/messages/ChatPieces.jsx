import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock3, Download, FileText, Image, Paperclip, Send, Smile, Sigma, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { chatService, chatError, CHAT_FILE_ACCEPT, CHAT_REACTIONS } from '@/services/chatService';
import { chatDay, chatTime } from '@/utils/chatState';
import { Modal } from '@/components/feedback/Modal';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
const MathFormula = lazy(() => import('./MathFormula'));

export function ChatAvatar({ person, group = false, large = false }) {
  const { online, presenceReady } = useChat();
  return <span className={`em-avatar ${large ? 'em-avatar--large' : ''} ${group ? 'em-avatar--group' : ''}`}>
    {group ? <Users size={25}/> : person?.avatar_url ? <img src={person.avatar_url} alt={`Ảnh ${person.name}`} loading="lazy"/> : <span className="em-avatar__initial">{person?.name?.slice(0, 1)?.toUpperCase() || '?'}</span>}
    {!group && presenceReady && online.has(String(person?.id)) && <i aria-label="Đang hoạt động"/>}
  </span>;
}

export function ChatIcon({ label, children, ...props }) {
  return <button type="button" className="em-icon" title={label} aria-label={label} {...props}>{children}</button>;
}

export function ChatAttachmentView({ attachment, compact = false, onPreview }) {
  const containerRef = useRef(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const image = attachment.is_image;
  useEffect(() => {
    if (!image) return;
    let active = true;
    let objectUrl;
    const load = async () => {
      try {
        const blob = await chatService.attachment(attachment.id, true);
        if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      } catch { if (active) setError(true); }
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); void load(); }
    }, { rootMargin: '160px' });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.id, image]);
  const download = async () => {
    try {
      const blob = await chatService.attachment(attachment.id);
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl; link.download = attachment.file_name; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (failure) { toast.error(chatError(failure)); }
  };
  if (image) return <button type="button" ref={containerRef} className={`em-real-image ${compact ? 'is-compact' : ''}`} onClick={() => url && onPreview?.({ url, name: attachment.file_name })} aria-label={`Xem ảnh ${attachment.file_name}`}>
    {url ? <img src={url} alt={attachment.file_name}/> : <span>{error ? 'Không tải được ảnh' : 'Đang tải ảnh...'}</span>}
  </button>;
  return <button type="button" className="em-file" onClick={download}><FileText size={23}/><span><strong>{attachment.file_name}</strong><small>{Math.max(1, Math.ceil(attachment.file_size / 1024))} KB</small></span><Download size={17}/></button>;
}

export function ChatHistory({ thread, onPreview, compact = false }) {
  const { user } = useAuth();
  const historyRef = useRef(null);
  const contentRef = useRef(null);
  const pinned = useRef(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const { messages, receipts, detail, hasOlder, loadOlder, react, retryMessage, typingIds } = thread;
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (last?.pending && Number(last.sender_user_id) === Number(user.id)) pinned.current = true;
    if (pinned.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [last?.id, last?.pending, last?.sender_user_id, user.id, messages.length, typingIds.length]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (pinned.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    });
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);
  const older = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    const element = historyRef.current;
    const previousHeight = element?.scrollHeight || 0;
    pinned.current = false;
    thread.setAtEnd(false);
    await loadOlder();
    requestAnimationFrame(() => { if (element?.isConnected) element.scrollTop += element.scrollHeight - previousHeight; });
    setLoadingOlder(false);
  };
  return <div className={`em-history ${compact ? 'em-history--compact' : ''}`} ref={historyRef} role="log" aria-label="Nội dung trò chuyện" onScroll={(event) => { const el = event.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; thread.setAtEnd(pinned.current); }}>
    <div className="em-history__content" ref={contentRef}>
    {hasOlder && <button type="button" className="em-load-more" onClick={older} disabled={loadingOlder}>{loadingOlder ? 'Đang tải...' : 'Tải tin nhắn trước'}</button>}
    {!messages.length && !thread.loading && <div className="em-empty"><h3>Bắt đầu cuộc trò chuyện</h3><p>Gửi một lời chào hoặc chia sẻ tài liệu học tập.</p></div>}
    {messages.map((message, index) => {
      const own = Number(message.sender_user_id) === Number(user.id);
      const otherMembers = detail?.participants?.filter((member) => Number(member.id) !== Number(user.id)) || [];
      const read = typeof message.id === 'number' && otherMembers.length > 0 && otherMembers.every((member) => Number(receipts[member.id] || 0) >= message.id);
      const day = chatDay(message.sent_at);
      return <Fragment key={message.client_id || message.id}>
        {(!index || day !== chatDay(messages[index - 1].sent_at)) && <div className="em-day">{day}</div>}
        <article className={`em-message ${own ? 'em-message--own' : ''}`}>
          {!own && <ChatAvatar person={message.sender}/>}
          <div className="em-message__body">
            {detail?.type === 'group' && !own && <small>{message.sender?.name}</small>}
            {message.metadata?.reply_to_id && <small>Trả lời tin nhắn #{message.metadata.reply_to_id}</small>}
            {message.body && <div className="em-bubble">{message.body}</div>}
            {message.metadata?.formula && <Suspense fallback={<pre>{message.metadata.formula}</pre>}><MathFormula formula={message.metadata.formula}/></Suspense>}
            {message.attachments?.map((attachment) => <ChatAttachmentView key={attachment.id} attachment={attachment} onPreview={onPreview}/>)}
            <div className="em-message__foot">
              {message.reactions?.map((reaction) => <button type="button" key={reaction.emoji} className={`em-reaction ${reaction.user_ids.includes(Number(user.id)) ? 'is-active' : ''}`} aria-label={`Cảm xúc ${reaction.emoji}, ${reaction.count} người`} onClick={() => void react(message, reaction.emoji)}>{reaction.emoji} <span>{reaction.count}</span></button>)}
              <time dateTime={message.sent_at}>{chatTime(message.sent_at)}</time>
              {own && <span className={`em-delivery ${read ? 'is-read' : ''}`} title={message.failed ? 'Gửi chưa thành công' : message.pending ? 'Đang gửi' : read ? 'Đã xem' : 'Đã gửi'} aria-label={message.failed ? 'Gửi chưa thành công' : message.pending ? 'Đang gửi' : read ? 'Đã xem' : 'Đã gửi'}>{message.pending ? <Clock3 size={14}/> : read ? <CheckCheck size={14}/> : <Check size={14}/>}</span>}
              {message.failed && <button type="button" className="em-retry" onClick={() => void retryMessage(message).catch(() => {})}>Thử gửi lại</button>}
            </div>
            {typeof message.id === 'number' && <div className="em-reaction-picker" aria-label="Thả cảm xúc tin nhắn">{CHAT_REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => void react(message, emoji)} aria-label={`Thả cảm xúc ${emoji}`}>{emoji}</button>)}</div>}
          </div>
        </article>
      </Fragment>;
    })}
    {typingIds.length > 0 && <p className="em-typing" role="status">{detail?.participants?.find((member) => Number(member.id) === typingIds[0])?.name || 'Đối phương'} đang soạn tin nhắn...</p>}
    </div>
  </div>;
}

function PendingFile({ file, remove }) {
  const imageRef = useRef(null);
  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const value = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = value;
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return <div className="em-pending">{file.type.startsWith('image/') && <img ref={imageRef} alt={file.name}/>}<Paperclip size={16}/><span>{file.name} · {Math.ceil(file.size / 1024)} KB</span><ChatIcon label={`Bỏ ${file.name}`} onClick={remove}><X size={15}/></ChatIcon></div>;
}

export function ChatComposer({ thread, theme = 'light' }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formula, setFormula] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const chooseFiles = (event) => {
    const selected = [...event.target.files]; event.target.value = '';
    if (files.length + selected.length > 3) { toast.error('Mỗi tin nhắn tối đa 3 tệp.'); return; }
    if (selected.some((file) => file.size > 10485760)) { toast.error('Mỗi tệp tối đa 10 MB.'); return; }
    setFiles((current) => [...current, ...selected]);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sendingRef.current || (!body.trim() && !files.length && !formula.trim())) return;
    const payload = { body: body.trim(), files, metadata: formula.trim() ? { math: true, formula: formula.trim() } : undefined };
    sendingRef.current = true; setSending(true);
    setBody(''); setFiles([]); setFormula(''); setFormulaOpen(false); setEmojiOpen(false);
    try {
      const response = await thread.send(payload);
      if (response.realtime_published === false) toast('Tin nhắn đã lưu. Realtime đang gián đoạn; đối phương có thể cần mở lại hội thoại.');
    } catch { /* The failed optimistic message retains a retry action. */ }
    finally { sendingRef.current = false; setSending(false); }
  };
  return <form className="em-composer" onSubmit={submit}>
    {files.map((file, index) => <PendingFile key={`${file.name}:${file.lastModified}:${index}`} file={file} remove={() => setFiles((current) => current.filter((_, position) => position !== index))}/>)}
    {formulaOpen && <label className="em-formula-input">Công thức LaTeX<textarea aria-label="Công thức LaTeX" value={formula} onChange={(event) => setFormula(event.target.value)} maxLength={4000} placeholder={'Ví dụ: \\int x^2 dx = \\frac{x^3}{3} + C'}/></label>}
    <div className="em-composer__row"><div className="em-composer__field">
      <div className="em-emoji-anchor"><ChatIcon label="Chọn biểu tượng cảm xúc" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((value) => !value)}><Smile size={21}/></ChatIcon>
        {emojiOpen && <div className="em-emoji-panel"><Suspense fallback={<p>Đang tải biểu tượng...</p>}><EmojiPicker width="100%" height={350} theme={theme} searchPlaceHolder="Tìm biểu tượng..." previewConfig={{showPreview:false}} onEmojiClick={(emoji) => { setBody((value) => value + emoji.emoji); inputRef.current?.focus(); }}/></Suspense></div>}
      </div>
      <textarea ref={inputRef} aria-label="Nhập tin nhắn" placeholder="Nhập tin nhắn của bạn..." rows={1} maxLength={4000} value={body} onChange={(event) => { setBody(event.target.value); thread.sendTyping(); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) void submit(event); }}/>
      <ChatIcon label="Chọn ảnh" onClick={() => { fileRef.current.accept = '.jpg,.jpeg,.png,.webp,.gif'; fileRef.current.click(); }}><Image size={20}/></ChatIcon>
      <ChatIcon label="Đính kèm tệp" onClick={() => { fileRef.current.accept = CHAT_FILE_ACCEPT; fileRef.current.click(); }}><Paperclip size={20}/></ChatIcon>
      <ChatIcon label="Soạn công thức" aria-expanded={formulaOpen} onClick={() => setFormulaOpen((value) => !value)}><Sigma size={19}/></ChatIcon>
      <input type="file" hidden ref={fileRef} multiple accept={CHAT_FILE_ACCEPT} onChange={chooseFiles}/>
    </div><button className="em-send" type="submit" disabled={sending || (!body.trim() && !files.length && !formula.trim())} aria-label="Gửi tin nhắn"><Send size={20}/></button></div>
    {/* <p className="em-composer__hint">Enter để gửi · Shift+Enter xuống dòng · Tối đa 3 tệp, mỗi tệp 10 MB</p> */}
  </form>;
}

export function PrivateChatNote({ conversationId, initialNotes = '' }) {
  const { token } = useAuth();
  const noteSession = useRef(token);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState('saved');
  const latest = useRef(initialNotes);
  const saved = useRef(initialNotes);
  const submitted = useRef(initialNotes);
  const retrySave = async () => {
    const value = latest.current;
    submitted.current = value; setStatus('saving');
    try { await chatService.saveNote(conversationId, value, noteSession.current); saved.current = value; if (latest.current === value) setStatus('saved'); }
    catch { setStatus('error'); }
  };
  useEffect(() => {
    latest.current = notes;
    if (notes === saved.current) return;
    let active = true;
    const timer = setTimeout(() => {
      submitted.current = notes;
      setStatus('saving');
      chatService.saveNote(conversationId, notes, noteSession.current).then(() => { saved.current = notes; if (active) setStatus('saved'); })
        .catch(() => { if (active) setStatus('error'); });
    }, 800);
    return () => { active = false; clearTimeout(timer); };
  }, [notes, conversationId]);
  useEffect(() => () => {
    if (latest.current !== saved.current && latest.current !== submitted.current) void chatService.saveNote(conversationId, latest.current, noteSession.current).catch(() => {});
  }, [conversationId]);
  return <section className="em-detail-section em-notes"><h3>Ghi chú cá nhân</h3><label><FileText size={18}/><textarea aria-label="Ghi chú về người học" placeholder="Chỉ bạn xem được ghi chú này..." rows={3} maxLength={10000} value={notes} onChange={(event) => { setNotes(event.target.value); setStatus('dirty'); }}/></label>
    <small role="status">{({saved:'Đã lưu · Chỉ mình bạn',saving:'Đang lưu...',dirty:'Đang chờ lưu...',error:'Chưa lưu được ghi chú.'})[status]}</small>{status === 'error' && <button type="button" onClick={() => void retrySave()}>Thử lưu lại</button>}
  </section>;
}

export function ChatLightbox({ image, onClose }) {
  return <Modal open={Boolean(image)} onClose={onClose} title={image?.name || 'Ảnh đã chia sẻ'} size="xl">{image && <img src={image.url} alt={image.name} className="em-lightbox-image"/>}</Modal>;
}

import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock3, Download, FileText, Image, Paperclip, Send, Smile, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { chatService, chatError, chatAvatarUrl, CHAT_FILE_ACCEPT, CHAT_REACTIONS } from '@/services/chatService';
import { chatDay, chatTime } from '@/utils/chatState';
import { STICKER_PACKS } from '@/constants/stickers';
import { ChatLoading } from './ChatLoading';
import { EmojiPickerBoundary } from './EmojiPickerBoundary';
import { Modal } from '@/components/feedback/Modal';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export function ZaloStickerIcon({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="3.5" />
      <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" />
      <path d="M8.5 14.2c.9 1.1 2.2 1.8 3.5 1.8s2.6-.7 3.5-1.8" />
      <path d="M12 16c0 1.2.9 2 2 2s2-.8 2-2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChatAvatar({ person, group = false, large = false }) {
  const { online, presenceReady } = useChat();
  const source = chatAvatarUrl(person?.avatar_url || person?.avatar);
  const [failedSource, setFailedSource] = useState(null);
  return <span className={`em-avatar ${large ? 'em-avatar--large' : ''} ${group ? 'em-avatar--group' : ''}`}>
    {group ? <Users size={25}/> : source && failedSource !== source ? <img key={source} src={source} alt={`Ảnh ${person.name}`} loading="lazy" decoding="async" onError={() => setFailedSource(source)}/> : <span className="em-avatar__initial">{person?.name?.slice(0, 1)?.toUpperCase() || '?'}</span>}
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
    {url ? <img src={url} alt={attachment.file_name}/> : <span className={`em-image-placeholder ${error ? 'is-error' : 'em-skeleton'}`}><Image size={20}/><span className={error ? '' : 'sr-only'}>{error ? 'Không tải được ảnh' : 'Đang tải ảnh...'}</span></span>}
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
  return <div className={`em-history ${compact ? 'em-history--compact' : ''}`} ref={historyRef} role="log" aria-label="Nội dung trò chuyện" aria-busy={thread.loading} onScroll={(event) => { const el = event.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; thread.setAtEnd(pinned.current); }}>
    <div className="em-history__content" ref={contentRef}>
    {thread.loading && !messages.length && <ChatLoading variant="messages"/>}
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
            {message.metadata?.sticker ? (
              <div className="em-sticker-msg" aria-label={`Nhãn dán: ${message.metadata.sticker.name}`}>
                <div className="em-sticker-art">
                  <span className="em-sticker-art__emoji">{message.metadata.sticker.emoji}</span>
                  <span className="em-sticker-art__text">{message.metadata.sticker.text || message.metadata.sticker.name}</span>
                </div>
              </div>
            ) : (
              message.body && <div className="em-bubble">{message.body}</div>
            )}
            {message.metadata?.formula && <pre className="em-formula">{message.metadata.formula}</pre>}
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
  const [stickerOpen, setStickerOpen] = useState(false);
  const [activePack, setActivePack] = useState('cute');
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
    if (sendingRef.current || (!body.trim() && !files.length)) return;
    const payload = { body: body.trim(), files };
    sendingRef.current = true; setSending(true);
    setBody(''); setFiles([]); setEmojiOpen(false); setStickerOpen(false);
    try {
      const response = await thread.send(payload);
      if (response.realtime_published === false) toast('Tin nhắn đã lưu. Realtime đang gián đoạn; đối phương có thể cần mở lại hội thoại.');
    } catch { /* The failed optimistic message retains a retry action. */ }
    finally { sendingRef.current = false; setSending(false); }
  };

  const submitSticker = async (sticker) => {
    setStickerOpen(false);
    if (sendingRef.current) return;
    const payload = {
      body: `[Nhãn dán: ${sticker.name}]`,
      metadata: {
        sticker: {
          id: sticker.id,
          name: sticker.name,
          emoji: sticker.emoji,
          text: sticker.text,
          category: activePack,
        },
      },
    };
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await thread.send(payload);
      if (response?.realtime_published === false) {
        toast('Nhãn dán đã lưu. Realtime đang gián đoạn; đối phương có thể cần mở lại hội thoại.');
      }
    } catch { /* Retries preserved */ }
    finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return <form className="em-composer" onSubmit={submit}>
    {files.map((file, index) => <PendingFile key={`${file.name}:${file.lastModified}:${index}`} file={file} remove={() => setFiles((current) => current.filter((_, position) => position !== index))}/>)}
    <div className="em-composer__row"><div className="em-composer__field">
      <div className="em-emoji-anchor"><ChatIcon label="Chọn biểu tượng cảm xúc" aria-expanded={emojiOpen} onClick={() => { setEmojiOpen((value) => !value); setStickerOpen(false); }}><Smile size={21}/></ChatIcon>
        {emojiOpen && <div className="em-emoji-panel"><EmojiPickerBoundary onClose={() => setEmojiOpen(false)}><Suspense fallback={<p>Đang tải biểu tượng...</p>}><EmojiPicker width="100%" height={350} theme={theme} searchPlaceHolder="Tìm biểu tượng..." previewConfig={{showPreview:false}} onEmojiClick={(emoji) => { setBody((value) => value + emoji.emoji); inputRef.current?.focus(); }}/></Suspense></EmojiPickerBoundary></div>}
      </div>
      <textarea ref={inputRef} aria-label="Nhập tin nhắn" placeholder="Nhập tin nhắn của bạn..." rows={1} maxLength={4000} value={body} onChange={(event) => { setBody(event.target.value); thread.sendTyping(); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) void submit(event); }}/>
      <div className="em-sticker-anchor">
        <ChatIcon label="Gửi nhãn dán" aria-expanded={stickerOpen} onClick={() => { setStickerOpen((value) => !value); setEmojiOpen(false); }}>
          <ZaloStickerIcon size={20}/>
        </ChatIcon>
        {stickerOpen && (
          <div className="em-sticker-panel">
            <div className="em-sticker-tabs">
              {STICKER_PACKS.map((pack) => (
                <button
                  type="button"
                  key={pack.id}
                  className={`em-sticker-tab ${activePack === pack.id ? 'is-active' : ''}`}
                  onClick={() => setActivePack(pack.id)}
                >
                  <span>{pack.icon}</span> {pack.name}
                </button>
              ))}
            </div>
            <div className="em-sticker-grid">
              {STICKER_PACKS.find((p) => p.id === activePack)?.stickers.map((sticker) => (
                <button
                  type="button"
                  key={sticker.id}
                  className="em-sticker-item"
                  onClick={() => void submitSticker(sticker)}
                  title={sticker.name}
                >
                  <span className="em-sticker-item__emoji">{sticker.emoji}</span>
                  <span className="em-sticker-item__name">{sticker.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <ChatIcon label="Chọn ảnh" onClick={() => { fileRef.current.accept = '.jpg,.jpeg,.png,.webp,.gif'; fileRef.current.click(); }}><Image size={20}/></ChatIcon>
      <ChatIcon label="Đính kèm tệp" onClick={() => { fileRef.current.accept = CHAT_FILE_ACCEPT; fileRef.current.click(); }}><Paperclip size={20}/></ChatIcon>
      <input type="file" hidden ref={fileRef} multiple accept={CHAT_FILE_ACCEPT} onChange={chooseFiles}/>
    </div><button className="em-send" type="submit" disabled={sending || (!body.trim() && !files.length)} aria-label="Gửi tin nhắn"><Send size={20}/></button></div>
  </form>;
}

export function PrivateChatNote({ conversationId, initialNotes = '', onSaved }) {
  const savedCallback = useRef(onSaved);
  useEffect(() => { savedCallback.current = onSaved; });
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
    try { await chatService.saveNote(conversationId, value, noteSession.current); saved.current = value; savedCallback.current?.(value); if (latest.current === value) setStatus('saved'); }
    catch { setStatus('error'); }
  };
  useEffect(() => {
    latest.current = notes;
    if (notes === saved.current) return;
    let active = true;
    const timer = setTimeout(() => {
      submitted.current = notes;
      setStatus('saving');
      chatService.saveNote(conversationId, notes, noteSession.current).then(() => { saved.current = notes; savedCallback.current?.(notes); if (active) setStatus('saved'); })
        .catch(() => { if (active) setStatus('error'); });
    }, 800);
    return () => { active = false; clearTimeout(timer); };
  }, [notes, conversationId]);
  useEffect(() => () => {
    if (latest.current !== saved.current && latest.current !== submitted.current) { savedCallback.current?.(latest.current); void chatService.saveNote(conversationId, latest.current, noteSession.current).catch(() => {}); }
  }, [conversationId]);
  return <section className="em-detail-section em-notes"><h3>Ghi chú cá nhân</h3><label><FileText size={18}/><textarea aria-label="Ghi chú về người học" placeholder="Chỉ bạn xem được ghi chú này..." rows={3} maxLength={10000} value={notes} onChange={(event) => { setNotes(event.target.value); setStatus('dirty'); }}/></label>
    <small role="status">{({saved:'Đã lưu · Chỉ mình bạn',saving:'Đang lưu...',dirty:'Đang chờ lưu...',error:'Chưa lưu được ghi chú.'})[status]}</small>{status === 'error' && <button type="button" onClick={() => void retrySave()}>Thử lưu lại</button>}
  </section>;
}

export function ChatLightbox({ image, onClose }) {
  return <Modal open={Boolean(image)} onClose={onClose} title={image?.name || 'Ảnh đã chia sẻ'} size="xl">{image && <img src={image.url} alt={image.name} className="em-lightbox-image"/>}</Modal>;
}

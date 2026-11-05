import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Clock3, Download, FileText, Forward, Image, Paperclip, Reply, Send, Smile, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { chatService, chatError, chatAvatarUrl, CHAT_FILE_ACCEPT, CHAT_REACTIONS } from '@/services/chatService';
import { chatDay, chatTime } from '@/utils/chatState';
import { STICKER_PACKS } from '@/constants/stickers';
import { ChatLoading } from './ChatLoading';
import { EmojiPickerBoundary } from './EmojiPickerBoundary';
import { Modal } from '@/components/feedback/Modal';
import { DefaultRoleAvatar, resolveAvatarSource } from '@/components/common/DefaultRoleAvatar';

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
  const source = resolveAvatarSource(chatAvatarUrl(person?.avatar_url || person?.avatar), person?.id);
  const [failedSource, setFailedSource] = useState(null);
  return <span className={`em-avatar ${large ? 'em-avatar--large' : ''} ${group ? 'em-avatar--group' : ''}`}>
    {group ? <Users size={25}/> : source && failedSource !== source ? <img key={source} src={source} alt={`Ảnh ${person?.name || ''}`} loading="lazy" decoding="async" onError={() => setFailedSource(source)}/> : <DefaultRoleAvatar role={person?.role} name={person?.name} userId={person?.id} size={large ? 22 : 18} />}
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

export function ChatHistory({ thread, onPreview, compact = false, onReply, onForward }) {
  const { user } = useAuth();
  const historyRef = useRef(null);
  const contentRef = useRef(null);
  const pinned = useRef(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hoveredTime, setHoveredTime] = useState(null);
  const hoverTimeTimer = useRef(null);
  const messageRefs = useRef(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const replyHighlightTimer = useRef(null);
  const { messages, receipts, detail, hasOlder, loadOlder, react, retryMessage, typingIds } = thread;
  const last = messages[messages.length - 1];

  const allImageAttachments = useMemo(() => {
    const list = [];
    messages.forEach((m) => {
      m.attachments?.forEach((a) => {
        if (a.is_image) list.push(a);
      });
    });
    return list;
  }, [messages]);

  const handleMessageMouseMove = (e, message, isLatest) => {
    // Khi di chuyển chuột khỏi vị trí: ẩn tooltip thời gian ngay lập tức
    if (hoverTimeTimer.current) {
      clearTimeout(hoverTimeTimer.current);
      hoverTimeTimer.current = null;
    }
    setHoveredTime(null);

    const timeStr = chatTime(message.sent_at);
    const dayStr = chatDay(message.sent_at);
    const label = dayStr && dayStr !== 'Hôm nay' ? `${timeStr} · ${dayStr}` : timeStr;

    // Tin nhắn mới nhất hôm nay đã hiển thị sẵn giờ ở chân tin nhắn rồi
    if (isLatest && (!dayStr || dayStr === 'Hôm nay')) {
      return;
    }

    // Giữ chuột đúng vị trí 350ms (bằng thời gian hiện icon) mới hiển thị giờ trên đầu bubble
    hoverTimeTimer.current = setTimeout(() => {
      setHoveredTime({ messageId: message.id, text: label });
    }, 350);
  };

  const handleMessageMouseLeave = () => {
    if (hoverTimeTimer.current) {
      clearTimeout(hoverTimeTimer.current);
      hoverTimeTimer.current = null;
    }
    setHoveredTime(null);
  };

  const scrollToOriginalMessage = (targetId) => {
    if (!targetId) return;
    const target = messageRefs.current.get(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetId);
      window.clearTimeout(replyHighlightTimer.current);
      replyHighlightTimer.current = window.setTimeout(() => setHighlightedMessageId(null), 1500);
    } else {
      toast('Tin nhắn gốc nằm ở phần hội thoại trước đó.', { icon: 'ℹ️' });
    }
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(replyHighlightTimer.current);
      if (hoverTimeTimer.current) clearTimeout(hoverTimeTimer.current);
    };
  }, []);

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
  return <div className={`em-history ${compact ? 'em-history--compact' : ''}`} ref={historyRef} role="log" aria-label="Nội dung trò chuyện" aria-busy={thread.loading} onScroll={(event) => { handleMessageMouseLeave(); const el = event.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; thread.setAtEnd(pinned.current); }}>
    <div className="em-history__content" ref={contentRef}>
    {thread.loading && !messages.length && <ChatLoading variant="messages"/>}
    {hasOlder && <button type="button" className="em-load-more" onClick={older} disabled={loadingOlder}>{loadingOlder ? 'Đang tải...' : 'Tải tin nhắn trước'}</button>}
    {!messages.length && !thread.loading && <div className="em-empty"><h3>Bắt đầu cuộc trò chuyện</h3><p>Gửi một lời chào hoặc chia sẻ tài liệu học tập.</p></div>}
    {messages.map((message, index) => {
      const own = Number(message.sender_user_id) === Number(user.id);
      const otherMembers = detail?.participants?.filter((member) => Number(member.id) !== Number(user.id)) || [];
      const read = typeof message.id === 'number' && otherMembers.length > 0 && otherMembers.every((member) => Number(receipts[member.id] || 0) >= message.id);
      const day = chatDay(message.sent_at);
      const isHighlighted = highlightedMessageId === message.id;
      const isLatest = index === messages.length - 1;
      const hasReactions = Boolean(message.reactions?.length);
      const hasFootContent = isLatest || message.failed;
      return <Fragment key={message.client_id || message.id}>
        {day && (!index || day !== chatDay(messages[index - 1].sent_at)) && <div className="em-day">{day}</div>}
        <article
          className={`em-message ${own ? 'em-message--own' : ''} ${isLatest ? 'em-message--latest' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${hasReactions ? 'has-reactions' : ''}`}
          ref={(node) => {
            if (node && message.id) messageRefs.current.set(message.id, node);
            else if (message.id) messageRefs.current.delete(message.id);
          }}
          onMouseMove={(e) => handleMessageMouseMove(e, message, isLatest)}
          onMouseLeave={handleMessageMouseLeave}
        >
          {!own && (
            message.sender?.id ? (
              <Link
                to={ROUTES.TEACHER_PROFILE(message.sender.id)}
                className="em-avatar-link"
                title={`Xem trang cá nhân của ${message.sender?.name || 'thành viên'}`}
              >
                <ChatAvatar person={message.sender}/>
              </Link>
            ) : (
              <ChatAvatar person={message.sender}/>
            )
          )}
          <div className="em-message__body">
            {detail?.type === 'group' && !own && (
              <small className="em-group-sender">
                {message.sender?.id ? (
                  <Link
                    to={ROUTES.TEACHER_PROFILE(message.sender.id)}
                    className="em-group-sender-link"
                    title={`Xem trang cá nhân của ${message.sender?.name || 'thành viên'}`}
                  >
                    {message.sender?.name}
                  </Link>
                ) : (
                  message.sender?.name
                )}
              </small>
            )}
            {message.metadata?.forwarded && (
              <small className="em-forwarded-tag">
                <Forward size={12} /> Đã chuyển tiếp
              </small>
            )}
            {(message.metadata?.reply_to || message.metadata?.reply_to_id) && (
              <button
                type="button"
                className="em-reply-quote"
                onClick={() => scrollToOriginalMessage(message.metadata?.reply_to?.id || message.metadata?.reply_to_id)}
                title="Bấm để cuộn đến tin nhắn gốc"
              >
                <Reply size={13} className="em-reply-quote__icon" />
                <div className="em-reply-quote__body">
                  <strong>{message.metadata?.reply_to?.senderName || 'Tin nhắn được trả lời'}</strong>
                  <span>{message.metadata?.reply_to?.text || `#${message.metadata.reply_to_id}`}</span>
                </div>
              </button>
            )}
            <div className="em-message__content">
              {hoveredTime?.messageId === message.id && (
                <div className="em-message-hover-time" role="tooltip">
                  {hoveredTime.text}
                </div>
              )}
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
              {message.attachments?.map((attachment) => (
                <ChatAttachmentView
                  key={attachment.id}
                  attachment={attachment}
                  onPreview={(previewData) => {
                    const idx = allImageAttachments.findIndex((a) => a.id === attachment.id);
                    onPreview?.({
                      ...previewData,
                      index: idx >= 0 ? idx : 0,
                      items: allImageAttachments,
                    });
                  }}
                />
              ))}

              {/* Thanh thao tác nhanh bên phải tin nhắn: Icon cảm xúc, Trả lời, Chuyển tiếp */}
              <div
                className="em-message-actions-bar"
                role="toolbar"
                aria-label="Thao tác tin nhắn"
                onMouseEnter={handleMessageMouseLeave}
                onMouseMove={(e) => e.stopPropagation()}
              >
                {typeof message.id === 'number' && (
                  <div className="em-reaction-anchor">
                    <button
                      type="button"
                      className="em-action-icon-btn em-reaction-trigger"
                      aria-label="Bày tỏ cảm xúc"
                      title="Bày tỏ cảm xúc"
                      onClick={(e) => e.currentTarget.blur()}
                    >
                      <Smile size={15} />
                    </button>
                    <div className="em-reaction-popover" role="dialog" aria-label="Chọn cảm xúc">
                      {CHAT_REACTIONS.map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            void react(message, emoji);
                          }}
                          aria-label={`Thả cảm xúc ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {onReply && (
                  <button
                    type="button"
                    className="em-action-icon-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onReply(message);
                    }}
                    title="Trả lời"
                    aria-label="Trả lời"
                  >
                    <Reply size={14} />
                  </button>
                )}
                {onForward && (
                  <button
                    type="button"
                    className="em-action-icon-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onForward(message);
                    }}
                    title="Chuyển tiếp"
                    aria-label="Chuyển tiếp"
                  >
                    <Forward size={14} />
                  </button>
                )}
              </div>

              {/* Biểu tượng cảm xúc gắn vào góc khung tin nhắn (Phong cách Facebook Messenger) */}
              {hasReactions && (
                <div className="em-message-reactions-badge" role="group" aria-label="Cảm xúc tin nhắn">
                  {message.reactions.map((reaction) => (
                    <button
                      type="button"
                      key={reaction.emoji}
                      className={`em-reaction-badge ${reaction.user_ids.includes(Number(user.id)) ? 'is-active' : ''}`}
                      aria-label={`Cảm xúc ${reaction.emoji}, ${reaction.count} người`}
                      title={`Cảm xúc ${reaction.emoji} (${reaction.count})`}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        void react(message, reaction.emoji);
                      }}
                    >
                      <span className="em-reaction-badge__emoji">{reaction.emoji}</span>
                      {reaction.count > 1 && <span className="em-reaction-badge__count">{reaction.count}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={`em-message__foot ${isLatest ? 'is-latest' : ''} ${hasFootContent ? 'has-content' : 'is-empty'}`}>
              {isLatest && (
                <span className="em-message__time-info">
                  <time dateTime={message.sent_at}>{chatTime(message.sent_at)}</time>
                  {own && (
                    <span
                      className={`em-delivery ${read ? 'is-read' : ''}`}
                      title={message.failed ? 'Gửi chưa thành công' : message.pending ? 'Đang gửi' : read ? 'Đã xem' : 'Đã gửi'}
                      aria-label={message.failed ? 'Gửi chưa thành công' : message.pending ? 'Đang gửi' : read ? 'Đã xem' : 'Đã gửi'}
                    >
                      {message.pending ? <Clock3 size={13}/> : read ? <CheckCheck size={13}/> : <Check size={13}/>}
                    </span>
                  )}
                </span>
              )}

              {message.failed && (
                <button type="button" className="em-retry" onClick={() => void retryMessage(message).catch(() => {})}>
                  Thử gửi lại
                </button>
              )}
            </div>
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

export function ChatComposer({ thread, theme = 'light', replyingTo = null, onCancelReply }) {
  const { user } = useAuth();
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
    const metadata = {};
    if (replyingTo) {
      metadata.reply_to = {
        id: replyingTo.id,
        text: replyingTo.body || (replyingTo.attachments?.length ? `[${replyingTo.attachments.length} tệp đính kèm]` : ''),
        senderName: replyingTo.sender?.name || (Number(replyingTo.sender_user_id) === Number(user?.id) ? 'Bạn' : 'Đối phương'),
      };
      metadata.reply_to_id = replyingTo.id;
    }
    const payload = { body: body.trim(), files, ...(Object.keys(metadata).length ? { metadata } : {}) };
    sendingRef.current = true; setSending(true);
    setBody(''); setFiles([]); setEmojiOpen(false); setStickerOpen(false);
    onCancelReply?.();
    try {
      const response = await thread.send(payload);
      if (response.realtime_published === false) toast('Tin nhắn đã lưu. Realtime đang gián đoạn; đối phương có thể cần mở lại hội thoại.');
    } catch { /* The failed optimistic message retains a retry action. */ }
    finally { sendingRef.current = false; setSending(false); }
  };

  const submitSticker = async (sticker) => {
    setStickerOpen(false);
    if (sendingRef.current) return;
    const metadata = {
      sticker: {
        id: sticker.id,
        name: sticker.name,
        emoji: sticker.emoji,
        text: sticker.text,
        category: activePack,
      },
      ...(replyingTo ? {
        reply_to: {
          id: replyingTo.id,
          text: replyingTo.body || (replyingTo.attachments?.length ? `[${replyingTo.attachments.length} tệp đính kèm]` : ''),
          senderName: replyingTo.sender?.name || (Number(replyingTo.sender_user_id) === Number(user?.id) ? 'Bạn' : 'Đối phương'),
        },
        reply_to_id: replyingTo.id,
      } : {}),
    };
    onCancelReply?.();
    const payload = {
      body: `[Nhãn dán: ${sticker.name}]`,
      metadata,
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
    {replyingTo && (
      <div className="em-composer-reply-bar">
        <div className="em-composer-reply-bar__info">
          <Reply size={15} />
          <div className="em-composer-reply-bar__text">
            <strong>
              Trả lời {replyingTo.sender?.name || (Number(replyingTo.sender_user_id) === Number(user?.id) ? 'chính bạn' : 'đối phương')}
            </strong>
            <span>{replyingTo.body || (replyingTo.attachments?.length ? `[${replyingTo.attachments.length} tệp đính kèm]` : '')}</span>
          </div>
        </div>
        <button
          type="button"
          className="em-composer-reply-bar__close"
          onClick={onCancelReply}
          aria-label="Hủy trả lời"
        >
          <X size={15} />
        </button>
      </div>
    )}
    {files.map((file, index) => <PendingFile key={`${file.name}:${file.lastModified}:${index}`} file={file} remove={() => setFiles((current) => current.filter((_, position) => position !== index))}/>)}
    <div className="em-composer__row"><div className="em-composer__field">
      <div className="em-emoji-anchor"><ChatIcon label="Chọn biểu tượng cảm xúc" aria-expanded={emojiOpen} onClick={() => { setEmojiOpen((value) => !value); setStickerOpen(false); }}><Smile size={21}/></ChatIcon>
        {emojiOpen && <div className="em-emoji-panel"><EmojiPickerBoundary onClose={() => setEmojiOpen(false)}><Suspense fallback={<p>Đang tải biểu tượng...</p>}><EmojiPicker width="100%" height={350} theme={theme} searchPlaceHolder="Tìm biểu tượng..." previewConfig={{showPreview:false}} onEmojiClick={(emoji) => { setBody((value) => value + emoji.emoji); inputRef.current?.focus(); }}/></Suspense></EmojiPickerBoundary></div>}
      </div>
      <textarea ref={inputRef} aria-label="Soạn tin nhắn" placeholder="Soạn tin nhắn" rows={1} maxLength={4000} value={body} onChange={(event) => { setBody(event.target.value); thread.sendTyping(); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) void submit(event); }}/>
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

function ChatLightboxInner({ image, onClose }) {
  const items = useMemo(() => {
    if (!image) return [];
    if (Array.isArray(image.items) && image.items.length > 0) return image.items;
    return [image];
  }, [image]);

  const [index, setIndex] = useState(() => (image?.index !== undefined && image.index >= 0 ? image.index : 0));
  const blobUrlsRef = useRef(new Map());
  const [loadedUrls, setLoadedUrls] = useState(() => ({
    ...(image?.id && image?.url ? { [image.id]: image.url } : {}),
  }));

  const currentItem = items[index] || image;
  const currentId = currentItem?.id;
  const directUrl = currentItem?.url;
  const currentUrl = directUrl || loadedUrls[currentId] || (index === (image?.index ?? 0) ? image?.url : '');
  const loading = Boolean(currentId && !currentUrl);

  useEffect(() => {
    if (!currentId || directUrl || loadedUrls[currentId]) return;

    let active = true;
    chatService.attachment(currentId, true).then((blob) => {
      if (active) {
        const objectUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.set(currentId, objectUrl);
        setLoadedUrls((prev) => ({ ...prev, [currentId]: objectUrl }));
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [currentId, directUrl, loadedUrls]);

  // Clean up objectUrls only on unmount
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (e) { void e; }
      });
      urls.clear();
    };
  }, []);

  const total = items.length;
  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setIndex((curr) => (curr > 0 ? curr - 1 : total - 1));
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setIndex((curr) => (curr < total - 1 ? curr + 1 : 0));
  }, [total]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  const currentName = currentItem?.file_name || currentItem?.name || image.name || 'Ảnh đã chia sẻ';
  const title = total > 1
    ? `Ảnh (${index + 1}/${total}): ${currentName}`
    : currentName;

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      <div className="em-lightbox-container">
        {total > 1 && (
          <button
            type="button"
            className="em-lightbox-nav em-lightbox-nav--prev"
            onClick={handlePrev}
            title="Ảnh trước (Phím ←)"
            aria-label="Ảnh trước"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {loading ? (
          <div className="em-lightbox-loading">
            <ChatLoading variant="details" />
          </div>
        ) : (
          currentUrl && <img src={currentUrl} alt={currentName} className="em-lightbox-image" />
        )}

        {total > 1 && (
          <button
            type="button"
            className="em-lightbox-nav em-lightbox-nav--next"
            onClick={handleNext}
            title="Ảnh tiếp theo (Phím →)"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
      {total > 1 && (
        <div className="em-lightbox-counter">
          <span>{index + 1} / {total}</span>
          <small className="em-lightbox-hint"> · Sử dụng phím mũi tên ← → hoặc bấm nút để chuyển ảnh</small>
        </div>
      )}
    </Modal>
  );
}

export function ChatLightbox({ image, onClose }) {
  if (!image) return null;
  return (
    <ChatLightboxInner
      key={`${image.id || image.url}:${image.index ?? 0}`}
      image={image}
      onClose={onClose}
    />
  );
}

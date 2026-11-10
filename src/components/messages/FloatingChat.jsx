import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, MessageCircle, Minus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { ROUTES } from '@/constants/routes';
import { isConversationUnread } from '@/utils/chatState';
import { formatRelativeTime } from '@/utils/formatDate';
import { getChatWidgets, setChatWidget, updateChatWidget } from '@/features/learning/chatWidget';
import { ChatAvatar, ChatComposer, ChatHistory, ChatLightbox } from './ChatPieces';
import { ForwardDialog } from './ForwardDialog';
import '@/pages/Messages/messenger-workspace.css';
import '@/pages/Messages/realtime-chat.css';
import './floating-chat.css';

function ServerChatWindow({ conversationId, onMinimize, onClose }) {
  const thread = useRealtimeChat(conversationId);
  const [preview, setPreview] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const { conversations, online, presenceReady } = useChat();

  const conv = conversations.find((c) => Number(c.id) === Number(conversationId));

  const detail = thread.detail || conv;
  const partner = detail?.partner || conv?.partner;
  const isGroup = detail?.type === 'group' || conv?.type === 'group';
  const contactName = detail?.name || conv?.name || 'Cuộc trò chuyện';

  const isOnline = Boolean(partner && presenceReady && online.has(String(partner.id)));
  const lastActive = partner?.last_active_at || partner?.last_seen_at || conv?.last_message_at || detail?.last_message_at;
  const statusText = isGroup
    ? `${detail?.member_count || conv?.member_count || 2} thành viên`
    : !presenceReady
      ? 'Chưa rõ trạng thái'
      : isOnline
        ? 'Đang hoạt động'
        : lastActive
          ? `Hoạt động ${formatRelativeTime(lastActive)}`
          : 'Ngoại tuyến';

  return (
    <aside className="floating-chat em-mini" aria-label={`Cửa sổ trò chuyện với ${contactName}`}>
      <header className="floating-chat__head">
        <ChatAvatar person={isGroup ? detail : partner} group={isGroup} />
        <div className="floating-chat__head-info">
          <strong className="floating-chat__title" title={contactName}>
            {contactName}
          </strong>
          <small className={`floating-chat__status ${isOnline ? 'is-online' : ''}`}>
            {isOnline && <span className="floating-chat__status-dot" aria-hidden="true" />}
            {statusText}
          </small>
        </div>
        <Link
          to={`${ROUTES.MESSAGES}?conversation=${conversationId}`}
          className="floating-chat__head-btn"
          aria-label="Mở khung chat đầy đủ"
          title="Mở khung chat đầy đủ"
        >
          <Maximize2 size={15} />
        </Link>
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Thu nhỏ cuộc trò chuyện"
          title="Ẩn đi"
          className="floating-chat__head-btn"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cuộc trò chuyện"
          title="Tắt đi"
          className="floating-chat__head-btn"
        >
          <X size={17} />
        </button>
      </header>
      {thread.error && <p className="em-error" role="alert">{thread.error}</p>}
      <ChatHistory
        thread={thread}
        compact
        onPreview={setPreview}
        onReply={setReplyingTo}
        onForward={setForwarding}
      />
      {thread.detail && (
        <ChatComposer
          thread={thread}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
      <ChatLightbox image={preview} onClose={() => setPreview(null)} />
      {forwarding && (
        <ForwardDialog
          message={forwarding}
          conversations={conversations.filter((c) => Number(c.id) !== Number(conversationId))}
          onClose={() => setForwarding(null)}
          onForwarded={() => setForwarding(null)}
        />
      )}
    </aside>
  );
}

function MinimizedChatItem({ widget, conversations, onRestore, onClose }) {
  const conv = conversations.find((c) => String(c.id) === String(widget.threadKey));
  const contactName = conv?.name || 'Cuộc trò chuyện';
  const partner = conv?.partner;
  const isGroup = conv?.type === 'group';

  return (
    <div className="floating-chat__minimized-item">
      <button
        type="button"
        className="floating-chat__minimized"
        onClick={onRestore}
        aria-label={`Mở chat với ${contactName}`}
        title={`Mở chat với ${contactName}`}
      >
        <span className="floating-chat__minimized-avatar">
          <ChatAvatar person={isGroup ? conv : partner} group={isGroup} />
        </span>
      </button>
      <button
        type="button"
        className="floating-chat__minimized-close"
        onClick={onClose}
        aria-label={`Đóng chat với ${contactName}`}
        title="Tắt"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function FloatingChat() {
  const { user } = useAuth();
  const { conversations, counts, incomingId } = useChat();
  const [, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener('edumatch:chat-widget-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('edumatch:chat-widget-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (incomingId && user?.id) {
      setChatWidget(user.id, String(incomingId), { isClosed: false, isMinimized: false });
    }
  }, [incomingId, user?.id]);

  if (!user?.id || !conversations.length) return null;

  const widgets = getChatWidgets(user.id).filter((w) => !w.isClosed);
  const openedWidgets = widgets.filter((w) => !w.isMinimized);
  const minimizedWidgets = widgets.filter((w) => w.isMinimized);

  const handleOpenCandidate = () => {
    const candidate = incomingId || conversations.find(isConversationUnread)?.id || conversations[0].id;
    if (candidate) {
      setChatWidget(user.id, String(candidate), { isClosed: false, isMinimized: false });
    }
  };

  const handleMinimize = (threadKey) => {
    updateChatWidget(user.id, threadKey, { isMinimized: true });
  };

  const handleRestore = (threadKey) => {
    updateChatWidget(user.id, threadKey, { isMinimized: false });
  };

  const handleClose = (threadKey) => {
    updateChatWidget(user.id, threadKey, { isClosed: true });
  };

  if (!openedWidgets.length && !minimizedWidgets.length) {
    if (counts.unread > 0) {
      return (
        <div className="floating-chat-layer">
          <div className="floating-chat-layer__minimized">
            <button
              type="button"
              className="floating-chat__minimized"
              onClick={handleOpenCandidate}
              aria-label={`Mở tin nhắn, ${counts.unread} hội thoại chưa đọc`}
              title="Hội thoại chưa đọc"
            >
              <span className="floating-chat__minimized-avatar">
                <MessageCircle size={22} />
              </span>
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="floating-chat-layer">
      <div className="floating-chat-layer__open">
        {openedWidgets.map((widget) => (
          <ServerChatWindow
            key={`${user.id}:${widget.threadKey}`}
            conversationId={Number(widget.threadKey)}
            onMinimize={() => handleMinimize(widget.threadKey)}
            onClose={() => handleClose(widget.threadKey)}
          />
        ))}
      </div>
      <div className="floating-chat-layer__minimized">
        {minimizedWidgets.map((widget) => (
          <MinimizedChatItem
            key={`${user.id}:${widget.threadKey}`}
            widget={widget}
            conversations={conversations}
            onRestore={() => handleRestore(widget.threadKey)}
            onClose={() => handleClose(widget.threadKey)}
          />
        ))}
      </div>
    </div>
  );
}

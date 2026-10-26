import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Minus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { ROUTES } from '@/constants/routes';
import { ChatComposer, ChatHistory, ChatLightbox } from './ChatPieces';
import '@/pages/Messages/messenger-workspace.css';
import '@/pages/Messages/realtime-chat.css';
import './floating-chat.css';

function ServerChatWindow({ conversationId, onClose }) {
  const thread = useRealtimeChat(conversationId);
  const [preview, setPreview] = useState(null);
  return <div className="floating-chat em-mini">
    <header className="floating-chat__head"><MessageCircle size={20}/><div><strong>{thread.detail?.name || 'Đang tải...'}</strong><Link to={`${ROUTES.MESSAGES}?conversation=${conversationId}`}>Mở khung chat đầy đủ</Link></div><button type="button" onClick={onClose} aria-label="Thu nhỏ cuộc trò chuyện"><Minus size={17}/></button></header>
    {thread.error && <p className="em-error" role="alert">{thread.error}</p>}
    <ChatHistory thread={thread} compact onPreview={setPreview}/>
    {thread.detail && <ChatComposer thread={thread}/>}
    <ChatLightbox image={preview} onClose={() => setPreview(null)}/>
  </div>;
}

export function FloatingChat() {
  const { user } = useAuth();
  const { conversations, counts, incomingId } = useChat();
  const [selectedId, setSelectedId] = useState(null);
  if (!user?.id || !conversations.length) return null;
  const candidate = incomingId || conversations.find((item) => item.unread_count > 0)?.id || conversations[0].id;
  return <div className="floating-chat-layer em-server-widget">
    {selectedId ? <ServerChatWindow key={`${user.id}:${selectedId}`} conversationId={selectedId} onClose={() => setSelectedId(null)}/> : <button type="button" className="em-chat-launcher" onClick={() => setSelectedId(candidate)} aria-label={`Mở tin nhắn, ${counts.unread_messages} tin chưa đọc`}><MessageCircle size={23}/>{counts.unread_messages > 0 && <b>{counts.unread_messages}</b>}</button>}
  </div>;
}

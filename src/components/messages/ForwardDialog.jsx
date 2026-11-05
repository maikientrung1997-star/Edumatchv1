import React, { useState } from 'react';
import { Forward, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/feedback/Modal';
import { ChatAvatar } from './ChatPieces';
import { chatService, chatError } from '@/services/chatService';

export function ForwardDialog({ message, conversations = [], onClose, onForwarded }) {
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState(null);

  if (!message) return null;

  const needle = query.trim().toLowerCase();
  const filtered = conversations.filter((c) =>
    !needle || (c.name || '').toLowerCase().includes(needle) || (c.partner?.name || '').toLowerCase().includes(needle)
  );

  const handleForwardTo = async (conversation) => {
    if (sendingId) return;
    setSendingId(conversation.id);
    try {
      const body =
        (message.body || (message.text || '')).trim() ||
        (message.metadata?.sticker ? `[Nhãn dán: ${message.metadata.sticker.name || 'Sticker'}]` : '') ||
        (message.attachments?.length ? `[Chuyển tiếp ${message.attachments.length} tệp: ${message.attachments.map((a) => a.file_name).join(', ')}]` : '') ||
        '[Tin nhắn chuyển tiếp]';
      const metadata = {
        forwarded: true,
        ...(message.metadata?.formula ? { formula: message.metadata.formula } : {}),
        ...(message.metadata?.sticker ? { sticker: message.metadata.sticker } : {}),
      };
      await chatService.send(conversation.id, {
        body,
        metadata,
        client_id: crypto.randomUUID(),
      });
      toast.success(`Đã chuyển tiếp tới ${conversation.name}`);
      onForwarded?.(conversation);
      onClose();
    } catch (err) {
      toast.error(chatError(err) || 'Không thể chuyển tiếp tin nhắn.');
    } finally {
      setSendingId(null);
    }
  };

  const previewText = message.body || message.text || (message.metadata?.sticker ? `[Nhãn dán: ${message.metadata.sticker.name}]` : message.attachments?.length ? `[${message.attachments.length} tệp đính kèm]` : '');

  return (
    <Modal
      open
      onClose={onClose}
      title="Chuyển tiếp tin nhắn"
      description="Chọn người hoặc nhóm bạn đã từng nhắn tin để chuyển tiếp."
      size="md"
    >
      <div className="em-forward-dialog">
        <div className="em-forward-preview">
          <Forward size={16} />
          <div className="em-forward-preview__content">
            <small>Nội dung chuyển tiếp:</small>
            <p>{previewText}</p>
          </div>
        </div>

        <div className="em-forward-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm người nhận..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="em-forward-list">
          {filtered.length > 0 ? (
            filtered.map((conv) => (
              <div key={conv.id} className="em-forward-item">
                <ChatAvatar person={conv.partner} group={conv.type === 'group'} />
                <div className="em-forward-item__info">
                  <strong>{conv.name}</strong>
                  <small>{conv.type === 'group' ? `${conv.member_count} thành viên` : (conv.preview || 'Cuộc trò chuyện')}</small>
                </div>
                <button
                  type="button"
                  className="em-forward-item__btn"
                  disabled={sendingId === conv.id}
                  onClick={() => handleForwardTo(conv)}
                >
                  {sendingId === conv.id ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            ))
          ) : (
            <p className="em-forward-empty">
              {conversations.length === 0
                ? 'Chưa có cuộc trò chuyện nào khác để chuyển tiếp.'
                : 'Không tìm thấy người nhận phù hợp.'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

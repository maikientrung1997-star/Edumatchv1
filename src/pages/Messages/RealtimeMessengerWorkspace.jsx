import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Camera, Check, ChevronLeft, Image as ImageIcon, ListFilter, Mail, MailCheck, MailOpen, MessageCircle, PanelRight, Plus, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useDebounce } from '@/hooks/useDebounce';
import { useDesktopChat } from '@/hooks/useDesktopChat';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { chatService, chatError, chatRole } from '@/services/chatService';
import { chatTime, isConversationUnread } from '@/utils/chatState';
import { Modal } from '@/components/feedback/Modal';
import { ChatAttachmentView, ChatAvatar, ChatComposer, ChatHistory, ChatIcon, ChatLightbox, PrivateChatNote } from '@/components/messages/ChatPieces';
import { ChatHeaderLoading, ChatLoading } from '@/components/messages/ChatLoading';
import { ConversationTagBar } from '@/components/messages/ConversationTagBar';
import { ForwardDialog } from '@/components/messages/ForwardDialog';
import { setChatWidget } from '@/features/learning/chatWidget';
import './messages.css';
import './messenger-workspace.css';
import './realtime-chat.css';

async function optimizeAvatar(file, maxDimension = 600) {
  if (!file || !file.type.startsWith('image/')) return file;
  try {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const { width, height } = img;
          const maxDim = Math.max(width, height);
          const scale = maxDim > maxDimension ? maxDimension / maxDim : 1;
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetW, targetH);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], (file.name || 'avatar').replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.88);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  } catch {
    return file;
  }
}

function GroupDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const avatarInputRef = useRef(null);
  const [query, setQuery] = useState('');
  const search = useDebounce(query.trim(), 300);
  const [results, setResults] = useState({ query: '', items: [] });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { conversations } = useChat();

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }
    setError('');
    const optimized = await optimizeAvatar(file);
    setAvatarFile(optimized);
    setAvatarPreview(URL.createObjectURL(optimized));
  };

  // Danh sách những người đã từng nhắn tin trước đó
  const recentPartners = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      if (c.type !== 'group' && c.partner && c.partner.id) {
        const id = Number(c.partner.id);
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: c.partner.name || c.name,
            avatar_url: c.partner.avatar_url || c.partner.avatar,
            role: c.partner.role,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [conversations]);

  useEffect(() => {
    if (search.length < 2) return;
    let active = true;
    chatService.searchUsers(search).then((items) => { if (active) setResults({ query: search, items }); })
      .catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [search]);

  // Tổng hợp người từng nhắn tin (theo từ khóa) và kết quả tìm kiếm server (không giới hạn số lượng)
  const candidateList = useMemo(() => {
    const map = new Map();
    const q = query.trim().toLowerCase();
    const matchedRecents = q
      ? recentPartners.filter((p) => p.name?.toLowerCase().includes(q))
      : recentPartners;

    matchedRecents.forEach((item) => map.set(Number(item.id), item));

    if (results.query === search && Array.isArray(results.items)) {
      results.items.forEach((item) => {
        if (!map.has(Number(item.id))) {
          map.set(Number(item.id), item);
        }
      });
    }

    return Array.from(map.values());
  }, [query, recentPartners, results, search]);

  const toggleMember = (member) => {
    setMembers((current) =>
      current.some((item) => item.id === member.id)
        ? current.filter((item) => item.id !== member.id)
        : [...current, member]
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || !title.trim() || !members.length) return;
    setLoading(true); setError('');
    try { onCreated(await chatService.createGroup(title.trim(), members.map((member) => member.id), avatarFile)); }
    catch (failure) { setError(chatError(failure)); }
    finally { setLoading(false); }
  };

  return (
    <Modal
      open
      onClose={() => !loading && onClose()}
      title="Tạo nhóm học tập"
      size="md"
    >
      <form className="em-group-form" onSubmit={submit}>
        <div className="em-group-avatar-picker-wrap">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarSelect}
            disabled={loading}
          />
          <div className="em-group-avatar-picker">
            <button
              type="button"
              className="em-group-avatar-btn"
              onClick={() => avatarInputRef.current?.click()}
              title={avatarPreview ? 'Nhấn để thay đổi ảnh nhóm' : 'Nhấn để thêm ảnh nhóm'}
              aria-label="Chọn ảnh đại diện nhóm"
              disabled={loading}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Xem trước ảnh nhóm" className="em-group-avatar-img" />
              ) : (
                <span className="em-group-avatar-placeholder">
                  <Users size={32} />
                </span>
              )}
              <span className="em-group-avatar-badge" aria-hidden="true">
                <Camera size={14} />
              </span>
            </button>
            {avatarPreview && (
              <button
                type="button"
                className="em-group-avatar-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  setAvatarFile(null);
                  setAvatarPreview(null);
                  if (avatarInputRef.current) avatarInputRef.current.value = '';
                }}
                title="Bỏ ảnh đã chọn"
                aria-label="Bỏ ảnh đã chọn"
                disabled={loading}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="em-group-avatar-hint">
            {avatarPreview ? 'Nhấn vào ảnh để thay đổi' : 'Thêm ảnh đại diện nhóm (tùy chọn)'}
          </span>
        </div>
        <label>
          Tên nhóm
          <input
            aria-label="Tên nhóm"
            placeholder="Nhập tên nhóm..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={150}
            required
            disabled={loading}
          />
        </label>
        <label>
          Tìm và thêm thành viên
          <input
            aria-label="Tìm thành viên nhóm"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
          />
        </label>

        {members.length > 0 && (
          <div className="em-group-selected-wrap">
            <span className="em-group-selected-count">Đã chọn ({members.length}):</span>
            <div className="em-group-members">
              {members.map((member) => (
                <button
                  type="button"
                  key={member.id}
                  disabled={loading}
                  onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}
                  title="Bỏ chọn"
                >
                  {member.name} <X size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="em-group-results">
          {candidateList.length > 0 ? (
            candidateList.map((member) => {
              const isSelected = members.some((item) => item.id === member.id);
              return (
                <button
                  type="button"
                  key={member.id}
                  disabled={loading}
                  aria-pressed={isSelected}
                  onClick={() => toggleMember(member)}
                >
                  <ChatAvatar person={member} />
                  <span className="em-group-results__info">
                    <strong>{member.name}</strong>
                    <small>{chatRole(member.role)}</small>
                  </span>
                  {isSelected ? (
                    <Check size={18} style={{ color: 'var(--color-primary)' }} />
                  ) : (
                    <Plus size={18} />
                  )}
                </button>
              );
            })
          ) : (
            <p className="em-muted" style={{ padding: '16px 0', textAlign: 'center', fontSize: '13px' }}>
              {query.trim()
                ? 'Không tìm thấy người dùng phù hợp.'
                : 'Chưa có người từng nhắn tin trước đó. Hãy nhập tên để tìm kiếm.'}
            </p>
          )}
        </div>

        {error && <p className="em-error" role="alert">{error}</p>}
        <button
          type="submit"
          className="em-primary"
          disabled={loading || !title.trim() || !members.length}
        >
          {loading ? 'Đang tạo...' : `Tạo nhóm (${members.length} thành viên)`}
        </button>
      </form>
    </Modal>
  );
}

/**
 * Shared images/files. Mounted only while the details panel is visible, and served from the thread store's
 * cache until a new attachment arrives (`version` changes) or the user presses refresh.
 */
function SharedMedia({ conversationId, onPreview, version, getMedia, setMedia }) {
  const [type, setType] = useState('image');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [, rerender] = useReducer((count) => count + 1, 0);
  const data = getMedia(type);
  useEffect(() => {
    if (getMedia(type)) return;
    let active = true;
    chatService.media(conversationId, { type }).then((response) => {
      setMedia(type, { items: response.data, more: response.meta.has_more, before: response.meta.before_id }, version);
      if (active) rerender();
    }).catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [conversationId, type, version, getMedia, setMedia]);
  const more = async () => {
    if (loadingMore || !data) return;
    setLoadingMore(true);
    try {
      const response = await chatService.media(conversationId, { type, before_id: data.before });
      setMedia(type, { items: [...data.items, ...response.data], more: response.meta.has_more, before: response.meta.before_id }, version);
      rerender();
    } catch (failure) { setError(chatError(failure)); }
    finally { setLoadingMore(false); }
  };
  return <section className="em-detail-section em-shared-section"><h3><ImageIcon size={18}/>Ảnh & tệp đã chia sẻ</h3><div className="em-tabs"><button type="button" className={type === 'image' ? 'is-active' : ''} onClick={() => setType('image')}>Ảnh</button><button type="button" className={type === 'file' ? 'is-active' : ''} onClick={() => setType('file')}>File</button></div>
    {data ? <><div className={type === 'image' ? 'em-media' : 'em-file-list'}>{data.items.map((item, idx) => (
      <ChatAttachmentView
        key={item.id}
        attachment={item}
        compact
        onPreview={(previewData) => onPreview?.({ ...previewData, index: idx, items: data.items.filter((m) => m.is_image) })}
      />
    ))}</div>{!data.items.length && <p className="em-muted">Chưa có {type === 'image' ? 'ảnh' : 'tệp'} được chia sẻ.</p>}{data.more && <button className="em-load-more" type="button" onClick={() => void more()} disabled={loadingMore}>Xem thêm</button>}</> : <ChatLoading variant={type === 'image' ? 'media' : 'files'}/>}
    {error && <p className="em-error" role="alert">{error}</p>}
  </section>;
}

function ActiveThread({ conversationId, onBack, infoOpen, onInfo, user, tagControls }) {
  const thread = useRealtimeChat(conversationId);
  const chat = useChat();
  const { online, presenceReady, conversations } = chat;
  const [preview, setPreview] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [avatarUpdating, setAvatarUpdating] = useState(false);
  const [markingUnread, setMarkingUnread] = useState(false);
  const [unreadError, setUnreadError] = useState('');
  const groupAvatarFileRef = useRef(null);
  const detail = thread.detail;
  const partner = detail?.partner;
  const onlineNow = partner && presenceReady && online.has(String(partner.id));
  const onlineText = !presenceReady ? 'Chưa rõ trạng thái' : onlineNow ? 'Đang hoạt động' : 'Ngoại tuyến';

  const currentConv = conversations.find((c) => Number(c.id) === Number(conversationId));
  const isUnread = isConversationUnread(currentConv);

  const handleToggleUnreadInChat = async () => {
    if (!currentConv || markingUnread) return;
    setMarkingUnread(true);
    setUnreadError('');
    try { await chat.markUnread(conversationId, !isUnread, currentConv.last_message_id); }
    catch (failure) { setUnreadError(chatError(failure)); }
    finally { setMarkingUnread(false); }
  };

  const handleGroupAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }
    setAvatarUpdating(true);
    const toastId = toast.loading('Đang xử lý và tải ảnh lên...');
    try {
      const optimized = await optimizeAvatar(file);
      const updated = await chatService.updateGroupAvatar(conversationId, optimized);
      if (updated?.data) {
        chat.upsert(updated.data);
      }
      await thread.refresh();
      toast.success('Đã cập nhật ảnh đại diện nhóm!', { id: toastId });
    } catch (failure) {
      toast.error(chatError(failure) || 'Không thể cập nhật ảnh nhóm.', { id: toastId });
    } finally {
      setAvatarUpdating(false);
      if (groupAvatarFileRef.current) groupAvatarFileRef.current.value = '';
    }
  };

  return <>
    <section className="em-chat" aria-label={`Trò chuyện với ${detail?.name || 'người dùng'}`}>
      <div className="em-chat__head"><ChatIcon label="Quay lại danh sách hội thoại" onClick={onBack}><ChevronLeft size={23}/></ChatIcon>{detail ? <><ChatAvatar person={detail.type === 'group' ? detail : partner} group={detail.type === 'group'}/><button type="button" className="em-chat__identity" onClick={onInfo}><h2>{detail.name}</h2><span>{detail.type === 'group' ? `${detail.member_count} thành viên` : onlineText}</span></button></> : <ChatHeaderLoading/>}
        <div className="em-chat__actions">
          {detail && (
            <button
              type="button"
              className={`em-icon ${isUnread ? 'is-unread is-active' : ''}`}
              aria-label={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
              title={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
              disabled={!currentConv || markingUnread}
              onClick={handleToggleUnreadInChat}
            >
              {isUnread ? <MailCheck size={18} style={{ color: 'var(--color-primary, #0f766e)' }} /> : <Mail size={18}/>}
            </button>
          )}
          <button
            type="button"
            className={`em-icon em-zalo-panel-btn ${infoOpen ? 'is-active' : ''}`}
            aria-label={infoOpen ? 'Đóng thông tin hội thoại' : 'Mở thông tin hội thoại'}
            title={infoOpen ? 'Đóng thông tin hội thoại' : 'Mở thông tin hội thoại'}
            aria-expanded={infoOpen}
            onClick={onInfo}
          >
            <PanelRight size={20}/>
          </button>
        </div>
      </div>
      <ConversationTagBar conversationId={conversationId} {...tagControls} />
      {(unreadError || thread.error) && <p className="em-error em-thread-status" role="alert">{unreadError || thread.error}</p>}
      <ChatHistory
        thread={thread}
        onPreview={setPreview}
        onReply={setReplyingTo}
        onForward={setForwarding}
      />
      {detail && (
        <ChatComposer
          thread={thread}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
    </section>
    {infoOpen && <button type="button" className="em-info-scrim" aria-label="Đóng thông tin hội thoại" onClick={onInfo}/>}
    <aside className="em-details" aria-label="Thông tin người học">
      <div className="em-details__top"><h2>Thông tin hội thoại</h2><ChatIcon label="Đóng thông tin" onClick={onInfo}><X size={20}/></ChatIcon></div>
      {infoOpen && !detail && <div className="em-details__content"><ChatLoading variant="details"/></div>}
      {detail && infoOpen && <div className="em-details__content">
        <div className="em-profile">
          {detail.type === 'group' ? (
            <div className="em-group-avatar-editor">
              <input
                ref={groupAvatarFileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleGroupAvatarChange}
                disabled={avatarUpdating}
              />
              <button
                type="button"
                className="em-avatar-upload-trigger"
                onClick={() => groupAvatarFileRef.current?.click()}
                title="Nhấn để đổi ảnh đại diện nhóm"
                aria-label="Đổi ảnh đại diện nhóm"
                disabled={avatarUpdating}
              >
                <ChatAvatar person={detail} group large />
                <span className="em-avatar-upload-badge" aria-hidden="true">
                  <Camera size={14} />
                </span>
                <span className="em-avatar-upload-overlay" aria-hidden="true">
                  <Camera size={18} />
                  <small>Đổi ảnh</small>
                </span>
              </button>
            </div>
          ) : (
            <ChatAvatar person={partner} large />
          )}
          <div className="em-profile__identity">
            <h2>{detail.name}</h2>
            <span>{detail.type === 'group' ? `${detail.member_count} thành viên` : chatRole(partner?.role)}</span>
          </div>
        </div>
        {partner && (partner.profile_url || partner.id) && (
          <div className="em-profile-actions">
            <Link to={partner.profile_url || ROUTES.TEACHER_PROFILE(partner.id)}>
              <span>Xem hồ sơ</span>
              <ArrowUpRight size={16}/>
            </Link>
          </div>
        )}
        {detail.type === 'group' && (
          <section className="em-detail-section">
            <h3>Thành viên ({detail.participants?.length || 0})</h3>
            <ul className="em-members">
              {(detail.participants || []).map((member) => {
                const profileUrl = member.profile_url || ROUTES.TEACHER_PROFILE(member.id);
                const isSelf = Number(member.id) === Number(user?.id);
                return (
                  <li key={member.id}>
                    <Link
                      to={profileUrl}
                      className="em-member-item-link"
                      title={`Xem trang cá nhân của ${member.name}${isSelf ? ' (Bạn)' : ''}`}
                    >
                      <ChatAvatar person={member}/>
                      <span className="em-member-item-info">
                        <strong>
                          {member.name} {isSelf && <em className="em-self-badge">(Bạn)</em>}
                        </strong>
                        <small>
                          {chatRole(member.role)}
                          {member.participant_role === 'admin' ? ' · Quản trị nhóm' : ''}
                        </small>
                      </span>
                      <ArrowUpRight size={15} className="em-member-arrow" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <SharedMedia conversationId={conversationId} version={thread.mediaVersion} getMedia={thread.getMedia} setMedia={thread.setMedia} onPreview={setPreview}/>
        <PrivateChatNote conversationId={conversationId} initialNotes={thread.getNotes(detail.notes)} onSaved={thread.setNotes}/>
      </div>}
    </aside>
    <ChatLightbox image={preview} onClose={() => setPreview(null)}/>
    {forwarding && (
      <ForwardDialog
        message={forwarding}
        conversations={conversations.filter((c) => c.id !== conversationId)}
        onClose={() => setForwarding(null)}
        onForwarded={() => setForwarding(null)}
      />
    )}
  </>;
}

export function MessengerWorkspace() {
  const desktopChat = useDesktopChat();
  const { user, token } = useAuth();
  const chat = useChat();
  const [params, setParams] = useSearchParams();
  const selectedId = /^\d+$/.test(params.get('conversation') || '') ? Number(params.get('conversation')) : null;
  const [mobileView, setMobileView] = useState('list');
  const [query, setQuery] = useState('');
  const q = useDebounce(query.trim(), 300);
  const [unread, setUnread] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [groupOpen, setGroupOpen] = useState(false);

  useEffect(() => {
    if (!filterOpen) return;
    const closeFilterOutside = (event) => {
      if (!filterRef.current?.contains(event.target)) setFilterOpen(false);
    };
    document.addEventListener('pointerdown', closeFilterOutside, true);
    return () => document.removeEventListener('pointerdown', closeFilterOutside, true);
  }, [filterOpen]);
  const [people, setPeople] = useState({ query: '', items: [] });
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unreadPending, setUnreadPending] = useState(new Set());
  const handleToggleInfo = () => setInfoOpen((current) => !current);

  const handleBack = () => {
    setParams({});
    setMobileView('list');
  };

  const [tagState, setTagState] = useState({ token, data: null, error: '' });
  const [selectedTagId, setSelectedTagId] = useState(null);
  const [tagPage, setTagPage] = useState(null);
  if (tagState.token !== token) {
    setTagState({ token, data: null, error: '' });
    setSelectedTagId(null);
  }
  const applyTags = useCallback((data) => {
    setTagState((current) => current.token === token && data.revision >= (current.data?.revision ?? -1)
      ? { token, data, error: '' } : current);
  }, [token]);
  const loadTags = useCallback(() => {
    if (!token) return;
    chatService.tags().then(applyTags).catch((failure) => {
      setTagState((current) => current.token === token ? { ...current, error: chatError(failure) } : current);
    });
  }, [token, applyTags]);
  useEffect(loadTags, [loadTags]);

  const tagLibrary = tagState.data?.tags ?? [];
  const tagsById = new Map(tagLibrary.map((tag) => [tag.id, tag]));
  const activeTag = tagsById.get(selectedTagId);
  const activeTagId = activeTag?.id;
  const tagQueryKey = activeTagId ? `${activeTagId}:${tagState.data.revision}` : null;
  const tagsFor = (id) => {
    const assigned = tagState.data?.assignments[id] ?? [];
    return assigned.map((tagId) => tagsById.get(tagId)).filter(Boolean);
  };
  const { ingest, upsert } = chat;
  useEffect(() => {
    if (!activeTagId) return;
    let active = true;
    chatService.conversations({ tag_id: activeTagId }).then((response) => {
      if (!active) return;
      ingest(response, false);
      setTagPage({ key: tagQueryKey, page: response.meta.page, lastPage: response.meta.last_page });
    }).catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [activeTagId, tagQueryKey, ingest]);

  const subscribeSize = useCallback((onChange) => {
    const media = window.matchMedia('(min-width: 768px)'); media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const wide = useSyncExternalStore(subscribeSize, () => window.matchMedia('(min-width: 768px)').matches, () => true);

  useEffect(() => {
    if (desktopChat && user?.id && selectedId) {
      setChatWidget(user.id, String(selectedId), { isClosed: false, isMinimized: false });
    }
  }, [desktopChat, user?.id, selectedId]);

  // The base inbox stays current via Pusher. Selecting a label requests the matching server pages.
  useEffect(() => {
    if (q.length < 2) return;
    let active = true;
    chatService.searchUsers(q).then((items) => { if (active) setPeople({ query: q, items }); }).catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [q]);
  const open = (conversation) => {
    upsert(conversation);
    setParams({ conversation: conversation.id });
    setMobileView('chat');
  };
  const openPerson = async (person) => {
    if (opening) return;
    setOpening(true); setError('');
    try { open(await chatService.openDirect(person.id)); setQuery(''); }
    catch (failure) { setError(chatError(failure)); }
    finally { setOpening(false); }
  };
  const more = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (activeTagId) {
        const response = await chatService.conversations({ tag_id: activeTagId, page: tagPage.page + 1 });
        ingest(response, false);
        setTagPage((current) => current?.key === tagQueryKey
          ? { key: tagQueryKey, page: response.meta.page, lastPage: response.meta.last_page } : current);
      } else {
        await chat.loadMore();
      }
    }
    catch (failure) { setError(chatError(failure)); }
    finally { setLoadingMore(false); }
  };
  const toggleUnread = async (conversation) => {
    const { id, last_message_id: lastMessageId } = conversation;
    setUnreadPending((current) => new Set(current).add(id));
    setError('');
    try { await chat.markUnread(id, !isConversationUnread(conversation), lastMessageId); }
    catch (failure) { setError(chatError(failure)); }
    finally { setUnreadPending((current) => new Set([...current].filter((item) => item !== id))); }
  };
  const hasMore = activeTagId
    ? tagPage?.key === tagQueryKey && tagPage.page < tagPage.lastPage
    : chat.page < chat.lastPage;
  const needle = q.toLocaleLowerCase('vi');
  const visible = chat.conversations.filter((item) => {
    if (unread && !isConversationUnread(item)) return false;
    if (filter && item.type !== filter) return false;
    if (activeTagId && !tagState.data.assignments[item.id]?.includes(activeTagId)) return false;
    if (needle) {
      const matchName = item.name?.toLocaleLowerCase('vi').includes(needle);
      const matchPhone = item.partner?.phone?.includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  return <section className={`em-messenger ${mobileView === 'chat' ? 'em-messenger--chat' : ''} ${selectedId && infoOpen ? 'em-messenger--info' : ''}`} aria-label="Tin nhắn EduMatch">
    <aside className="em-inbox" aria-label="Danh sách hội thoại">
      <div className="em-inbox__heading"><Link to={ROUTES.HOME} className="em-icon em-back" aria-label="Quay lại trang chủ"><ArrowLeft size={20}/></Link><div>
        {/* <span className="em-eyebrow">EDUMATCH CHAT</span> */}
        <h1>Tin nhắn</h1></div><span className="em-count">{chat.loaded ? chat.counts.total : <span className="em-count-loading" aria-label="Đang tải số hội thoại"/>}</span><ChatIcon label="Tạo nhóm học tập" onClick={() => setGroupOpen(true)}><Plus size={17}/></ChatIcon></div>
      <div className="em-search-row"><label className="em-search"><Search size={17}/><input aria-label="Tìm kiếm người dùng" placeholder="Tên, email hoặc số điện thoại..." value={query} onChange={(event) => setQuery(event.target.value)} maxLength={150}/></label>
        <div className="em-filter" ref={filterRef}>
          <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)}>
            <ListFilter size={17}/>
            <span>{activeTag ? `Thẻ: ${activeTag.name}` : 'Lọc theo'}</span>
          </button>
          {filterOpen && (
            <div className="em-filter__menu">
              {[['','Tất cả hội thoại'],['direct','Cá nhân'],['group','Nhóm học tập']].map(([value,label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={!activeTagId && filter===value}
                  onClick={() => { setFilter(value); setSelectedTagId(null); setFilterOpen(false); }}
                >
                  {label}
                </button>
              ))}
              {tagLibrary.length > 0 && (
                <>
                  <div className="em-filter__separator">Lọc theo thẻ</div>
                  {tagLibrary.map((tag) => (
                    <button
                      type="button"
                      key={tag.id}
                      className={`em-filter__tag-item ${selectedTagId === tag.id ? 'is-active' : ''}`}
                      aria-pressed={selectedTagId === tag.id}
                      onClick={() => {
                        setSelectedTagId(activeTagId === tag.id ? null : tag.id);
                        setFilterOpen(false);
                      }}
                    >
                      <span className="em-tag-dot" style={{ backgroundColor: tag.color }} />
                      <span>{tag.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="em-tabs"><button type="button" className={!unread?'is-active':''} onClick={() => setUnread(false)}>{chat.loaded ? `Tất cả (${chat.counts.total})` : 'Tất cả'}</button><button type="button" className={unread?'is-active':''} onClick={() => setUnread(true)}><MailOpen size={16}/>{chat.loaded ? `Chưa đọc (${chat.counts.unread})` : 'Chưa đọc'}</button></div>
      {chat.loaded && chat.connection !== 'connected' && <p className="em-connection" role="status">{chat.connection === 'connecting' ? 'Đang kết nối realtime...' : 'Realtime chưa kết nối.'} <button type="button" onClick={() => void chat.refresh().catch((failure) => toast.error(chatError(failure)))}>Làm mới</button></p>}
      {(error || chat.error) && <p className="em-error" role="alert">{error || chat.error}</p>}
      {tagState.error && <p className="em-error" role="alert">{tagState.error} <button type="button" onClick={loadTags}>Tải lại thẻ</button></p>}
      <div className="em-contacts" aria-busy={!chat.loaded}>
        {!chat.loaded && !chat.conversations.length && !chat.error && <ChatLoading variant="inbox"/>}
        {q.length >= 2 && people.query === q && people.items.length > 0 && <section className="em-search-people"><h3>Người dùng hệ thống</h3>{people.items.map((person) => <button type="button" className="em-contact" key={person.id} disabled={opening} onClick={() => void openPerson(person)}><ChatAvatar person={person}/><span className="em-contact__copy"><strong>{person.name}</strong><span>{person.phone || chatRole(person.role)}</span><small>{person.conversation_id ? 'Mở lại hội thoại' : 'Bắt đầu trò chuyện'}</small></span><Plus size={16}/></button>)}</section>}
        {visible.map((conversation) => {
          const tags = tagsFor(conversation.id);
          const isSelected = selectedId === conversation.id;
          const isUnread = isConversationUnread(conversation);
          return (
            <div
              key={conversation.id}
              className={`em-contact-item ${isSelected ? 'is-selected' : ''} ${isUnread ? 'is-unread' : ''}`}
            >
              <button
                type="button"
                className={`em-contact ${isSelected ? 'is-selected' : ''} ${isUnread ? 'is-unread' : ''}`}
                aria-pressed={isSelected}
                onClick={() => open(conversation)}
              >
                <ChatAvatar person={conversation.type === 'group' ? conversation : conversation.partner} group={conversation.type === 'group'}/>
                <span className="em-contact__copy">
                  <strong>{conversation.name}</strong>
                  <span>{conversation.preview}</span>
                  {tags.length > 0 && (
                    <span className="em-contact__tags">
                      {tags.map((tag) => (
                        <span key={tag.id} className="em-tag-chip" style={{ '--tag-color': tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="em-contact__meta">
                  <time>{chatTime(conversation.last_message_at)}</time>
                  {isUnread && <b>{conversation.unread_count > 99 ? '99+' : (conversation.unread_count || '•')}</b>}
                </span>
              </button>
              <button
                type="button"
                className={`em-contact-action-btn ${isUnread ? 'is-unread' : ''}`}
                title={isUnread ? 'Đánh dấu là đã đọc' : 'Đánh dấu là chưa đọc'}
                aria-label={isUnread ? 'Đánh dấu là đã đọc' : 'Đánh dấu là chưa đọc'}
                disabled={unreadPending.has(conversation.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleUnread(conversation);
                }}
              >
                {isUnread ? <MailCheck size={16} /> : <Mail size={16} />}
              </button>
            </div>
          );
        })}
        {chat.loaded && !visible.length && <div className="em-empty"><Search size={27}/><h3>Chưa có hội thoại phù hợp</h3><p>Tìm người dùng theo tên hoặc số điện thoại để bắt đầu.</p></div>}
        {hasMore && <button className="em-load-more" type="button" onClick={() => void more()} disabled={loadingMore}>Tải thêm hội thoại</button>}
      </div>
    </aside>
    {selectedId && (wide || mobileView === 'chat') ? (
      <ActiveThread
        key={`${user?.id}:${selectedId}`}
        conversationId={selectedId}
        onBack={handleBack}
        infoOpen={infoOpen}
        onInfo={handleToggleInfo}
        user={user}
        tagControls={{ tags: tagsFor(selectedId), library: tagLibrary, ready: Boolean(tagState.data), onChange: applyTags }}
      />
    ) : (
      <section className="em-chat em-no-selection em-welcome">
        <div className="em-welcome__mark" aria-hidden="true"><MessageCircle size={38} strokeWidth={1.5}/></div>
        <h2>Cuộc trò chuyện của bạn</h2>
        <p>Chọn một hội thoại hoặc tìm người dùng<br/>để bắt đầu kết nối trên EduMatch.</p>
        <span className="em-welcome__hint"><Search size={14}/>Tìm kiếm theo tên, email hoặc số điện thoại</span>
      </section>
    )}
    {groupOpen && <GroupDialog onClose={() => setGroupOpen(false)} onCreated={(conversation) => { setGroupOpen(false); open(conversation); }}/>}
  </section>;
}

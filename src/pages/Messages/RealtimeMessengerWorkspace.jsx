import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronLeft, FileText, Image as ImageIcon, ListFilter, MailOpen, MapPin, MessageCircle, PanelRight, Phone, Plus, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useDebounce } from '@/hooks/useDebounce';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { chatService, chatError, chatRole } from '@/services/chatService';
import { chatTime } from '@/utils/chatState';
import { Modal } from '@/components/feedback/Modal';
import { ChatAttachmentView, ChatAvatar, ChatComposer, ChatHistory, ChatIcon, ChatLightbox, PrivateChatNote } from '@/components/messages/ChatPieces';
import { ChatHeaderLoading, ChatLoading } from '@/components/messages/ChatLoading';
import './messenger-workspace.css';
import './realtime-chat.css';

function GroupDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const search = useDebounce(query.trim(), 300);
  const [results, setResults] = useState({ query: '', items: [] });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (search.length < 2) return;
    let active = true;
    chatService.searchUsers(search).then((items) => { if (active) setResults({ query: search, items }); })
      .catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [search]);
  const submit = async (event) => {
    event.preventDefault();
    if (loading || !title.trim() || !members.length) return;
    setLoading(true); setError('');
    try { onCreated(await chatService.createGroup(title.trim(), members.map((member) => member.id))); }
    catch (failure) { setError(chatError(failure)); }
    finally { setLoading(false); }
  };
  return <Modal open onClose={() => !loading && onClose()} title="Tạo nhóm học tập" description="Chọn tối đa 19 thành viên khác." size="md">
    <form className="em-group-form" onSubmit={submit}>
      <label>Tên nhóm<input aria-label="Tên nhóm" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} required disabled={loading}/></label>
      <label>Tìm thành viên<input aria-label="Tìm thành viên nhóm" placeholder="Tên hoặc số điện thoại..." value={query} onChange={(event) => setQuery(event.target.value)} disabled={loading}/></label>
      <div className="em-group-members">{members.map((member) => <button type="button" key={member.id} disabled={loading} onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}>{member.name} <X size={14}/></button>)}</div>
      <div className="em-group-results">{results.query === search && results.items.map((member) => <button type="button" key={member.id} disabled={loading || (members.length >= 19 && !members.some((item) => item.id === member.id))} aria-pressed={members.some((item) => item.id === member.id)} onClick={() => setMembers((current) => current.some((item) => item.id === member.id) ? current.filter((item) => item.id !== member.id) : [...current, member])}><ChatAvatar person={member}/><span>{member.name}<small>{chatRole(member.role)}</small></span><Plus size={17}/></button>)}</div>
      {error && <p className="em-error" role="alert">{error}</p>}
      <button type="submit" className="em-primary" disabled={loading || !title.trim() || !members.length}>{loading ? 'Đang tạo...' : 'Tạo nhóm'}</button>
    </form>
  </Modal>;
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
    {data ? <><div className={type === 'image' ? 'em-media' : 'em-file-list'}>{data.items.map((item) => <ChatAttachmentView key={item.id} attachment={item} compact onPreview={onPreview}/>)}</div>{!data.items.length && <p className="em-muted">Chưa có {type === 'image' ? 'ảnh' : 'tệp'} được chia sẻ.</p>}{data.more && <button className="em-load-more" type="button" onClick={() => void more()} disabled={loadingMore}>Xem thêm</button>}</> : <ChatLoading variant={type === 'image' ? 'media' : 'files'}/>}
    {error && <p className="em-error" role="alert">{error}</p>}
  </section>;
}

function ActiveThread({ conversationId, theme, onBack, infoOpen, onInfo }) {
  const thread = useRealtimeChat(conversationId);
  const { online, presenceReady } = useChat();
  const [preview, setPreview] = useState(null);
  const detail = thread.detail;
  const partner = detail?.partner;
  const onlineNow = partner && presenceReady && online.has(String(partner.id));
  const onlineText = !presenceReady ? 'Chưa rõ trạng thái' : onlineNow ? 'Đang hoạt động' : 'Ngoại tuyến';
  return <>
    <section className="em-chat" aria-label={`Trò chuyện với ${detail?.name || 'người dùng'}`}>
      <div className="em-chat__head"><ChatIcon label="Quay lại danh sách hội thoại" onClick={onBack}><ChevronLeft size={23}/></ChatIcon>{detail ? <><ChatAvatar person={partner} group={detail.type === 'group'}/><button type="button" className="em-chat__identity" onClick={onInfo}><h2>{detail.name}</h2><span>{detail.type === 'group' ? `${detail.member_count} thành viên` : onlineText}</span></button></> : <ChatHeaderLoading/>}
        <div className="em-chat__actions">
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
      {thread.error && <p className="em-error em-thread-status" role="alert">{thread.error}</p>}
      <ChatHistory thread={thread} onPreview={setPreview}/>
      {detail && <ChatComposer thread={thread} theme={theme}/>}
    </section>
    {infoOpen && <button type="button" className="em-info-scrim" aria-label="Đóng thông tin hội thoại" onClick={onInfo}/>}
    <aside className="em-details" aria-label="Thông tin người học">
      <div className="em-details__top"><h2>Thông tin hội thoại</h2><ChatIcon label="Đóng thông tin" onClick={onInfo}><X size={20}/></ChatIcon></div>
      {infoOpen && !detail && <div className="em-details__content"><ChatLoading variant="details"/></div>}
      {detail && infoOpen && <div className="em-details__content">
        <div className="em-profile"><ChatAvatar person={partner} group={detail.type === 'group'} large/><div className="em-profile__identity"><h2>{detail.name}</h2><span>{detail.type === 'group' ? `${detail.member_count} thành viên` : chatRole(partner?.role)}</span></div></div>
        {partner && <>
          <dl className="em-profile-facts">
            <div><Users size={18}/><dt>Vai trò</dt><dd>{chatRole(partner.role)}</dd></div>
            {partner.location && <div><MapPin size={18}/><dt>Khu vực</dt><dd>{partner.location}</dd></div>}
            {partner.headline && <div><FileText size={18}/><dt>Chuyên môn</dt><dd>{partner.headline}</dd></div>}
            {partner.phone && <div><Phone size={18}/><dt>Số điện thoại</dt><dd><a href={`tel:${partner.phone}`}>{partner.phone}</a></dd></div>}
            {partner.interests?.length > 0 && <div><MessageCircle size={18}/><dt>Mối quan tâm</dt><dd>{partner.interests.map((item) => [item.subject, item.level, item.goals].filter(Boolean).join(' · ')).join('; ')}</dd></div>}
          </dl>
          {partner.bio && <div className="em-profile-bio"><h3>Giới thiệu</h3><p className="em-real-bio">{partner.bio}</p></div>}
          {partner.profile_url && <div className="em-profile-actions"><Link to={partner.profile_url}>Xem hồ sơ<ArrowUpRight size={17}/></Link></div>}
        </>}
        {detail.type === 'group' && <section className="em-detail-section"><h3>Thành viên</h3><ul className="em-members">{detail.participants.map((member) => <li key={member.id}><ChatAvatar person={member}/><span>{member.name}<small>{chatRole(member.role)}{member.participant_role === 'admin' ? ' · Quản trị nhóm' : ''}</small></span></li>)}</ul></section>}
        <SharedMedia conversationId={conversationId} version={thread.mediaVersion} getMedia={thread.getMedia} setMedia={thread.setMedia} onPreview={setPreview}/>
        <PrivateChatNote conversationId={conversationId} initialNotes={thread.getNotes(detail.notes)} onSaved={thread.setNotes}/>
      </div>}
    </aside>
    <ChatLightbox image={preview} onClose={() => setPreview(null)}/>
  </>;
}

export function MessengerWorkspace() {
  const { theme = 'light' } = useOutletContext() || {};
  const { user } = useAuth();
  const chat = useChat();
  const [params, setParams] = useSearchParams();
  const selectedId = /^\d+$/.test(params.get('conversation') || '') ? Number(params.get('conversation')) : null;
  const [mobileView, setMobileView] = useState('list');
  const [query, setQuery] = useState('');
  const q = useDebounce(query.trim(), 300);
  const [unread, setUnread] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [people, setPeople] = useState({ query: '', items: [] });
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const subscribeSize = useCallback((onChange) => {
    const media = window.matchMedia('(min-width: 768px)'); media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const wide = useSyncExternalStore(subscribeSize, () => window.matchMedia('(min-width: 768px)').matches, () => true);
  const { upsert } = chat;
  // The inbox is loaded once by ChatProvider and kept current by websocket events.
  // Tabs, type filter and name search run on that in-memory list (no request); only looking up *new* people hits the API.
  useEffect(() => {
    if (q.length < 2) return;
    let active = true;
    chatService.searchUsers(q).then((items) => { if (active) setPeople({ query: q, items }); }).catch((failure) => { if (active) setError(chatError(failure)); });
    return () => { active = false; };
  }, [q]);
  const open = (conversation) => {
    upsert(conversation); setParams({ conversation: conversation.id }); setMobileView('chat'); setInfoOpen(false);
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
    try { await chat.loadMore(); }
    catch (failure) { setError(chatError(failure)); }
    finally { setLoadingMore(false); }
  };
  const needle = q.toLocaleLowerCase('vi');
  const visible = chat.conversations.filter((item) => (!unread || item.unread_count > 0) && (!filter || item.type === filter)
    && (!needle || item.name?.toLocaleLowerCase('vi').includes(needle) || item.partner?.phone?.includes(q)));
  return <section className={`em-messenger ${mobileView === 'chat' ? 'em-messenger--chat' : ''} ${infoOpen ? 'em-messenger--info' : ''}`} aria-label="Tin nhắn EduMatch">
    <aside className="em-inbox" aria-label="Danh sách hội thoại">
      <div className="em-inbox__heading"><Link to={ROUTES.HOME} className="em-icon em-back" aria-label="Quay lại trang chủ"><ArrowLeft size={20}/></Link><div>
        {/* <span className="em-eyebrow">EDUMATCH CHAT</span> */}
        <h1>Tin nhắn</h1></div><span className="em-count">{chat.loaded ? chat.counts.total : <span className="em-count-loading" aria-label="Đang tải số hội thoại"/>}</span><ChatIcon label="Tạo nhóm học tập" onClick={() => setGroupOpen(true)}><Plus size={17}/></ChatIcon></div>
      <div className="em-search-row"><label className="em-search"><Search size={17}/><input aria-label="Tìm kiếm người dùng" placeholder="Tên, email hoặc số điện thoại..." value={query} onChange={(event) => setQuery(event.target.value)} maxLength={150}/></label>
        <div className="em-filter"><button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)}><ListFilter size={17}/><span>Lọc theo</span></button>{filterOpen && <div className="em-filter__menu">{[['','Tất cả hội thoại'],['direct','Cá nhân'],['group','Nhóm học tập']].map(([value,label]) => <button type="button" key={value} aria-pressed={filter===value} onClick={() => { setFilter(value); setFilterOpen(false); }}>{label}</button>)}</div>}</div>
      </div>
      <div className="em-tabs"><button type="button" className={!unread?'is-active':''} onClick={() => setUnread(false)}>{chat.loaded ? `Tất cả (${chat.counts.total})` : 'Tất cả'}</button><button type="button" className={unread?'is-active':''} onClick={() => setUnread(true)}><MailOpen size={16}/>{chat.loaded ? `Chưa đọc (${chat.counts.unread})` : 'Chưa đọc'}</button></div>
      {chat.loaded && chat.connection !== 'connected' && <p className="em-connection" role="status">{chat.connection === 'connecting' ? 'Đang kết nối realtime...' : 'Realtime chưa kết nối.'} <button type="button" onClick={() => void chat.refresh().catch((failure) => toast.error(chatError(failure)))}>Làm mới</button></p>}
      {(error || chat.error) && <p className="em-error" role="alert">{error || chat.error}</p>}
      <div className="em-contacts" aria-busy={!chat.loaded}>
        {!chat.loaded && !chat.conversations.length && !chat.error && <ChatLoading variant="inbox"/>}
        {q.length >= 2 && people.query === q && people.items.length > 0 && <section className="em-search-people"><h3>Người dùng hệ thống</h3>{people.items.map((person) => <button type="button" className="em-contact" key={person.id} disabled={opening} onClick={() => void openPerson(person)}><ChatAvatar person={person}/><span className="em-contact__copy"><strong>{person.name}</strong><span>{person.phone || chatRole(person.role)}</span><small>{person.conversation_id ? 'Mở lại hội thoại' : 'Bắt đầu trò chuyện'}</small></span><Plus size={16}/></button>)}</section>}
        {visible.map((conversation) => <button type="button" key={conversation.id} className={`em-contact ${selectedId === conversation.id ? 'is-selected' : ''}`} aria-pressed={selectedId === conversation.id} onClick={() => open(conversation)}><ChatAvatar person={conversation.partner} group={conversation.type === 'group'}/><span className="em-contact__copy"><strong>{conversation.name}</strong><span>{conversation.preview}</span></span><span className="em-contact__meta"><time>{chatTime(conversation.last_message_at)}</time>{conversation.unread_count > 0 && <b>{conversation.unread_count}</b>}</span></button>)}
        {chat.loaded && !visible.length && <div className="em-empty"><Search size={27}/><h3>Chưa có hội thoại phù hợp</h3><p>Tìm người dùng theo tên hoặc số điện thoại để bắt đầu.</p></div>}
        {chat.page < chat.lastPage && <button className="em-load-more" type="button" onClick={() => void more()} disabled={loadingMore}>Tải thêm hội thoại</button>}
      </div>
    </aside>
    {selectedId && (wide || mobileView === 'chat') ? <ActiveThread key={`${user?.id}:${selectedId}`} conversationId={selectedId} theme={theme} onBack={() => setMobileView('list')} infoOpen={infoOpen} onInfo={() => setInfoOpen((value) => !value)}/> : <section className="em-chat em-no-selection em-welcome"><div className="em-welcome__mark" aria-hidden="true"><MessageCircle size={38} strokeWidth={1.5}/></div><h2>Cuộc trò chuyện của bạn</h2><p>Chọn một hội thoại hoặc tìm người dùng<br/>để bắt đầu kết nối trên EduMatch.</p><span className="em-welcome__hint"><Search size={14}/>Tìm kiếm theo tên, email hoặc số điện thoại</span></section>}
    {groupOpen && <GroupDialog onClose={() => setGroupOpen(false)} onCreated={(conversation) => { setGroupOpen(false); open(conversation); }}/>}
  </section>;
}

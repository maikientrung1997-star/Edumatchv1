import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  Download,
  FileText,
  GraduationCap,
  Image,
  Info,
  ListFilter,
  MailOpen,
  MapPin,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Users,
  Video,
  X,
} from 'lucide-react';
import portraits from '@/assets/chat-avatars.webp';
import { ROUTES } from '@/constants/routes';
import './messenger-workspace.css';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
// UI-only fixtures. No API calls, authentication changes or conversation persistence.
const CONTACTS = [
  {
    id: 'vy',
    name: 'Nguyễn Thảo Vy',
    preview: 'Dạ vâng ạ! Em cảm ơn thầy nhiều ạ...',
    time: '14:30',
    unread: 2,
    portrait: 0,
    online: true,
  },
  {
    id: 'khoi',
    name: 'Lê Minh Khôi',
    preview: 'Thầy có thể gửi thêm tài liệu phần...',
    time: '10:12',
    unread: 1,
    portrait: 1,
    online: true,
  },
  {
    id: 'ha',
    name: 'Phạm Thu Hà',
    preview: 'Em đã hoàn thành bài tập tuần này...',
    time: '09:25',
    unread: 1,
    portrait: 2,
    online: true,
  },
  {
    id: 'toeic',
    name: 'Nhóm: TOEIC 700+',
    preview: 'Trần Mai: Mình có tài liệu part 5 nè...',
    time: 'Hôm qua',
    group: true,
  },
  {
    id: 'bao',
    name: 'Đặng Quốc Bảo',
    preview: 'Cảm ơn thầy! 🙏',
    time: 'Hôm qua',
    portrait: 1,
    online: true,
  },
  {
    id: 'anh',
    name: 'Võ Hoàng Anh',
    preview: 'Dạ em sẽ sắp xếp được ạ.',
    time: '12/04',
    portrait: 2,
  },
  {
    id: 'web',
    name: 'Nhóm: Lập trình Web',
    preview: 'Nguyễn Nam: Bài học hôm nay...',
    time: '11/04',
    group: true,
  },
  {
    id: 'phuong',
    name: 'Trần Mai Phương',
    preview: 'Dạ được ạ, hẹn thầy vào thứ 6 nhé!',
    time: '10/04',
    portrait: 0,
  },
];
const HISTORY = [
  {
    id: 'm1',
    text: 'Thầy ơi, em có vài câu hỏi về bài học tuần này ạ.\nKhông biết thầy có thể giải thích thêm giúp em được không? 🙏',
    time: '09:12',
  },
  {
    id: 'm2',
    own: true,
    text: 'Chào em! Thầy rất sẵn lòng. Em cứ gửi câu hỏi nhé,\nthầy sẽ giải thích chi tiết hơn cho em 😊',
    time: '09:15',
  },
  {
    id: 'm3',
    text: 'Dạ em đang thắc mắc về phần công thức này ạ.\nThầy có thể giải thích giúp em cách áp dụng trong bài tập được không ạ?',
    time: '09:18',
    attachment: 'math',
    reaction: '👍',
  },
  {
    id: 'm4',
    own: true,
    text: 'Đây là các công thức tích phân cơ bản.\nThầy gửi em thêm tài liệu tham khảo nhé!',
    time: '09:22',
    attachment: 'pdf',
  },
  {
    id: 'm5',
    text: 'Dạ vâng ạ! Em cảm ơn thầy nhiều ạ!\nTài liệu rất chi tiết và dễ hiểu ạ! 🌸',
    time: '09:25',
    reaction: '❤️',
  },
];

function Avatar({ contact, large = false }) {
  return (
    <span
      className={`em-avatar ${large ? 'em-avatar--large' : ''} ${contact.group ? 'em-avatar--group' : ''}`}
    >
      {contact.group ? (
        <Users size={25} />
      ) : (
        <span
          className="em-avatar__photo"
          style={{
            backgroundImage: `url(${portraits})`,
            backgroundPosition: `${(contact.portrait || 0) * 50}% center`,
          }}
          role="img"
          aria-label={`Ảnh ${contact.name}`}
        />
      )}
      {contact.online && <i aria-label="Đang hoạt động" />}
    </span>
  );
}
function IconButton({ label, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`em-icon ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
function MathNote({ small = false }) {
  return (
    <div
      className={`em-math ${small ? 'em-math--small' : ''}`}
      role="img"
      aria-label="Ghi chú các công thức tích phân cơ bản"
    >
      <span>
        ∫ x² dx = <sup>x³</sup>⁄₃ + C
      </span>
      <span>∫ sin x dx = − cos x + C</span>
      <span>
        ∫ <sup>1</sup>⁄ₓ dx = ln |x| + C
      </span>
    </div>
  );
}

export function MessengerWorkspace() {
  const { theme = 'light' } = useOutletContext() || {};
  const [selected, setSelected] = useState(CONTACTS[0]);
  const [mobileView, setMobileView] = useState('list');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filter, setFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState({ vy: HISTORY });
  const [attachment, setAttachment] = useState(null);
  const [reactions, setReactions] = useState({});
  const [dialog, setDialog] = useState(null);
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState('');
  const historyRef = useRef(null);
  const composerRef = useRef(null);
  const fileRef = useRef(null);
  const emojiRef = useRef(null);
  const filterRef = useRef(null);
  const attachmentUrlRef = useRef([]);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement;
    const panel = dialogRef.current;
    const focusable = () => [...panel.querySelectorAll('button, a[href], input, textarea')];
    focusable()[0]?.focus();
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener('keydown', trap);
    return () => {
      panel.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [dialog]);
  const threadMessages = messages[selected.id] || [];
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [selected.id, threadMessages.length, mobileView]);
  useEffect(() => {
    const dismiss = (event) => {
      if (!emojiRef.current?.contains(event.target)) setEmojiOpen(false);
      if (!filterRef.current?.contains(event.target)) setFilterOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setDialog(null);
        setEmojiOpen(false);
        setInfoOpen(false);
        setFilterOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(
    () => () => {
      attachmentUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );
  const filtered = CONTACTS.filter(
    (c) =>
      c.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) &&
      (!unreadOnly || c.unread) &&
      (filter !== 'groups' || c.group) &&
      (filter !== 'people' || !c.group)
  );
  const openThread = (contact) => {
    setSelected(contact);
    setMobileView('chat');
    setInfoOpen(false);
    setDraft('');
    setAttachment(null);
    setEmojiOpen(false);
    setNotice('');
  };
  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim() && !attachment) return;
    const message = {
      id: crypto.randomUUID(),
      own: true,
      text: draft.trim(),
      time: new Intl.DateTimeFormat('vi', { hour: '2-digit', minute: '2-digit' }).format(
        new Date()
      ),
      file: attachment,
    };
    setMessages((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] || []), message],
    }));
    setDraft('');
    setAttachment(null);
    setEmojiOpen(false);
    composerRef.current?.focus();
  };
  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Vui lòng chọn tệp nhỏ hơn 10 MB.');
      event.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    attachmentUrlRef.current.push(url);
    setAttachment({
      name: file.name,
      url,
      image: file.type.startsWith('image/'),
      size: `${(file.size / 1024).toFixed(0)} KB`,
    });
    setNotice('');
    event.target.value = '';
  };
  const previewAction = (title) =>
    setDialog({
      title,
      description:
        'Giao diện đã sẵn sàng. Chức năng này sẽ được kết nối ở bước xử lý logic tiếp theo.',
    });
  const pdf = (
    <div className="em-file">
      <span className="em-file__icon">
        <FileText size={25} />
      </span>
      <span>
        <strong>Tai_lieu_Tich_phan_co_ban.pdf</strong>
        <small>2.4 MB · PDF</small>
      </span>
      <IconButton
        label="Xem tài liệu mẫu"
        onClick={() => setDialog({ title: 'Tài liệu tích phân cơ bản', math: true })}
      >
        <Download size={18} />
      </IconButton>
    </div>
  );
  return (
    <section
      className={`em-messenger ${mobileView === 'chat' ? 'em-messenger--chat' : ''} ${infoOpen ? 'em-messenger--info' : ''}`}
      aria-label="Tin nhắn EduMatch"
    >
      <aside className="em-inbox" aria-label="Danh sách hội thoại">
        <div className="em-inbox__heading">
          <Link to={ROUTES.HOME} className="em-icon em-back" aria-label="Quay lại trang chủ">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <span className="em-eyebrow">EDUMATCH CHAT</span>
            <h1>Tin nhắn</h1>
          </div>
          <span className="em-count">{CONTACTS.length}</span>
        </div>
        <div className="em-search-row">
          <label className="em-search">
            <Search size={17} />
            <input
              aria-label="Tìm kiếm người dùng"
              placeholder="Tìm kiếm người dùng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="em-filter" ref={filterRef}>
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <ListFilter size={17} />
              <span>Lọc theo</span>
            </button>
            {filterOpen && (
              <div className="em-filter__menu">
                {[
                  ['all', 'Tất cả hội thoại'],
                  ['people', 'Cá nhân'],
                  ['groups', 'Nhóm học tập'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => {
                      setFilter(value);
                      setFilterOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="em-tabs">
          <button
            type="button"
            className={!unreadOnly ? 'is-active' : ''}
            onClick={() => setUnreadOnly(false)}
          >
            Tất cả ({CONTACTS.length})
          </button>
          <button
            type="button"
            className={unreadOnly ? 'is-active' : ''}
            onClick={() => setUnreadOnly(true)}
          >
            <MailOpen size={16} />
            Chưa đọc ({CONTACTS.filter((c) => c.unread).length})
          </button>
        </div>
        <div className="em-contacts">
          {filtered.length ? (
            filtered.map((contact) => (
              <button
                type="button"
                className={`em-contact ${selected.id === contact.id ? 'is-selected' : ''}`}
                key={contact.id}
                onClick={() => openThread(contact)}
                aria-pressed={selected.id === contact.id}
              >
                <Avatar contact={contact} />
                <span className="em-contact__copy">
                  <strong>{contact.name}</strong>
                  <span>{contact.preview}</span>
                </span>
                <span className="em-contact__meta">
                  <time>{contact.time}</time>
                  {contact.unread && <b>{contact.unread}</b>}
                </span>
              </button>
            ))
          ) : (
            <div className="em-empty">
              <Search size={27} />
              <h3>Không tìm thấy hội thoại</h3>
              <p>Thử tên khác hoặc thay đổi bộ lọc.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setUnreadOnly(false);
                  setFilter('all');
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </aside>
      <section className="em-chat" aria-label={`Trò chuyện với ${selected.name}`}>
        <div className="em-chat__head">
          <IconButton
            label="Quay lại danh sách hội thoại"
            className="em-mobile-back"
            onClick={() => {
              setMobileView('list');
              setEmojiOpen(false);
            }}
          >
            <ChevronLeft size={23} />
          </IconButton>
          <Avatar contact={selected} />
          <button
            type="button"
            className="em-chat__identity"
            onClick={() => setInfoOpen((v) => !v)}
          >
            <h2>{selected.name}</h2>
            <span>
              {selected.online ? (
                <>
                  <i className="em-online-dot" />
                  Đang hoạt động
                </>
              ) : selected.group ? (
                `${selected.id === 'toeic' ? '12' : '8'} thành viên`
              ) : (
                'Hoạt động gần đây'
              )}
            </span>
          </button>
          <div className="em-chat__actions">
            {/* <IconButton label="Gọi thoại" onClick={() => previewAction('Cuộc gọi thoại')}>
              <Phone size={19} />
            </IconButton>
            <IconButton label="Gọi video" onClick={() => previewAction('Cuộc gọi video')}>
              <Video size={20} />
            </IconButton> */}
            <IconButton
              label="Thông tin hội thoại"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((v) => !v)}
            >
              <Info size={20} />
            </IconButton>
          </div>
        </div>
        <div className="em-history" ref={historyRef} role="log" aria-label="Nội dung trò chuyện">
          <div className="em-day">Hôm nay, 15 tháng 4</div>
          {threadMessages.length ? (
            threadMessages.map((message) => (
              <div
                className={`em-message ${message.own ? 'em-message--own' : ''}`}
                key={message.id}
              >
                {!message.own && <Avatar contact={selected} />}
                <div className="em-message__body">
                  {message.text && <div className="em-bubble">{message.text}</div>}
                  {message.attachment === 'math' && (
                    <button
                      type="button"
                      className="em-math-button"
                      aria-label="Xem ảnh công thức tích phân"
                      onClick={() => setDialog({ title: 'Công thức tích phân cơ bản', math: true })}
                    >
                      <MathNote />
                      <span>
                        <Download size={17} />
                      </span>
                    </button>
                  )}
                  {message.attachment === 'pdf' && pdf}
                  {message.file &&
                    (message.file.image ? (
                      <a
                        href={message.file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="em-upload-image"
                      >
                        <img src={message.file.url} alt={message.file.name} />
                      </a>
                    ) : (
                      <a href={message.file.url} download={message.file.name} className="em-file">
                        <FileText size={23} />
                        <span>
                          <strong>{message.file.name}</strong>
                          <small>{message.file.size}</small>
                        </span>
                        <Download size={17} />
                      </a>
                    ))}
                  <div className="em-message__foot">
                    {message.reaction && (
                      <button
                        type="button"
                        className={`em-reaction ${reactions[message.id] ? 'is-active' : ''}`}
                        aria-label={`Thích tin nhắn ${message.time}`}
                        aria-pressed={!!reactions[message.id]}
                        onClick={() =>
                          setReactions((v) => ({ ...v, [message.id]: !v[message.id] }))
                        }
                      >
                        {message.reaction} <span>{reactions[message.id] ? 2 : 1}</span>
                      </button>
                    )}
                    <time>{message.time}</time>
                    {message.own && <CheckCheck size={14} />}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="em-empty">
              <BookOpen size={34} />
              <h3>Bắt đầu câu chuyện học tập</h3>
              <p>Gửi một lời chào đến {selected.name}.</p>
            </div>
          )}
        </div>
        <form className="em-composer" onSubmit={submit}>
          {notice && (
            <p className="em-notice" role="status">
              {notice}
            </p>
          )}
          {attachment && (
            <div className="em-pending">
              <Paperclip size={16} />
              <span>{attachment.name}</span>
              <IconButton label="Bỏ tệp đính kèm" onClick={() => setAttachment(null)}>
                <X size={15} />
              </IconButton>
            </div>
          )}
          <div className="em-composer__row">
            <div className="em-composer__field">
              <div className="em-emoji-anchor" ref={emojiRef}>
                <IconButton
                  label="Chọn biểu tượng cảm xúc"
                  aria-expanded={emojiOpen}
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile size={21} />
                </IconButton>
                {emojiOpen && (
                  <div className="em-emoji-panel">
                    <Suspense fallback={<p>Đang tải biểu tượng...</p>}>
                      <EmojiPicker
                        width="100%"
                        height={350}
                        theme={theme}
                        categories={[
                          { category: 'smileys_people', name: 'Cảm xúc & mọi người' },
                          { category: 'animals_nature', name: 'Động vật & thiên nhiên' },
                          { category: 'food_drink', name: 'Đồ ăn & thức uống' },
                          { category: 'travel_places', name: 'Du lịch & địa điểm' },
                          { category: 'activities', name: 'Hoạt động' },
                          { category: 'objects', name: 'Đồ vật' },
                          { category: 'symbols', name: 'Biểu tượng' },
                          { category: 'flags', name: 'Cờ' },
                        ]}
                        searchPlaceHolder="Tìm biểu tượng..."
                        previewConfig={{ showPreview: false }}
                        onEmojiClick={(emoji) => {
                          setDraft((v) => v + emoji.emoji);
                          composerRef.current?.focus();
                        }}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
              <textarea
                ref={composerRef}
                aria-label="Nhập tin nhắn"
                placeholder="Nhập tin nhắn của bạn..."
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
              />
              <IconButton
                label="Chọn ảnh"
                onClick={() => {
                  fileRef.current.accept = 'image/*';
                  fileRef.current.click();
                }}
              >
                <Image size={21} />
              </IconButton>
              <IconButton
                label="Đính kèm tệp"
                onClick={() => {
                  fileRef.current.accept = '';
                  fileRef.current.click();
                }}
              >
                <Paperclip size={21} />
              </IconButton>
              <input type="file" hidden ref={fileRef} onChange={chooseFile} />
            </div>
            <button
              type="submit"
              className="em-send"
              aria-label="Gửi tin nhắn"
              disabled={!draft.trim() && !attachment}
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </section>
      {infoOpen && (
        <button
          className="em-info-scrim"
          type="button"
          aria-label="Đóng thông tin hội thoại"
          onClick={() => setInfoOpen(false)}
        />
      )}
      <aside className="em-details" aria-label="Thông tin người học">
        <div className="em-details__top">
          <span>Thông tin hội thoại</span>
          <IconButton label="Đóng thông tin" onClick={() => setInfoOpen(false)}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="em-profile">
          <Avatar contact={selected} large />
          <div>
            <h2>{selected.name}</h2>
            <span>
              <i className="em-online-dot" />
              {selected.online ? 'Đang hoạt động' : 'Học viên EduMatch'}
            </span>
          </div>
          <IconButton
            label="Tùy chọn người dùng"
            onClick={() => previewAction('Tùy chọn hội thoại')}
          >
            <MoreVertical size={19} />
          </IconButton>
        </div>
        <dl className="em-profile-facts">
          <div>
            <Users size={19} />
            <dt className="sr-only">Vai trò</dt>
            <dd>{selected.group ? 'Nhóm học tập' : 'Sinh viên'}</dd>
          </div>
          <div>
            <GraduationCap size={20} />
            <dt className="sr-only">Trường học</dt>
            <dd>Đại học Kinh tế Quốc dân</dd>
          </div>
          <div>
            <MapPin size={19} />
            <dt className="sr-only">Khu vực</dt>
            <dd>Hà Nội, Việt Nam</dd>
          </div>
          <div>
            <FileText size={19} />
            <dt className="sr-only">Mối quan tâm</dt>
            <dd>Quan tâm: TOEIC, Tiếng Anh giao tiếp, Kỹ năng thuyết trình</dd>
          </div>
        </dl>
        <div className="em-profile-actions">
          <button type="button" onClick={() => previewAction('Hồ sơ người học')}>
            <Users size={17} />
            Xem hồ sơ
          </button>
          <button type="button" onClick={() => previewAction('Tạo lớp học')}>
            <BookOpen size={19} />
            Tạo lớp học
          </button>
        </div>
        <section className="em-detail-section">
          <div className="em-section-heading">
            <h3>Ảnh & tệp đã chia sẻ</h3>
            <button
              type="button"
              onClick={() => setDialog({ title: 'Ảnh & tệp đã chia sẻ', gallery: true })}
            >
              Xem tất cả
            </button>
          </div>
          <div className="em-media">
            <button
              type="button"
              aria-label="Xem ảnh công thức"
              onClick={() => setDialog({ title: 'Công thức tích phân', math: true })}
            >
              <MathNote small />
            </button>
            <button
              type="button"
              className="em-book"
              aria-label="Xem tài liệu tiếng Anh"
              onClick={() => previewAction('English for Career Growth')}
            >
              <BookOpen size={19} />
              <strong>
                English
                <br />
                for Career
                <br />
                Growth
              </strong>
              <small>LEARN • GROW • CONNECT</small>
            </button>
            <button
              type="button"
              className="em-campus"
              aria-label="Xem ảnh trường học"
              onClick={() => previewAction('Không gian học tập')}
            >
              <GraduationCap size={30} />
              <small>EDUMATCH</small>
            </button>
            <button
              type="button"
              className="em-media-more"
              onClick={() => setDialog({ title: 'Ảnh & tệp đã chia sẻ', gallery: true })}
            >
              +3
            </button>
          </div>
        </section>
        <section className="em-detail-section">
          <h3>Liên kết nhanh</h3>
          <div className="em-quick-links">
            <Link to={`${ROUTES.HOME}#khoa-hoc`}>
              <Search size={19} />
              <span>Tìm kiếm lớp học cùng chủ đề</span>
              <ArrowUpRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => previewAction(`Các khóa học của ${selected.name}`)}
            >
              <BookOpen size={19} />
              <span>Xem các khóa học của {selected.name}</span>
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                fileRef.current.accept = '';
                fileRef.current.click();
                setInfoOpen(false);
              }}
            >
              <FileText size={19} />
              <span>Chia sẻ tài liệu học tập</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="em-detail-section em-notes">
          <div className="em-section-heading">
            <h3>Ghi chú</h3>
            <Plus size={17} />
          </div>
          <label>
            <FileText size={18} />
            <textarea
              aria-label="Ghi chú về người học"
              placeholder="Thêm ghi chú về người học này..."
              rows={2}
              value={notes[selected.id] || ''}
              onChange={(e) =>
                setNotes((current) => ({ ...current, [selected.id]: e.target.value }))
              }
            />
          </label>
        </section>
      </aside>
      {dialog && (
        <div className="em-dialog-backdrop" onClick={() => setDialog(null)}>
          <section
            className="em-dialog"
            role="dialog"
            aria-modal="true"
            ref={dialogRef}
            aria-labelledby="em-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 id="em-dialog-title">{dialog.title}</h2>
              <IconButton label="Đóng cửa sổ" onClick={() => setDialog(null)} autoFocus>
                <X size={20} />
              </IconButton>
            </div>
            {dialog.math ? (
              <MathNote />
            ) : dialog.gallery ? (
              <>
                <MathNote />
                {pdf}
                <div className="em-gallery-note">
                  <BookOpen size={20} />
                  English for Career Growth
                </div>
              </>
            ) : (
              <p>{dialog.description}</p>
            )}
            <button type="button" className="em-dialog-close" onClick={() => setDialog(null)}>
              Đóng
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

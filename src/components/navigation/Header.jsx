import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CheckCheck,
  GraduationCap,
  Heart,
  Info,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  Phone,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
<<<<<<< HEAD
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
=======
import { useChat } from '@/hooks/useChat';
>>>>>>> cef2f193afa2324639793ed4c7de8c9cdea456ca
import { ROUTES } from '@/constants/routes';
import { accountNotificationService } from '@/services/accountNotificationService';
import { subscribeUserNotifications } from '@/services/pusherService';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/features/learning/marketplace';
import toast from 'react-hot-toast';

const notificationIcon = (type) => {
  if (type === 'post_like' || type === 'profile_like') return <Heart size={15} />;
  if (type === 'post_comment' || type === 'comment_reply' || type === 'course_comment') return <MessageCircle size={15} />;
  return <Info size={15} />;
};

const notificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
};

export const Header = ({ theme, onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationKey = `${location.pathname}${location.search}${location.hash}`;
  const [notificationPanel, setNotificationPanel] = useState({ open: false, locationKey: '' });
  const { isAuthenticated, user, token, logout } = useAuth();
  const { counts: chatCounts } = useChat();
  const [notifications, setNotifications] = useState(() => user?.id ? getNotifications(user.id) : []);
  const [serverNotifications, setServerNotifications] = useState({ userId: null, items: [] });
  const receivedServerNotificationIds = useRef(new Set());
  const accountMenuRef = useRef(null);
  const allNotifications = [...(serverNotifications.userId === user?.id ? serverNotifications.items : []), ...notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const isEducationProvider = isAuthenticated && ['teacher', 'center'].includes(user?.role);
  const isCenterAccount = isAuthenticated && user?.role === 'center';
  const teachingDestination = isEducationProvider ? ROUTES.CREATE_COURSE : ROUTES.REGISTER;
  const teachingLabel = isEducationProvider ? 'Thêm khóa học' : 'Đăng ký dạy';
  const unreadNotifications = allNotifications.filter((notification) => !notification.isRead).length;
  const unreadMessageCount = isAuthenticated ? chatCounts.unread_messages : 0;
  const notificationOpen = notificationPanel.open && notificationPanel.locationKey === locationKey;
  const userAvatarUrl = user?.avatar
    ? (user.avatarVersion && !user.avatar.startsWith('data:image/') && !user.avatar.startsWith('blob:')
        ? `${user.avatar}${user.avatar.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.avatarVersion)}`
        : user.avatar)
    : '';
  const avatarKey = `${userAvatarUrl}-${user?.avatarVersion || ''}`;
  const [failedAvatarKey, setFailedAvatarKey] = useState(null);
  const isAvatarVisible = Boolean(userAvatarUrl && failedAvatarKey !== avatarKey);

  useEffect(() => {
    const refreshNotifications = () => setNotifications(user?.id ? getNotifications(user.id) : []);
    refreshNotifications();
    window.addEventListener('edumatch:notifications-updated', refreshNotifications);
    return () => window.removeEventListener('edumatch:notifications-updated', refreshNotifications);
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      receivedServerNotificationIds.current = new Set();
      return undefined;
    }
    let active = true;
    accountNotificationService.list().then((items) => {
      if (!active) return;
      items.forEach((item) => receivedServerNotificationIds.current.add(item.id));
      setServerNotifications((current) => {
        const existing = current.userId === user.id ? current.items : [];
        return { userId: user.id, items: [...existing, ...items.filter((item) => !existing.some((previous) => previous.id === item.id))] };
      });
    }).catch(() => { /* The next login still attempts the initial history load. */ });
    const unsubscribe = subscribeUserNotifications(user.id, (notification) => {
      if (!notification?.id || receivedServerNotificationIds.current.has(notification.id)) return;
      receivedServerNotificationIds.current.add(notification.id);
      setServerNotifications((current) => ({
        userId: user.id,
        items: [notification, ...current.items.filter((item) => item.id !== notification.id)],
      }));
      toast(<div><strong>{notification.title || 'Bạn có thông báo mới'}</strong>{notification.description && <p>{notification.description}</p>}</div>, {
        icon: '🔔',
        duration: 5000,
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAuthenticated, user?.id, token]);

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeAccountMenu);
    return () => document.removeEventListener('mousedown', closeAccountMenu);
  }, []);

  const openNotification = (notificationId) => {
    if (String(notificationId).startsWith('server-')) {
      const item = serverNotifications.items.find((record) => record.id === notificationId);
      if (item) accountNotificationService.read(item.server_id).then(() => {
        setServerNotifications((current) => ({ ...current, items: current.items.map((n) => n.id === notificationId ? { ...n, isRead: true } : n) }));
      }).catch(() => {});
    } else markNotificationRead(notificationId);
    setNotificationPanel({ open: false, locationKey });
  };
  const markAllAsRead = () => {
    if (user?.id) {
      markAllNotificationsRead(user.id);
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    }
    setServerNotifications((current) => ({ ...current, items: current.items.map((notification) => ({ ...notification, isRead: true })) }));
    accountNotificationService.readAll().catch(() => {});
  };
  const toggleNotifications = () => {
    markAllAsRead();
    setNotificationPanel((current) => ({
      open: !(current.open && current.locationKey === locationKey),
      locationKey,
    }));
  };
  const readAllNotifications = () => {
    markAllAsRead();
  };
  const openDialog = (name) => {
    setMobileMenuOpen(false);
    navigate({ pathname: ROUTES.HOME, search: `?dialog=${name}` });
  };
  const search = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('need-description').trim();
    navigate({
      pathname: ROUTES.SEARCH_RESULTS,
      search: `?need=${encodeURIComponent(value)}`,
    });
    setMobileMenuOpen(false);
  };
  const openOwnProfile = (event) => {
    if (location.pathname !== ROUTES.TEACHER_PROFILE(user?.id)) return;
    event.preventDefault();
    window.location.reload();
  };

  return (
    <header className="edu-header">
      <a className="skip-link" href="#khoa-hoc">
        Đi đến nội dung chính
      </a>
      <div className="edu-container header-inner">
        <Link to={ROUTES.HOME} className="edu-brand" title="EduMatch - Về trang chủ">
          <span className="brand-symbol">
            E<span />
          </span>
          <span>
            Edu<span className="accent-text">Match</span>
          </span>
        </Link>
        <form className="header-search" role="search" onSubmit={search}>
          <Search size={16} aria-hidden="true" />
          <input
            key={params.get('need') || ''}
            name="need-description"
            defaultValue={params.get('need') || ''}
            aria-label="Tìm khóa học và giáo viên qua mô tả nhu cầu"
            placeholder="Mô tả nhu cầu học của bạn..."
          />
          <kbd>↵</kbd>
        </form>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <Link to={`${ROUTES.HOME}#khoa-hoc`}>
            <GraduationCap size={16} />
            Tìm kiếm lớp học
          </Link>
          <Link to={ROUTES.FEED}><Newspaper size={16} /> Bảng Tin</Link>
          <Link to={teachingDestination}>{teachingLabel}</Link>
          {isCenterAccount ? (
            <Link className="consultation-nav" to={ROUTES.CENTER_SUPPORT}>
              <Phone size={14} />
              Tư vấn miễn phí
            </Link>
          ) : (
            <button className="consultation-nav" onClick={() => openDialog('consultation')}>
              <Phone size={14} />
              Tư vấn miễn phí
            </button>
          )}
          {isAuthenticated && (
            <Link to={ROUTES.MESSAGES} className="teacher-action-link">
              <MessageCircle size={15} /> Tin nhắn {unreadMessageCount > 0 && <b className="message-count">{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</b>}
            </Link>
          )}
          {isAuthenticated && <div className="notification-menu">
            <button
              type="button"
              className="notification-trigger"
              onClick={toggleNotifications}
              aria-label={`Thông báo${unreadNotifications ? `, ${unreadNotifications} chưa đọc` : ''}`}
              aria-expanded={notificationOpen}
            >
              <Bell size={17} />
              {unreadNotifications > 0 && <b>{unreadNotifications > 99 ? '99+' : unreadNotifications}</b>}
            </button>
            {notificationOpen && <section className="notification-popover" aria-label="Danh sách thông báo">
              <header><div><strong>Thông báo</strong><span>{unreadNotifications ? `${unreadNotifications} chưa đọc` : 'Bạn đã đọc tất cả'}</span></div><button type="button" onClick={readAllNotifications} disabled={!unreadNotifications}><CheckCheck size={15} /> Đánh dấu đã đọc</button></header>
              <div className="notification-popover__list">
                {allNotifications.length ? allNotifications.slice(0, 8).map((notification) => <Link
                  to={notification.link || ROUTES.HOME}
                  key={notification.id}
                  className={!notification.isRead ? 'is-unread' : ''}
                  onClick={() => openNotification(notification.id)}
                >
                  {notification.actorAvatar ? <img src={notification.actorAvatar} alt="" /> : <span className="notification-type-icon">{notificationIcon(notification.type)}</span>}
                  <div><strong>{notification.title}</strong>{notification.description && <p>{notification.description}</p>}<small>{notificationTime(notification.createdAt)}</small></div>
                  {!notification.isRead && <i aria-label="Chưa đọc" />}
                </Link>) : <div className="notification-popover__empty"><Bell size={21} /><strong>Chưa có thông báo</strong><p>Các cập nhật về bài viết, khóa học và hoạt động sẽ hiển thị tại đây.</p></div>}
              </div>
            </section>}
          </div>}
        </nav>
        <div className="header-auth">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
            }
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {isAuthenticated ? (
            <>
              <div className="account-menu" ref={accountMenuRef}>
                <button type="button" className="account-menu__trigger user-name" onClick={() => setAccountMenuOpen((current) => !current)} aria-expanded={accountMenuOpen} aria-haspopup="menu" title="Mở tùy chọn tài khoản">
                  <span className="account-menu__avatar" aria-hidden="true">
                    {isAvatarVisible ? (
                      <img
                        key={avatarKey}
                        src={userAvatarUrl}
                        alt=""
                        onError={() => setFailedAvatarKey(avatarKey)}
                      />
                    ) : (
                      <span className="account-menu__avatar-fallback"><DefaultRoleAvatar role={user?.role} size={16} /></span>
                    )}
                  </span>
                  <span className="account-menu__name">{user?.name}</span>
                </button>
                {accountMenuOpen && <div className="account-menu__popover" role="menu" aria-label="Tùy chọn tài khoản">
                  <Link role="menuitem" to={user.role === 'student' ? ROUTES.PROFILE : ROUTES.TEACHER_PROFILE(user.id)} onClick={(event) => { setAccountMenuOpen(false); if (user.role !== 'student') openOwnProfile(event); }}>{user?.name}</Link>
                  <Link role="menuitem" to={`${ROUTES.PROFILE}?tab=security`} onClick={() => setAccountMenuOpen(false)}>Thông tin và bảo mật</Link>
                  <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); logout(); }}>Đăng xuất</button>
                </div>}
              </div>
            </>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className="login-link">
                Đăng nhập
              </Link>
              <Link to={ROUTES.REGISTER} className="edu-button register-button">
                Đăng ký
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen((current) => !current)}
          aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="Điều hướng trên điện thoại"
        >
          <form className="header-search" role="search" onSubmit={search}>
            <Search size={18} />
            <input
              name="need-description"
              aria-label="Tìm khóa học và giáo viên qua mô tả trên điện thoại"
              placeholder="Mô tả nhu cầu học của bạn..."
            />
            <button type="submit" aria-label="Tìm kiếm">
              <ArrowRight size={19} />
            </button>
          </form>
          <Link to={`${ROUTES.HOME}#khoa-hoc`} onClick={() => setMobileMenuOpen(false)}>
            Tìm kiếm lớp học
          </Link>
          <Link to={ROUTES.FEED} onClick={() => setMobileMenuOpen(false)}>Bảng Tin</Link>
          <Link to={teachingDestination} onClick={() => setMobileMenuOpen(false)}>{teachingLabel}</Link>
          {isEducationProvider && <Link to={ROUTES.VERIFICATION} onClick={() => setMobileMenuOpen(false)}>Xác minh hồ sơ</Link>}
          {isCenterAccount ? (
            <Link to={ROUTES.CENTER_SUPPORT} onClick={() => setMobileMenuOpen(false)}>Tư vấn miễn phí</Link>
          ) : (
            <button onClick={() => openDialog('consultation')}>Tư vấn miễn phí</button>
          )}
          {isAuthenticated && <Link to={ROUTES.MESSAGES} onClick={() => setMobileMenuOpen(false)}>Tin nhắn</Link>}
          {isAuthenticated && <button onClick={toggleNotifications}>Thông báo{unreadNotifications ? ` (${unreadNotifications})` : ''}</button>}
          {isAuthenticated && notificationOpen && <section className="mobile-notification-panel" aria-label="Danh sách thông báo">
            <header><strong>Thông báo</strong><button type="button" onClick={readAllNotifications} disabled={!unreadNotifications}>Đánh dấu đã đọc</button></header>
            {allNotifications.length ? allNotifications.slice(0, 8).map((notification) => <Link
              to={notification.link || ROUTES.HOME}
              key={notification.id}
              className={!notification.isRead ? 'is-unread' : ''}
              onClick={() => openNotification(notification.id)}
            >
              <span className="notification-type-icon">{notification.actorAvatar ? <img src={notification.actorAvatar} alt="" /> : notificationIcon(notification.type)}</span>
              <span><strong>{notification.title}</strong><small>{notificationTime(notification.createdAt)}</small></span>
            </Link>) : <p>Chưa có thông báo nào.</p>}
          </section>}
          {isAuthenticated && (
            <Link
              to={user.role === 'student' ? ROUTES.PROFILE : ROUTES.TEACHER_PROFILE(user.id)}
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-navigation__profile-link"
            >
              <span className="account-menu__avatar" aria-hidden="true">
                {isAvatarVisible ? (
                  <img
                    key={`mobile-${avatarKey}`}
                    src={userAvatarUrl}
                    alt=""
                    onError={() => setFailedAvatarKey(avatarKey)}
                  />
                ) : (
                  <span className="account-menu__avatar-fallback"><DefaultRoleAvatar role={user?.role} size={16} /></span>
                )}
              </span>
              <span>Trang cá nhân ({user?.name})</span>
            </Link>
          )}
          {isAuthenticated && <Link to={`${ROUTES.PROFILE}?tab=security`} onClick={() => setMobileMenuOpen(false)}>Thông tin và bảo mật</Link>}
          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} onClick={() => setMobileMenuOpen(false)}>Đăng nhập</Link>
              <Link to={ROUTES.REGISTER} onClick={() => setMobileMenuOpen(false)}>Đăng ký</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;

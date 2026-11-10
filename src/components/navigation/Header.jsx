import { useContext, useEffect, useRef, useState } from 'react';
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
  Newspaper,
  PartyPopper,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DefaultRoleAvatar, resolveAvatarSource } from '@/components/common/DefaultRoleAvatar';
import { useChat } from '@/hooks/useChat';
import { ROUTES } from '@/constants/routes';
import { AccountNotificationContext } from '@/contexts/AccountNotificationContext';
import {
  formatNotificationCopy,
  isApprovedVerificationNotification,
  notificationDestination,
} from '@/utils/accountNotificationCopy';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/features/learning/marketplace';
import './header.css';

const notificationIcon = (type, notification) => {
  if (isApprovedVerificationNotification(notification)) return <PartyPopper size={15} />;
  if (type === 'verification_result') return <ShieldCheck size={15} />;
  if (type === 'post_like' || type === 'profile_like') return <Heart size={15} />;
  if (type === 'post_comment' || type === 'comment_reply' || type === 'course_comment') return <MessageCircle size={15} />;
  return <Info size={15} />;
};

const notificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
};

export const Header = () => {
  const [mobilePanel, setMobilePanel] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationKey = `${location.pathname}${location.search}${location.hash}`;
  const activeMobilePanel = mobilePanel?.locationKey === locationKey ? mobilePanel.name : null;
  const [notificationPanel, setNotificationPanel] = useState({ open: false, locationKey: '' });
  const { isAuthenticated, user, logout, canUseStudentConsultation } = useAuth();
  const { counts: chatCounts } = useChat();
  const [notifications, setNotifications] = useState(() => user?.id ? getNotifications(user.id) : []);
  const { items: serverNotifications, read, readAll } = useContext(AccountNotificationContext);
  const accountMenuRef = useRef(null);
  const desktopNotificationRef = useRef(null);
  const headerRef = useRef(null);
  const mobileSearchTriggerRef = useRef(null);
  const mobileSearchPanelRef = useRef(null);
  const mobileNotificationTriggerRef = useRef(null);
  const mobileNotificationPopoverRef = useRef(null);
  const mobileMenuTriggerRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const notificationOpen = notificationPanel.open && notificationPanel.locationKey === locationKey;

  useEffect(() => {
    if (!activeMobilePanel && !notificationOpen && !accountMenuOpen) return;

    const closePanelsOutside = (event) => {
      const target = event.target;
      if (activeMobilePanel === 'menu') {
        if (!mobileMenuTriggerRef.current?.contains(target) && !mobileMenuRef.current?.contains(target)) {
          setMobilePanel(null);
        }
      }
      if (activeMobilePanel === 'search') {
        if (!mobileSearchTriggerRef.current?.contains(target) && !mobileSearchPanelRef.current?.contains(target)) {
          setMobilePanel(null);
        }
      }
      if (notificationOpen) {
        if (
          !desktopNotificationRef.current?.contains(target)
          && !mobileNotificationTriggerRef.current?.contains(target)
          && !mobileNotificationPopoverRef.current?.contains(target)
        ) {
          setNotificationPanel({ open: false, locationKey });
        }
      }
      if (accountMenuOpen) {
        if (!accountMenuRef.current?.contains(target)) {
          setAccountMenuOpen(false);
        }
      }
    };

    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (activeMobilePanel) setMobilePanel(null);
      if (notificationOpen) setNotificationPanel({ open: false, locationKey });
      if (accountMenuOpen) setAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', closePanelsOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePanelsOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeMobilePanel, notificationOpen, accountMenuOpen, locationKey]);

  useEffect(() => {
    const header = headerRef.current;
    const site = header?.closest('.edu-site');
    if (!header || !site) return;
    const measure = () => site.style.setProperty('--edu-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    return () => {
      observer.disconnect();
      site.style.removeProperty('--edu-header-height');
    };
  }, []);
  const allNotifications = [...serverNotifications, ...notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const isEducationProvider = isAuthenticated && ['teacher', 'center'].includes(user?.role);
  const isCenterAccount = isAuthenticated && user?.role === 'center';
  const teachingDestination = isEducationProvider ? ROUTES.CREATE_COURSE : ROUTES.REGISTER;
  const teachingLabel = isEducationProvider ? 'Thêm khóa học' : 'Đăng ký dạy';
  const unreadNotifications = allNotifications.filter((notification) => !notification.isRead).length;
  // Hiển thị số người/hội thoại có tin nhắn mới (chưa đọc), thay vì tổng số tin nhắn
  const unreadConversationCount = isAuthenticated ? (chatCounts.unread || 0) : 0;
  const resolvedUserAvatar = resolveAvatarSource(user?.avatar, user?.id);
  const userAvatarUrl = resolvedUserAvatar
    ? (user?.avatarVersion && !resolvedUserAvatar.startsWith('data:image/') && !resolvedUserAvatar.startsWith('blob:')
        ? `${resolvedUserAvatar}${resolvedUserAvatar.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.avatarVersion)}`
        : resolvedUserAvatar)
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

  const openNotification = (notificationId) => {
    if (String(notificationId).startsWith('server-')) {
      const item = serverNotifications.find((record) => record.id === notificationId);
      if (item?.type === 'verification_result') {
        window.dispatchEvent(new Event('edumatch:verification-celebrate'));
      }
      if (item) read(item);
    } else markNotificationRead(notificationId);
    setNotificationPanel({ open: false, locationKey });
  };
  const markAllAsRead = () => {
    if (user?.id) {
      markAllNotificationsRead(user.id);
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    }
    readAll();
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
  const closeMobilePanels = () => {
    setMobilePanel(null);
    if (notificationOpen) setNotificationPanel({ open: false, locationKey });
  };
  const toggleMobilePanel = (name) => {
    if (notificationOpen) setNotificationPanel({ open: false, locationKey });
    setMobilePanel(activeMobilePanel === name ? null : { name, locationKey });
  };
  const toggleMobileNotifications = () => {
    setMobilePanel(null);
    toggleNotifications();
  };
  const openStudentConsultation = () => {
    setMobilePanel(null);
    navigate({ pathname: ROUTES.HOME, search: '?dialog=consultation' });
  };
  const search = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('need-description').trim();
    navigate({
      pathname: ROUTES.SEARCH_RESULTS,
      search: `?need=${encodeURIComponent(value)}`,
    });
    setMobilePanel(null);
  };
  const openOwnProfile = (event) => {
    if (location.pathname !== ROUTES.TEACHER_PROFILE(user?.id)) return;
    event.preventDefault();
    window.location.reload();
  };
  const renderNotificationPopover = (className, id, ref = null) => (
    <section id={id} ref={ref} className={className} aria-label="Danh sách thông báo">
      <header><div><strong>Thông báo</strong><span>{unreadNotifications ? `${unreadNotifications} chưa đọc` : 'Bạn đã đọc tất cả'}</span></div><button type="button" onClick={readAllNotifications} disabled={!unreadNotifications}><CheckCheck size={15} /> Đánh dấu đã đọc</button></header>
      <div className="notification-popover__list">
        {allNotifications.length ? allNotifications.slice(0, 8).map((notification) => {
          const copy = formatNotificationCopy(notification, isCenterAccount);
          return <Link
            to={notificationDestination(notification)}
            key={notification.id}
            className={!notification.isRead ? 'is-unread' : ''}
            onClick={() => openNotification(notification.id)}
          >
            {notification.actorAvatar ? <img src={notification.actorAvatar} alt="" /> : <span className={`notification-type-icon${isApprovedVerificationNotification(notification) ? ' is-celebration' : ''}`}>{notificationIcon(notification.type, notification)}</span>}
            <div><strong>{copy.title}</strong>{copy.description && <p>{copy.description}</p>}<small>{notificationTime(notification.createdAt)}</small></div>
            {!notification.isRead && <i aria-label="Chưa đọc" />}
          </Link>;
        }) : <div className="notification-popover__empty"><Bell size={21} /><strong>Chưa có thông báo</strong><p>Các cập nhật về bài viết, khóa học và hoạt động sẽ hiển thị tại đây.</p></div>}
      </div>
    </section>
  );

  return (
    <header className="edu-header" ref={headerRef}>
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
          {canUseStudentConsultation && (
            <button type="button" className="consultation-nav" onClick={openStudentConsultation}>
              <Phone size={14} />
              Tư vấn miễn phí
            </button>
          )}
          {isAuthenticated && (
            <Link to={ROUTES.MESSAGES} className="teacher-action-link">
              <MessageCircle size={15} /> Tin nhắn {unreadConversationCount > 0 && <b className="message-count">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}
            </Link>
          )}
          {isAuthenticated && <div className="notification-menu" ref={desktopNotificationRef}>
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
            {notificationOpen && renderNotificationPopover('notification-popover')}
          </div>}
        </nav>
        <div className="header-auth">
          <nav className="mobile-header-shortcuts" aria-label="Lối tắt trên điện thoại">
            <button
              type="button"
              ref={mobileSearchTriggerRef}
              onClick={() => toggleMobilePanel('search')}
              aria-label="Tìm kiếm"
              aria-expanded={activeMobilePanel === 'search'}
              aria-controls={activeMobilePanel === 'search' ? 'mobile-header-search' : undefined}
              title="Tìm kiếm"
            >
              <Search size={18} aria-hidden="true" />
            </button>
            <Link
              to={ROUTES.FEED}
              onClick={closeMobilePanels}
              aria-current={location.pathname === ROUTES.FEED ? 'page' : undefined}
              aria-label="Bảng tin"
              title="Bảng tin"
            >
              <Newspaper size={18} aria-hidden="true" />
            </Link>
            <Link
              to={ROUTES.MESSAGES}
              onClick={closeMobilePanels}
              aria-label={`Tin nhắn${unreadConversationCount ? `, ${unreadConversationCount} cuộc trò chuyện chưa đọc` : ''}`}
              title="Tin nhắn"
            >
              <MessageCircle size={18} aria-hidden="true" />
              {unreadConversationCount > 0 && <b aria-hidden="true">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}
            </Link>
            {isAuthenticated ? (
              <button
                type="button"
                ref={mobileNotificationTriggerRef}
                onClick={toggleMobileNotifications}
                aria-label={`Thông báo${unreadNotifications ? `, ${unreadNotifications} chưa đọc` : ''}`}
                aria-expanded={notificationOpen}
                aria-controls={notificationOpen ? 'mobile-header-notifications' : undefined}
                title="Thông báo"
              >
                <Bell size={18} aria-hidden="true" />
                {unreadNotifications > 0 && <b aria-hidden="true">{unreadNotifications > 99 ? '99+' : unreadNotifications}</b>}
              </button>
            ) : (
              <Link to={ROUTES.LOGIN} state={{ from: location }} onClick={closeMobilePanels} aria-label="Thông báo" title="Thông báo">
                <Bell size={18} aria-hidden="true" />
              </Link>
            )}
          </nav>
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
                      <span className="account-menu__avatar-fallback"><DefaultRoleAvatar role={user?.role} name={user?.name} userId={user?.id} size={16} /></span>
                    )}
                  </span>
                  <span className="account-menu__name">{user?.name}</span>
                </button>
                {accountMenuOpen && <div className="account-menu__popover" role="menu" aria-label="Tùy chọn tài khoản">
            <Link role="menuitem" to={ROUTES.TEACHER_PROFILE(user.id)} onClick={(event) => { setAccountMenuOpen(false); openOwnProfile(event); }}>{user?.name}</Link>
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
          type="button"
          className="mobile-menu-toggle"
          ref={mobileMenuTriggerRef}
          onClick={() => toggleMobilePanel('menu')}
          aria-label={activeMobilePanel === 'menu' ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={activeMobilePanel === 'menu'}
          aria-controls={activeMobilePanel === 'menu' ? 'mobile-navigation' : undefined}
        >
          {activeMobilePanel === 'menu' ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {isAuthenticated && notificationOpen && renderNotificationPopover('notification-popover mobile-header-notifications', 'mobile-header-notifications', mobileNotificationPopoverRef)}
      {activeMobilePanel === 'search' && (
        <div
          id="mobile-header-search"
          ref={mobileSearchPanelRef}
          className="mobile-header-search"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            closeMobilePanels();
            mobileSearchTriggerRef.current?.focus();
          }}
        >
          <form className="header-search" role="search" onSubmit={search}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              name="need-description"
              defaultValue={params.get('need') || ''}
              aria-label="Tìm khóa học và giáo viên qua mô tả trên điện thoại"
              placeholder="Mô tả nhu cầu học của bạn..."
              enterKeyHint="search"
              autoFocus
            />
            <button type="submit" aria-label="Tìm kiếm">
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
      {activeMobilePanel === 'menu' && (
        <nav id="mobile-navigation" ref={mobileMenuRef} className="mobile-navigation" aria-label="Điều hướng trên điện thoại">
          {isAuthenticated && (
            <Link
              to={ROUTES.TEACHER_PROFILE(user.id)}
              onClick={(event) => { closeMobilePanels(); openOwnProfile(event); }}
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
                  <span className="account-menu__avatar-fallback"><DefaultRoleAvatar role={user?.role} name={user?.name} userId={user?.id} size={16} /></span>
                )}
              </span>
              <span>{user?.name}</span>
            </Link>
          )}
          <Link to={teachingDestination} onClick={closeMobilePanels}>{teachingLabel}</Link>
          {isCenterAccount && <Link to={ROUTES.VERIFICATION} onClick={closeMobilePanels}>Xác minh hồ sơ</Link>}
          {canUseStudentConsultation && (
            <button type="button" onClick={openStudentConsultation}>Tư vấn miễn phí</button>
          )}
          {isAuthenticated && <Link to={`${ROUTES.PROFILE}?tab=security`} onClick={closeMobilePanels}>Thông tin và bảo mật</Link>}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                closeMobilePanels();
                logout();
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} onClick={closeMobilePanels}>Đăng nhập</Link>
              <Link to={ROUTES.REGISTER} onClick={closeMobilePanels}>Đăng ký</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;

import { useEffect } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/navigation/Footer';
import { useDesktopChat } from '@/hooks/useDesktopChat';
import { FloatingChat } from '@/components/messages/FloatingChat';
import { ROUTES } from '@/constants/routes';

export const MainLayout = () => {
  const { pathname, hash } = useLocation();
  const isMessaging = pathname.replace(/\/$/, '') === ROUTES.MESSAGES;
  const isPostDetail = Boolean(useMatch(ROUTES.POST_DETAIL()));
  const desktopChat = useDesktopChat();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return (
    <div className={`edu-site min-h-dvh flex flex-col${isMessaging ? ' edu-site--messaging' : ''}${isPostDetail ? ' edu-site--post-detail' : ''}`}>
      {!isMessaging && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!isMessaging && !isPostDetail && <Footer />}
      {!isMessaging && !isPostDetail && desktopChat && <FloatingChat />}
    </div>
  );
};

export default MainLayout;

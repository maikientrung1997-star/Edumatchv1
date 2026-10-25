import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/navigation/Footer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { FloatingChat } from '@/components/messages/FloatingChat';
import { ROUTES } from '@/constants/routes';

export const MainLayout = () => {
  const { pathname, hash } = useLocation();
  const isMessaging = pathname.replace(/\/$/, '') === ROUTES.MESSAGES;
  const [theme, setTheme] = useLocalStorage('edumatch:theme', 'system');
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event) => setSystemDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
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
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  return (
    <div className="edu-site min-h-dvh flex flex-col" data-theme={resolvedTheme}>
      {!isMessaging && (
        <Header
          theme={resolvedTheme}
          onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        />
      )}
      <main className="flex-1">
        <Outlet context={{ theme: resolvedTheme }} />
      </main>
      {!isMessaging && <Footer />}
      {!isMessaging && <FloatingChat />}
    </div>
  );
};

export default MainLayout;

import { useEffect, useEffectEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { accountNotificationService } from '@/services/accountNotificationService';
import { subscribeUserNotifications } from '@/services/pusherService';
import { soundService } from '@/services/soundService';
import {
  formatNotificationCopy,
  isApprovedVerificationNotification,
  notificationDestination,
} from '@/utils/accountNotificationCopy';
import { AccountNotificationContext } from './AccountNotificationContext';

const TOASTER_ID = 'account-notifications';
const SUBSCRIBE_WAIT_MS = 3000;

function mergeHistory(current, history) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of history) {
    byId.set(item.id, byId.get(item.id)?.isRead ? { ...item, isRead: true } : item);
  }
  return [...byId.values()];
}

export function AccountNotificationProvider({ children }) {
  const { isAuthenticated, user, token } = useAuth();
  const userId = isAuthenticated ? user?.id : null;
  const isCenterAccount = user?.role === 'center';
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({ token: null, items: [] });
  const items = userId && notifications.token === token ? notifications.items : [];
  const showIncomingToast = useEffectEvent((notification) => {
    const copy = formatNotificationCopy(notification, isCenterAccount);
    if (notification.type === 'verification_result') {
      window.dispatchEvent(new Event('edumatch:verification-updated'));
    }
    toast(
      (t) => {
        const open = () => {
          toast.dismiss(t.id, TOASTER_ID);
          window.dispatchEvent(new Event('edumatch:verification-celebrate'));
          navigate(notificationDestination(notification));
        };
        return (
          <div
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={open}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') open();
            }}
          >
            <strong>{copy.title}</strong>
            {copy.description && <p>{copy.description}</p>}
          </div>
        );
      },
      {
        toasterId: TOASTER_ID,
        icon: isApprovedVerificationNotification(notification) ? '🎉' : '🔔',
        duration: 6000,
      }
    );
  });

  useEffect(() => {
    if (!userId) return;
    const seen = new Set();
    let active = true;
    let historyStarted = false;
    let historyLoaded = false;
    let loadingHistory = false;
    let reloadAfterCurrent = false;

    async function loadHistory() {
      if (loadingHistory) {
        reloadAfterCurrent = true;
        return;
      }
      historyStarted = true;
      loadingHistory = true;
      try {
        const history = await accountNotificationService.list();
        if (!active || !Array.isArray(history)) return;
        const missed = historyLoaded
          ? history.filter((item) => !item.isRead && !seen.has(item.id))
          : [];
        history.forEach((item) => seen.add(item.id));
        historyLoaded = true;
        setNotifications((current) => ({
          token,
          items: mergeHistory(current.token === token ? current.items : [], history),
        }));
        missed.reverse().forEach((item) => showIncomingToast(item));
      } catch {
        // A later successful subscription can retry the history request.
      } finally {
        loadingHistory = false;
        if (active && reloadAfterCurrent) {
          reloadAfterCurrent = false;
          void loadHistory();
        }
      }
    }

    // Wait for the channel before reading history so a new event cannot fall into the gap.
    // If Pusher is unavailable, allow one history request even without a subscription.
    const loadInitialHistory = () => {
      if (!historyStarted) void loadHistory();
    };
    const fallback = window.setTimeout(loadInitialHistory, SUBSCRIBE_WAIT_MS);
    const unsubscribe = subscribeUserNotifications(userId, (notification) => {
      if (!active || !notification?.id || seen.has(notification.id)) return;
      seen.add(notification.id);
      setNotifications((current) => ({
        token,
        items: [notification, ...(current.token === token ? current.items.filter((item) => item.id !== notification.id) : [])],
      }));
      showIncomingToast(notification);
      soundService.playNotificationSound();
    }, {
      onSubscribed: () => {
        window.clearTimeout(fallback);
        // A re-subscription can follow a disconnect during which events were missed.
        void loadHistory();
      },
      onSubscriptionError: () => {
        window.clearTimeout(fallback);
        loadInitialHistory();
      },
    });

    return () => {
      active = false;
      window.clearTimeout(fallback);
      unsubscribe();
      toast.removeAll(TOASTER_ID);
    };
  }, [userId, token]);

  const markRead = (ids) => {
    setNotifications((current) => current.token === token ? {
      ...current,
      items: current.items.map((item) => ids.has(item.id) ? { ...item, isRead: true } : item),
    } : current);
  };

  const read = (item) => {
    accountNotificationService.read(item.server_id).then(() => markRead(new Set([item.id]))).catch(() => {});
  };

  const readAll = () => {
    if (!userId) return;
    const ids = new Set(items.map((item) => item.id));
    accountNotificationService.readAll().then(() => markRead(ids)).catch(() => {});
  };

  return (
    <AccountNotificationContext.Provider value={{ items, read, readAll }}>
      {children}
      <Toaster toasterId={TOASTER_ID} />
    </AccountNotificationContext.Provider>
  );
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';
import { bindGoogleIdentity, clearGoogleChallenge, getGoogleChallenge, loadGoogleIdentity } from '@/services/googleIdentity';

export function useGoogleAuth({ role = 'student', disabled = false, onSuccess } = {}) {
  const { loginWithGoogle } = useAuth();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const buttonRef = useRef(null);
  const latest = useRef({ role, disabled, onSuccess, loginWithGoogle });
  const attempt = useRef(null);
  const exchangeRef = useRef(null);
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [confirmingLink, setConfirmingLink] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => { latest.current = { role, disabled, onSuccess, loginWithGoogle }; }, [role, disabled, onSuccess, loginWithGoogle]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    let selectedRole = null;
    let releaseGoogleCallback;
    const host = buttonRef.current;
    const exchange = async (password) => {
      if (!active || !attempt.current || inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setError('');
      try {
        const result = await latest.current.loginWithGoogle({ ...attempt.current, ...(password ? { password } : {}) });
        if (!active) return;
        if (result.success) {
          attempt.current = null;
          clearGoogleChallenge();
          setConfirmingLink(false);
          toast.success(result.data?.message || 'Đăng nhập Google thành công.');
          latest.current.onSuccess?.(result);
        } else {
          setError(result.message || 'Chưa thể đăng nhập bằng Google.');
          setConfirmingLink(Boolean(result.requiresPassword));
          if (!result.requiresPassword) {
            attempt.current = null;
            clearGoogleChallenge();
            setRetryKey((key) => key + 1);
          }
        }
      } catch {
        if (active) setError('Chưa thể đăng nhập bằng Google. Vui lòng thử lại.');
      } finally {
        inFlight.current = false;
        if (active) setLoading(false);
      }
    };
    exchangeRef.current = exchange;
    Promise.all([loadGoogleIdentity(), getGoogleChallenge()]).then(([google, { nonce }]) => {
      if (!active || !host) return;
      releaseGoogleCallback = bindGoogleIdentity(google, {
        clientId, nonce,
        callback: (response) => {
          if (!active || latest.current.disabled || inFlight.current || !response?.credential) return;
          attempt.current = { credential: response.credential, nonce, role: selectedRole ?? latest.current.role };
          void exchange();
        },
      });
      host.replaceChildren();
      google.renderButton(host, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin', shape: 'rectangular',
        width: Math.max(100, Math.round(host.clientWidth || 120)), locale: 'en',
        click_listener: () => { selectedRole = latest.current.role; },
      });
      setReady(true);
    }).catch((failure) => {
      if (active) setError(failure.response?.data?.message || failure.message || 'Chưa thể tải đăng nhập Google.');
    });
    return () => {
      active = false;
      releaseGoogleCallback?.();
      host?.replaceChildren();
    };
  }, [clientId, retryKey]);

  return {
    buttonRef, loading, ready, error, confirmingLink,
    confirmLink: (password) => exchangeRef.current?.(password),
    closeLink: () => { if (!loading) { attempt.current = null; setConfirmingLink(false); setError(''); } },
    retry: () => { setError(''); setReady(false); setRetryKey((key) => key + 1); },
    unavailable: () => toast('Đăng nhập Google hiện chưa sẵn sàng. Bạn có thể dùng email hoặc số điện thoại.'),
  };
}

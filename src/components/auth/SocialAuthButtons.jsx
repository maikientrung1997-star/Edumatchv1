import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Modal } from '@/components/feedback/Modal';
import './socialAuth.css';

function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.28-2.09 3.66-5.18 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.31 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.26C.46 8.19 0 9.99 0 12s.46 3.81 1.26 5.41l4.02-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.59l4.02 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>;
}

export function SocialAuthButtons({ mode = 'login', role = 'student', disabled = false, onSuccess, onBusyChange }) {
  const { buttonRef, loading, ready, error, confirmingLink, confirmLink, closeLink, retry, unavailable } = useGoogleAuth({ role, disabled, onSuccess });
  const [password, setPassword] = useState('');
  const busy = disabled || loading;
  useEffect(() => { onBusyChange?.(loading); }, [loading, onBusyChange]);
  const close = () => { if (!loading) { setPassword(''); closeLink(); } };
  const submitLink = async (event) => {
    event.preventDefault();
    if (loading || !password) return;
    const submittedPassword = password;
    setPassword('');
    await confirmLink(submittedPassword);
  };

  return <>
    <div className="social-auth-divider"><span>{mode === 'register' ? 'Hoặc đăng ký nhanh bằng' : 'Hoặc đăng nhập bằng'}</span></div>
    <div className="social-auth-buttons" aria-label={mode === 'register' ? 'Đăng ký bằng tài khoản khác' : 'Đăng nhập bằng tài khoản khác'} aria-busy={loading}>
      <div className="social-auth-google" aria-label="Google" inert={busy || confirmingLink}>
        <div className="social-auth-google__host" ref={buttonRef} hidden={!ready} />
        {!ready && <button type="button" disabled={busy} onClick={unavailable}><GoogleIcon /><span>Google</span></button>}
      </div>
      <button type="button" disabled={busy || confirmingLink} onClick={() => toast('Đăng nhập bằng Facebook đang được chuẩn bị.')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><span>Facebook</span>
      </button>
      <button type="button" disabled={busy || confirmingLink} onClick={() => toast('Đăng nhập bằng Apple đang được chuẩn bị.')}>
        <svg width="19" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c.03 3.19 2.8 4.25 2.83 4.26-.02.07-.44 1.52-1.46 3.02-.89 1.3-1.81 2.6-3.27 2.63-1.43.03-1.89-.85-3.52-.85-1.62 0-2.13.82-3.47.88-1.4.05-2.46-1.41-3.36-2.7-1.83-2.65-3.23-7.48-1.35-10.75a5.22 5.22 0 0 1 4.43-2.68c1.38-.03 2.68.93 3.52.93.85 0 2.43-1.15 4.1-.98.7.03 2.65.28 3.9 2.1-.1.06-2.33 1.36-2.3 4.14ZM14.37 4.58c.75-.91 1.26-2.18 1.12-3.45-1.08.05-2.39.72-3.16 1.63-.69.79-1.29 2.06-1.13 3.28 1.21.09 2.43-.62 3.17-1.46Z"/></svg><span>Apple</span>
      </button>
    </div>
    {loading && <p className="social-auth-status" role="status">Đang xác thực với Google...</p>}
    {error && !confirmingLink && <p className="social-auth-error" role="alert">{error} <button type="button" onClick={retry} disabled={busy}>Thử lại</button></p>}
    <Modal open={confirmingLink} onClose={close} title="Liên kết tài khoản Google" description="Xác nhận mật khẩu EduMatch của tài khoản hiện có để tiếp tục." size="sm">
      <form className="social-auth-link-form" onSubmit={submitLink}>
        <label htmlFor="google-link-password">Mật khẩu EduMatch</label>
        <input id="google-link-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} disabled={loading}/>
        {error && <p className="social-auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading || !password}>{loading ? 'Đang xác thực...' : 'Xác nhận liên kết'}</button>
      </form>
    </Modal>
  </>;
}

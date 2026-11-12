import { useEffect, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Modal } from '@/components/feedback/Modal';
import { fieldErrors, requestError } from '@/utils/formErrors';
import './account.css';

export function RegistrationOtpModal({ session, onClose, onConfirm, onResend }) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(session.resendAt);
  const [debugOtp, setDebugOtp] = useState(session.debugOtp);
  const [now, setNow] = useState(Date.now);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    inputRef.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(otp)) {
      setError('Vui lòng nhập mã OTP gồm đúng 6 chữ số.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await onConfirm(otp);
      if (!result?.success) {
        const otpError = result?.errors?.otp;
        setError(
          (Array.isArray(otpError) ? otpError[0] : otpError) ||
            result?.message ||
            'Chưa thể xác thực. Vui lòng thử lại.'
        );
      }
    } catch (failure) {
      setError(fieldErrors(failure).otp || requestError(failure));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || seconds > 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await onResend();
      setResendAt(Date.now() + (response.resend_after || 60) * 1000);
      setDebugOtp(response.debug_otp || '');
      setOtp('');
      setNotice('Đã gửi mã mới. Vui lòng sử dụng mã trong email mới nhất.');
      inputRef.current?.focus();
    } catch (failure) {
      if (failure.response?.status === 429) {
        const wait = Number(failure.response.headers?.['retry-after']) || 60;
        setResendAt(Date.now() + wait * 1000);
        setError('Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ trước khi gửi lại.');
      } else {
        const errors = fieldErrors(failure);
        setError(errors.email || errors.phone || requestError(failure));
      }
    } finally {
      setBusy(false);
    }
  };

  const OTP_LENGTH = 6;
  const activeIndex = Math.min(otp.length, OTP_LENGTH - 1);

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Xác thực email"
      className="registration-otp-modal"
    >
      <form className="registration-otp" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="registration-otp__intro">
          <span className="registration-otp__icon" aria-hidden="true">
            <MailCheck size={26} />
          </span>
          <p>
            Nhập mã 6 số đã gửi đến
            <strong>{session.payload.email}</strong>
          </p>
          <small>Mã có hiệu lực 10 phút. Nếu không thấy, hãy kiểm tra cả thư rác.</small>
        </div>

        {notice && (
          <p className="registration-otp__notice" role="status">
            {notice}
          </p>
        )}
        {debugOtp && (
          <p className="account-debug">
            Môi trường local/test — mã kiểm thử: <strong>{debugOtp}</strong>
          </p>
        )}

        <div className="registration-otp__code">
          <input
            ref={inputRef}
            name="otp"
            value={otp}
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
              setError('');
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            required
            disabled={busy}
            aria-label="Mã OTP 6 số"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'registration-otp-error' : undefined}
            className="registration-otp__input"
          />
          <div className={`registration-otp__boxes ${error ? 'is-invalid' : ''}`} aria-hidden="true">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <span
                key={index}
                className={[
                  'registration-otp__box',
                  otp[index] ? 'is-filled' : '',
                  focused && index === activeIndex ? 'is-active' : '',
                ].filter(Boolean).join(' ')}
              >
                {otp[index] || ''}
              </span>
            ))}
          </div>
        </div>
        {error && (
          <p id="registration-otp-error" className="registration-otp__error" role="alert">
            {error}
          </p>
        )}

        <p className="registration-otp__resend">
          Chưa nhận được mã?{' '}
          <button type="button" disabled={busy || seconds > 0} onClick={resend}>
            {seconds > 0 ? `Gửi lại sau ${seconds}s` : 'Gửi lại mã'}
          </button>
        </p>

        <div className="registration-otp__actions">
          <button type="submit" className="registration-otp__submit" disabled={busy || otp.length < OTP_LENGTH}>
            {busy ? 'Đang xử lý...' : 'Xác nhận và hoàn tất đăng ký'}
          </button>
          <button type="button" className="registration-otp__back" disabled={busy} onClick={onClose}>
            Đổi thông tin đăng ký
          </button>
        </div>
      </form>
    </Modal>
  );
}

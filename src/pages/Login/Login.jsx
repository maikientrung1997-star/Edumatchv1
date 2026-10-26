import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import studentImage from '@/assets/login-student-v2.png';
import teacherAvatarsImg from '@/assets/teacher-avatars.png';
import './login.css';

const benefits = [
  'Kết nối nhanh chóng',
  'Giáo viên uy tín, chất lượng',
  'Linh hoạt thời gian',
  'Phù hợp mọi trình độ',
];

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registeredIdentifier =
    location.state?.registeredIdentifier || location.state?.registeredEmail;
  const [email, setEmail] = useState(registeredIdentifier || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'Vui lòng nhập email hoặc số điện thoại';
    } else if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Email chưa đúng định dạng';
    } else if (!email.includes('@') && !/^(?:0|\+84)[35789]\d{8}$/.test(email.replace(/[\s.()-]/g, ''))) {
      nextErrors.email = 'Vui lòng nhập số điện thoại Việt Nam hợp lệ';
    }

    if (!password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || socialLoading) return;
    setFormError('');
    if (!validate()) return;

    setLoading(true);
    const identifier = email.trim();
    const result = await login({
      [identifier.includes('@') ? 'email' : 'phone']: identifier,
      password,
      remember,
    });
    setLoading(false);

    if (result.success) {
      toast.success('Đăng nhập thành công');
      navigate(location.state?.from?.pathname || ROUTES.HOME, { replace: true });
      return;
    }

    const message = result.message || 'Đăng nhập chưa thành công. Vui lòng thử lại.';
    const fieldErrors = result.errors || {};
    setErrors({
      email: (fieldErrors.identifier || fieldErrors.email || fieldErrors.phone)?.[0],
      password: fieldErrors.password?.[0],
    });
    setFormError(message);
    toast.error(message);
  };

  return (
    <main className="login-page">
      {/* Main Content Stage */}
      <section className="login-stage" aria-labelledby="login-title">
        {/* Soft Ambient Blur Blob */}
        <div className="login-stage__blob-left" aria-hidden="true" />

        <div className="login-shell">
          {/* Left Column: Login Card */}
          <section className="login-card" aria-label="Biểu mẫu đăng nhập">
            <div className="login-card__heading">
              <h1 id="login-title">Đăng nhập</h1>
              <p>Chào mừng bạn trở lại EduMatch</p>
            </div>

            {formError && (
              <p className="login-alert" role="alert">
                {formError}
              </p>
            )}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {/* Email / Phone Field */}
              <div className="login-field">
                <label htmlFor="login-email" className="sr-only">
                  Email hoặc số điện thoại
                </label>
                <div className={errors.email ? 'login-control is-invalid' : 'login-control'}>
                  <User size={20} className="login-control__icon" aria-hidden="true" />
                  <input
                    id="login-email"
                    name="email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="Email / Số điện thoại"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (errors.email) setErrors((current) => ({ ...current, email: '' }));
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="login-email-error" className="login-field__error">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="login-field">
                <label htmlFor="login-password" className="sr-only">
                  Mật khẩu
                </label>
                <div className={errors.password ? 'login-control is-invalid' : 'login-control'}>
                  <Lock size={20} className="login-control__icon" aria-hidden="true" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password) setErrors((current) => ({ ...current, password: '' }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    className="login-control__toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" className="login-field__error">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="login-form__options">
                <label className="login-checkbox">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span className="login-checkbox__box" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="login-checkbox__label">Ghi nhớ đăng nhập</span>
                </label>
                <button
                  type="button"
                  className="login-text-button"
                  onClick={() => setForgotPasswordOpen(true)}
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Submit Button */}
              <button className="login-submit" type="submit" disabled={loading || socialLoading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <SocialAuthButtons
              disabled={loading}
              onBusyChange={setSocialLoading}
              onSuccess={() => navigate(location.state?.from?.pathname || ROUTES.HOME, { replace: true })}
            />

            {/* Footer Registration Link */}
            <p className="login-register-copy">
              Chưa có tài khoản? <Link to={ROUTES.REGISTER}>Đăng ký ngay</Link>
            </p>
          </section>

          {/* Right Column: Hero Section + Student Composition */}
          <aside className="login-hero" aria-label="Lợi ích khi học cùng EduMatch">
            {/* Soft mint circular blobs behind the student */}
            <div className="login-hero__blob login-hero__blob--upper" aria-hidden="true" />
            <div className="login-hero__blob login-hero__blob--lower" aria-hidden="true" />

            {/* Dashed arc curve in top right */}
            <div className="login-hero__dashed-arc" aria-hidden="true">
              <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
                <path
                  d="M 12 76 A 52 52 0 0 1 76 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Hero Left Content */}
            <div className="login-hero__content">
              {/* Floating Teacher Badge */}
              <div className="login-badge">
                <div className="login-badge__avatars" aria-hidden="true">
                  <img src={teacherAvatarsImg} alt="" className="login-badge__img" />
                </div>
                <span className="login-badge__text">
                  Hàng nghìn giáo viên
                  <br />
                  đang chờ bạn khám phá
                </span>
              </div>

              {/* Headline */}
              <h2 className="login-hero__title">
                Học tốt hơn
                <br />
                cùng <strong>EduMatch</strong>
              </h2>

              {/* Checklist */}
              <ul className="login-hero__list">
                {benefits.map((benefit) => (
                  <li key={benefit}>
                    <span className="login-hero__check-icon" aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* Paper Airplane with Curved Trail */}
              <div className="login-hero__plane-box" aria-hidden="true">
                <svg
                  className="login-hero__plane-trail"
                  width="130"
                  height="65"
                  viewBox="0 0 130 65"
                  fill="none"
                >
                  <path
                    d="M 8 52 C 45 56, 80 46, 108 20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="login-hero__plane-icon">
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Student Image: Fully visible, anchored at bottom */}
            <div className="login-hero__student-wrap">
              <img
                className="login-hero__student-img"
                src={studentImage}
                alt="Sinh viên mang sách và máy tính bảng"
                width="1024"
                height="1536"
              />
            </div>
          </aside>
        </div>
      </section>
      {forgotPasswordOpen && <ForgotPasswordModal initialIdentifier={email} onClose={() => setForgotPasswordOpen(false)} onSuccess={(identifier) => { setEmail(identifier); setPassword(''); setErrors({}); setFormError(''); }} />}
    </main>
  );
};

export default Login;

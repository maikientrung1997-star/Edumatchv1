import { Fragment, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, Eye, EyeOff, Handshake, Landmark } from "lucide-react";
import toast from "react-hot-toast";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { Modal } from "@/components/feedback/Modal";
import { RegistrationOtpModal } from "@/components/auth/RegistrationOtpModal";
import { authService } from "@/services/authService";
import { requestError } from "@/utils/formErrors";
import {
  accountFields,
  buildRegistrationPayload,
  centerAccountFields,
  centerFields,
  constrainPhoneInput,
  getTodayDate,
  initialForm,
  mapRegistrationErrors,
  registrationRoles,
  roleContent,
  teacherFields,
  validateRegistration,
} from "./registerData";
import registerImage from "@/assets/register-student.webp";
import "./register.css";

function FieldError({ name, errors }) {
  return errors[name] ? (
    <p id={`register-${name}-error`} className="register-field__error">
      {errors[name]}
    </p>
  ) : null;
}

function ProfileField({ field, form, errors, onChange, onExpand }) {
  const { name, label, placeholder, icon: Icon, multiline, maxLength, showCharacterCount } = field;
  const sharedProps = {
    id: `register-${name}`,
    name,
    placeholder,
    value: form[name],
    onChange,
    maxLength,
    required: true,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `register-${name}-error` : undefined,
  };
  return (
    <div className="register-field">
      <label htmlFor={`register-${name}`} className="register-sr-only">
        {label} <span aria-hidden="true">*</span>
      </label>
      <div
        className={`register-control ${multiline ? "register-control--textarea" : ""} ${errors[name] ? "is-invalid" : ""}`}
      >
        <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
        {multiline ? (
          <div className="register-textarea-body">
            <textarea
              {...sharedProps}
              rows={1}
              wrap="off"
              onClick={() => onExpand?.(field)}
            />
          </div>
        ) : (
          <input {...sharedProps} type="text" />
        )}
      </div>
      {showCharacterCount && maxLength && (
        <p className={`register-field__count ${String(form[name] || '').length >= maxLength ? 'is-limit' : ''}`}>
          {String(form[name] || '').length}/{maxLength} ký tự
        </p>
      )}
      <FieldError name={name} errors={errors} />
    </div>
  );
}

function PhoneVisibility({ value, disabled, onChange }) {
  return (
    <div
      className="register-phone-visibility"
      role="group"
      aria-labelledby="register-phone-visibility-title"
    >
      <strong id="register-phone-visibility-title">
        Công khai số điện thoại?
      </strong>
      <p>
        Số điện thoại sẽ hiển thị trên hồ sơ, danh sách tìm kiếm và khóa học khi bạn đồng ý.
      </p>
      <div>
        <label>
          <input
            type="radio"
            name="isPhonePublic"
            checked={value}
            disabled={disabled}
            onChange={() => onChange(true)}
          />
          Có
        </label>
        <label>
          <input
            type="radio"
            name="isPhonePublic"
            checked={!value}
            disabled={disabled}
            onChange={() => onChange(false)}
          />
          Không
        </label>
      </div>
    </div>
  );
}

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  const role = registrationRoles.some(({ value }) => value === requestedRole)
    ? requestedRole
    : "student";
  const [form, setForm] = useState(initialForm);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSession, setOtpSession] = useState(null);
  const requestInProgress = useRef(false);
  const [showTeacherTerms, setShowTeacherTerms] = useState(false);
  const [teacherTermsAccepted, setTeacherTermsAccepted] = useState(false);
  const [activeRegistrationTextField, setActiveRegistrationTextField] = useState(null);
  const formRef = useRef(null);
  const content = roleContent[role];
  const fields = role === "center"
    ? centerAccountFields
    : role === "teacher"
      ? accountFields
      : accountFields;
  const today = getTodayDate();

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    const maxLength = Number(event.target.maxLength);
    const limitedValue =
      Number.isInteger(maxLength) && maxLength >= 0
        ? value.slice(0, maxLength)
        : value;
    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "phone"
            ? constrainPhoneInput(value)
          : name === "foundedYear"
            ? value.replace(/\D/g, "").slice(0, 4)
            : limitedValue,
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  };

  const changeRole = (nextRole) => {
    setSearchParams(nextRole === "student" ? {} : { role: nextRole }, {
      replace: true,
    });
    setErrors({});
    setFormError("");
    setShowTeacherTerms(false);
    setTeacherTermsAccepted(false);
    setActiveRegistrationTextField(null);
    setOtpSession(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validateRegistration(form, role);
    setErrors(nextErrors);
    setFormError("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      formRef.current.elements.namedItem(firstError)?.focus();
      return;
    }

    if (role !== "student") {
      setTeacherTermsAccepted(false);
      setShowTeacherTerms(true);
      return;
    }
    await beginRegistration();
  };

  const beginRegistration = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setLoading(true);
    const data = buildRegistrationPayload(form, role);
    try {
      const response = await authService.sendRegistrationOtp({ name: data.name, email: data.email, phone: data.phone });
      setOtpSession({ payload: data, role, debugOtp: response.debug_otp || '',
        resendAt: Date.now() + (response.resend_after || 60) * 1000 });
    } catch (error) {
      setErrors(mapRegistrationErrors(error.response?.data?.errors, role));
      setFormError(error.response?.status === 429
        ? 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ 60 giây trước khi gửi lại.'
        : requestError(error));
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  };

  const completeRegistration = async (otp) => {
    if (requestInProgress.current || !otpSession) return;
    requestInProgress.current = true;
    setLoading(true);
    try {
      const result = await register({ ...otpSession.payload, otp });
      if (!result?.success) {
        const fieldErrors = mapRegistrationErrors(result?.errors, role);
        if (Object.keys(fieldErrors).some((field) => field !== 'otp')) {
          setOtpSession(null);
          setErrors(fieldErrors);
          setFormError(fieldErrors.role || result?.message || "Vui lòng kiểm tra lại thông tin đăng ký.");
        }
        return result;
      }
      setOtpSession(null);
      toast.success(role === "student" ? "Tạo tài khoản học viên thành công!" : "Tạo tài khoản thành công!");
      navigate(role === "student" ? ROUTES.STUDENT_WELCOME : ROUTES.HOME, {
        replace: true,
      });
      return result;
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  };

  const closeTeacherTerms = () => {
    if (loading) return;
    setTeacherTermsAccepted(false);
    setShowTeacherTerms(false);
  };
  const confirmTeacherTerms = () => {
    if (!teacherTermsAccepted || loading) return;
    setShowTeacherTerms(false);
    beginRegistration();
  };

  return (
    <main className={`register-page register-page--${role}`}>
      <div className="register-shell">
        <section className="register-card" aria-labelledby="register-title">
          <div className="register-heading">
            <h1 id="register-title">Tạo tài khoản</h1>
            <p>{content.description}</p>
          </div>

          <fieldset className="register-roles" disabled={loading}>
            <legend className="register-sr-only">Vai trò tài khoản</legend>
            {registrationRoles.map(
              ({ value, label, accessibleLabel, icon: Icon }) => (
                <label
                  key={value}
                  className={`register-role ${role === value ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    aria-label={accessibleLabel}
                    checked={role === value}
                    onChange={() => changeRole(value)}
                  />
                  <Icon size={27} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </label>
              ),
            )}
          </fieldset>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="register-form"
            noValidate
            aria-busy={loading}
          >
            <fieldset className="register-fields" disabled={loading}>
              <legend className="register-sr-only">Thông tin tài khoản</legend>
              {fields.map(
                ({
                  name,
                  label,
                  placeholder,
                  icon: Icon,
                  type = "text",
                  autoComplete,
                  maxLength,
                  showLabel,
                }) => {
                  const isPassword =
                    name === "password" || name === "confirmPassword";
                  return (
                    <Fragment key={name}>
                      <div className="register-field">
                        <label
                          htmlFor={`register-${name}`}
                          className={
                          showLabel
                              ? "register-field-label"
                              : "register-sr-only"
                          }
                        >
                          {label}{" "}
                          {showLabel && (
                            <span aria-hidden="true">*</span>
                          )}
                        </label>
                        <div
                          className={`register-control ${errors[name] ? "is-invalid" : ""}`}
                        >
                          <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                          <input
                            id={`register-${name}`}
                            name={name}
                            type={
                              isPassword
                                ? visiblePasswords[name]
                                  ? "text"
                                  : "password"
                                : type
                            }
                            autoComplete={autoComplete}
                            placeholder={placeholder || label}
                            value={form[name]}
                            onChange={updateField}
                            required
                            maxLength={isPassword ? 128 : maxLength}
                            max={type === "date" ? today : undefined}
                            lang={type === "date" ? "vi" : undefined}
                            aria-invalid={Boolean(errors[name])}
                            aria-describedby={
                              errors[name]
                                ? `register-${name}-error`
                                : name === "password"
                                  ? "register-password-hint"
                                  : undefined
                            }
                          />
                          {isPassword && (
                            <button
                              type="button"
                              className="register-password-toggle"
                              onClick={() =>
                                setVisiblePasswords((current) => ({
                                  ...current,
                                  [name]: !current[name],
                                }))
                              }
                              aria-label={`${visiblePasswords[name] ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`}
                              aria-pressed={Boolean(visiblePasswords[name])}
                            >
                              {visiblePasswords[name] ? (
                                <EyeOff size={21} />
                              ) : (
                                <Eye size={21} />
                              )}
                            </button>
                          )}
                        </div>
                        <FieldError name={name} errors={errors} />
                      </div>
                      {role === "teacher" && name === "phone" && (
                        <PhoneVisibility
                          value={form.isPhonePublic}
                          disabled={loading}
                          onChange={(isPhonePublic) =>
                            setForm((current) => ({ ...current, isPhonePublic }))
                          }
                        />
                      )}
                    </Fragment>
                  );
                },
              )}
              <p className="register-hint" id="register-password-hint">
                Mật khẩu có ít nhất 8 ký tự.
              </p>
            </fieldset>

            {(role === "teacher" || role === "center") && (
              <fieldset
                className="register-fields"
                disabled={loading}
              >
                <legend className="register-sr-only">
                  {role === "teacher"
                    ? "Thông tin dành cho giáo viên"
                    : "Thông tin trung tâm đào tạo"}
                </legend>
                {(role === "teacher" ? teacherFields : centerFields).map(
                  (field) => (
                    <ProfileField
                      key={field.name}
                      field={field}
                      form={form}
                      errors={errors}
                      onChange={updateField}
                      onExpand={setActiveRegistrationTextField}
                    />
                  ),
                )}
              </fieldset>
            )}

            {formError && (
              <p className="register-alert" role="alert">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </button>
          </form>
          <p className="register-login-copy">
            Đã có tài khoản? <Link to={ROUTES.LOGIN}>Đăng nhập ngay</Link>
          </p>
        </section>

        <aside
          className="register-hero"
          aria-label="Lợi ích khi tham gia EduMatch"
        >
          <div className="register-hero__content">
            <h2>
              Tham gia <strong>EduMatch</strong>
              <br />
              ngay hôm nay
            </h2>
            <ul className="register-benefits">
              {content.benefits.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="register-benefit-icon">
                    <Icon size={26} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="register-hero__photo">
            <img
              src={registerImage}
              alt="Học viên mỉm cười bên laptop và vở ghi chép"
              width="1200"
              height="900"
              fetchPriority="high"
            />
          </div>
        </aside>
      </div>
      {otpSession && otpSession.role === role && <RegistrationOtpModal session={otpSession}
        onClose={() => { if (!loading) setOtpSession(null); }}
        onConfirm={completeRegistration}
        onResend={() => authService.sendRegistrationOtp({ name: otpSession.payload.name,
          email: otpSession.payload.email, phone: otpSession.payload.phone })} />}
      <Modal
        open={Boolean(activeRegistrationTextField)}
        onClose={() => setActiveRegistrationTextField(null)}
        title={activeRegistrationTextField?.label}
        description={activeRegistrationTextField?.maxLength ? `Soạn nội dung chi tiết. Tối đa ${activeRegistrationTextField.maxLength} ký tự.` : undefined}
        size="xl"
        className="register-text-editor-modal"
        footer={<button type="button" className="register-text-editor-modal__done" onClick={() => setActiveRegistrationTextField(null)}>Xong</button>}
      >
        {activeRegistrationTextField && <div className="register-text-editor-modal__body">
          <textarea
            className="register-text-editor-modal__textarea"
            autoFocus
            id={`register-expanded-${activeRegistrationTextField.name}`}
            name={activeRegistrationTextField.name}
            value={form[activeRegistrationTextField.name] || ""}
            onChange={updateField}
            rows="16"
            maxLength={activeRegistrationTextField.maxLength || undefined}
            placeholder={activeRegistrationTextField.placeholder}
            aria-label={activeRegistrationTextField.label}
          />
          {activeRegistrationTextField.maxLength && <p className={`register-text-editor-modal__count ${form[activeRegistrationTextField.name].length >= activeRegistrationTextField.maxLength ? "is-limit" : ""}`}>
            {form[activeRegistrationTextField.name].length}/{activeRegistrationTextField.maxLength} ký tự
          </p>}
        </div>}
      </Modal>
      <Modal
        open={showTeacherTerms}
        onClose={closeTeacherTerms}
        title="Điều khoản dành cho Giáo viên & Đối tác"
        description="Vui lòng đọc kỹ và xác nhận trước khi hoàn tất đăng ký."
        size="xl"
        className="teacher-terms-dialog"
        footer={
          <div className="teacher-terms-dialog__actions">
            <label className="teacher-terms-dialog__consent">
              <input
                type="checkbox"
                checked={teacherTermsAccepted}
                onChange={(event) =>
                  setTeacherTermsAccepted(event.target.checked)
                }
                disabled={loading}
              />
              <span>Tôi đồng ý với Điều khoản Giáo viên &amp; Đối tác của EduMatch.</span>
            </label>
            <button
              type="button"
              className="teacher-terms-dialog__confirm"
              disabled={!teacherTermsAccepted || loading}
              onClick={confirmTeacherTerms}
            >
              {loading ? "Đang xử lý..." : "Đồng ý & xác thực email"}
            </button>
          </div>
        }
      >
        <article className="teacher-terms-document">
          <p className="teacher-terms-document__summary">
            Các điều khoản chính áp dụng khi bạn đăng khóa học và hợp tác cùng EduMatch.
          </p>

          <section>
            <div className="teacher-terms-document__heading">
              <BadgeCheck size={18} />
              <h3>Miễn phí đến hết năm 2026</h3>
            </div>
            <p>
              EduMatch không thu bất kỳ khoản phí nền tảng nào từ học viên,
              Giáo viên hoặc Đối tác đến hết ngày 31/12/2026.
            </p>
          </section>

          <section>
            <div className="teacher-terms-document__heading">
              <Landmark size={18} />
              <h3>Phí áp dụng từ năm 2027</h3>
            </div>
            <ul className="teacher-terms-document__fees">
              <li>
                <strong>Khởi tạo khóa học</strong>
                <span>200.000 VNĐ/lần đăng ký và thiết lập.</span>
              </li>
              <li>
                <strong>Duy trì khóa học</strong>
                <span>200.000 VNĐ/tháng để duy trì hiển thị và quản lý.</span>
              </li>
            </ul>
          </section>

          <section>
            <div className="teacher-terms-document__heading">
              <Handshake size={18} />
              <h3>Phương thức hợp tác</h3>
            </div>
            <p>
              Khi tự đăng bài và chốt lịch với học viên, bạn thanh toán phí khởi
              tạo và duy trì. Khi EduMatch giới thiệu học viên, hoa hồng được
              thống nhất trước, thông thường từ 15% đến 20% tổng học phí.
            </p>
            <p className="teacher-terms-document__notice">
              Bạn có quyền nhận hoặc từ chối học viên được EduMatch giới thiệu
              trước khi sắp xếp lớp học.
            </p>
          </section>
        </article>
      </Modal>
    </main>
  );
}

export default Register;

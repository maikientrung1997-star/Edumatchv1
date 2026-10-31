import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { profileService } from '@/services/profileService';
import { fieldErrors, requestError } from '@/utils/formErrors';
import { getTodayDate } from '@/pages/Register/registerData';
import { getPostMediaItems, getPosts, syncTeacherCourseProfile } from '@/features/learning/marketplace';
import { Modal } from '@/components/feedback/Modal';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ProfileImageCropDialog } from '@/components/profile/ProfileImageCropDialog';
import { SecurityForm } from './SecurityForm';
import '@/components/auth/account.css';
import './profileSettings.css';

const TEACHING_FIELD_MAX_LENGTH = 45;

const readImageAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });

const createPersistentProfileImage = async (file, maxDimension = 360) => {
  const source = await readImageAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const preview = new Image();
    preview.onload = () => resolve(preview);
    preview.onerror = reject;
    preview.src = source;
  });
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.76);
};

const profileForm = (user) => ({
  name: user.name || '',
  date_of_birth: user.dob || '',
  bio: user.detailedProfile || user.bio || '',
  teaching_field: user.teachingField || '',
  province_id: user.student_profile?.province_id || '',
  district_id: user.student_profile?.district_id || '',
  ward_id: user.student_profile?.ward_id || '',
});

export function ProfileSettingsPage() {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'security' ? 'security' : 'profile';
  const [form, setForm] = useState(() => profileForm(user));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [areasError, setAreasError] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [provinceChildren, setProvinceChildren] = useState([]);
  const [districtWards, setDistrictWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [failedAvatarSource, setFailedAvatarSource] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCropDraft, setAvatarCropDraft] = useState(null);
  const [isAvatarSourceOpen, setIsAvatarSourceOpen] = useState(false);
  const [isAvatarAlbumOpen, setIsAvatarAlbumOpen] = useState(false);
  const [isBioEditorOpen, setIsBioEditorOpen] = useState(false);
  const avatarInput = useRef(null);
  const isStudent = user.role === 'student';
  const hasSubmittedVerification = Boolean(user?.verificationStatus && user.verificationStatus !== 'unverified');
  const avatarAlbumItems = getPosts()
    .filter((post) => String(post.authorId || post.teacherId) === String(user.id))
    .flatMap((post) => getPostMediaItems(post))
    .filter((item) => item.type === 'image' && item.src);
  const avatarSource = preview || user.avatar || '';

  const selectTab = (nextTab) => {
    setSearchParams(nextTab === 'security' ? { tab: 'security' } : {});
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await profileService.get();
        if (active) {
          updateUser(response.user);
          setForm(profileForm(response.user));
          setMessage('');
        }
      } catch (error) {
        if (active) setMessage(requestError(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    profileService
      .areas({ level: 'province' })
      .then((areas) => {
        if (active) setProvinces(areas);
      })
      .catch((error) => {
        if (active) setAreasError(requestError(error));
      });
    return () => {
      active = false;
    };
  }, [updateUser, retry]);

  useEffect(() => {
    if (!form.province_id) return;
    let active = true;
    profileService
      .areas({ parent_id: form.province_id })
      .then((areas) => {
        if (active) {
          setProvinceChildren(areas);
          setAreasError('');
        }
      })
      .catch((error) => {
        if (active) setAreasError(requestError(error));
      });
    return () => {
      active = false;
    };
  }, [form.province_id]);

  useEffect(() => {
    if (!form.district_id) return;
    let active = true;
    profileService
      .areas({ parent_id: form.district_id, level: 'ward' })
      .then((areas) => {
        if (active) {
          setDistrictWards(areas);
          setAreasError('');
        }
      })
      .catch((error) => {
        if (active) setAreasError(requestError(error));
      });
    return () => {
      active = false;
    };
  }, [form.district_id]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const change = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'teaching_field'
      ? value.slice(0, TEACHING_FIELD_MAX_LENGTH)
      : value;
    setForm((current) => ({
      ...current,
      [name]: nextValue,
      ...(name === 'province_id'
        ? { district_id: '', ward_id: '' }
        : name === 'district_id'
          ? { ward_id: '' }
          : {}),
    }));
    if (name === 'province_id') {
      setProvinceChildren([]);
      setDistrictWards([]);
    }
    if (name === 'district_id') setDistrictWards([]);
    setErrors((current) => ({ ...current, [name]: '' }));
    setMessage('');
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (form.name.trim().length < 2) next.name = user.role === 'center' ? 'Tên trung tâm cần có ít nhất 2 ký tự.' : 'Họ và tên cần có ít nhất 2 ký tự.';
    if (form.name.trim().length > (user.role === 'center' ? 200 : 150)) next.name = user.role === 'center' ? 'Tên trung tâm tối đa 200 ký tự.' : 'Họ và tên tối đa 150 ký tự.';
    if (form.date_of_birth && form.date_of_birth > getTodayDate())
      next.date_of_birth = 'Ngày sinh không được nằm trong tương lai.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        date_of_birth: form.date_of_birth || null,
      };
      for (const key of ['province_id', 'district_id', 'ward_id'])
        payload[key] = form[key] ? Number(form[key]) : null;
      const response = await profileService.update(payload);
      const currentAvatar = user?.avatar;
      const currentAvatarVersion = user?.avatarVersion;
      const { avatar: responseAvatar, ...otherUserData } = response?.user || {};
      const profileUpdates = {
        ...otherUserData,
        name: otherUserData.name || payload.name,
        bio: otherUserData.bio || payload.bio,
        detailedProfile: otherUserData.detailedProfile || payload.bio,
        teachingField: 'teachingField' in otherUserData ? otherUserData.teachingField : payload.teaching_field,
        ...(payload.date_of_birth ? { dob: otherUserData.dob || payload.date_of_birth } : {}),
        ...(currentAvatar ? { avatar: currentAvatar, avatarVersion: currentAvatarVersion } : (responseAvatar ? { avatar: responseAvatar } : {})),
      };
      updateUser(profileUpdates);
      if (['teacher', 'center'].includes(user?.role)) {
        syncTeacherCourseProfile(user.id, profileUpdates);
      }
      setForm(profileForm({ ...user, ...profileUpdates }));
      toast.success('Đã lưu hồ sơ cá nhân.');
      setMessage('Thông tin của bạn đã được lưu.');
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(requestError(error));
    } finally {
      setBusy(false);
    }
  };
  const chooseAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Chọn ảnh JPG, PNG hoặc WebP.');
      event.target.value = '';
      return;
    }
    setAvatarError('');
    try {
      setAvatarCropDraft({ file, source: await readImageAsDataUrl(file), variant: 'avatar' });
    } catch {
      setAvatarError('Không thể mở ảnh. Vui lòng chọn một ảnh khác.');
    }
  };

  const saveCroppedAvatar = async ({ image, file }) => {
    const avatarVersion = `${file.name}-${file.size}-${file.lastModified}`;
    setAvatarError('');
    setAvatarFile(file);
    setPreview(image);
    setFailedAvatarSource('');
    updateUser({ avatar: image, avatarVersion });
    if (['teacher', 'center'].includes(user?.role)) {
      syncTeacherCourseProfile(user.id, { avatar: image });
    }
    await uploadAvatar(file, image);
    setAvatarCropDraft(null);
  };

  const uploadAvatar = async (fileToUpload = avatarFile, imageOverride = preview) => {
    if (!fileToUpload || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const avatarVersion = `${fileToUpload.name}-${fileToUpload.size}-${fileToUpload.lastModified}`;
      let localImage = imageOverride;
      if (!localImage || !localImage.startsWith('data:image/')) {
        try {
          localImage = await createPersistentProfileImage(fileToUpload);
        } catch {
          // ignore
        }
      }
      if (localImage) {
        updateUser({ avatar: localImage, avatarVersion });
        if (['teacher', 'center'].includes(user?.role)) {
          syncTeacherCourseProfile(user.id, { avatar: localImage });
        }
      }

      try {
        const response = await profileService.uploadAvatar(fileToUpload);
        if (response?.user) {
          const { avatar: serverAvatar, ...otherUserData } = response.user;
          updateUser({
            ...otherUserData,
            avatar: localImage || serverAvatar || user?.avatar,
            avatarVersion,
          });
        }
      } catch (uploadError) {
        console.warn('API avatar upload failed, keeping local avatar:', uploadError);
      }

      setAvatarFile(null);
      if (localImage) {
        setPreview(localImage);
      }
      if (avatarInput.current) avatarInput.current.value = '';
      toast.success('Đã lưu ảnh đại diện.');
    } catch (error) {
      setAvatarError(fieldErrors(error).avatar || requestError(error));
    } finally {
      setAvatarBusy(false);
    }
  };
  const chooseAvatarFromAlbum = (image) => {
    setIsAvatarAlbumOpen(false);
    setAvatarCropDraft({ source: image.src, variant: 'avatar' });
  };
  const districts = provinceChildren.filter((area) => area.level === 'district');
  const wards = form.district_id
    ? districtWards
    : provinceChildren.filter((area) => area.level === 'ward');
  const areaSelect = (name, label, options, disabled) => (
    <label className="account-field">
      <span>{label}</span>
      <select
        aria-label={label}
        name={name}
        value={form[name]}
        onChange={change}
        disabled={disabled}
        aria-invalid={Boolean(errors[name])}
      >
        <option value="">Chưa chọn</option>
        {options.map((area) => (
          <option value={area.id} key={area.id}>
            {area.name}
          </option>
        ))}
      </select>
      {errors[name] && <small className="account-error">{errors[name]}</small>}
    </label>
  );

  return (
    <main className="profile-settings-page">
      <header className="profile-settings-heading">
        <p>TÀI KHOẢN EDUMATCH</p>
        <h1>Hồ sơ & bảo mật</h1>
      </header>
      <div className="profile-settings-layout">
        <aside className="profile-settings-sidebar">
          <div className="profile-settings-avatar">
            {avatarSource && failedAvatarSource !== avatarSource ? (
              <img src={avatarSource} alt={`Ảnh đại diện của ${user.name}`} onError={() => setFailedAvatarSource(avatarSource)} />
            ) : (
              <DefaultRoleAvatar role={user.role} size={42} />
            )}
            <button type="button" className={`profile-settings-avatar__camera ${avatarBusy ? 'is-uploading' : ''}`} onClick={() => setIsAvatarSourceOpen((current) => !current)} aria-label={avatarBusy ? 'Đang cập nhật ảnh đại diện' : 'Đổi ảnh đại diện'} aria-expanded={isAvatarSourceOpen} disabled={avatarBusy}>
              {avatarBusy ? <LoaderCircle className="profile-settings-avatar__spinner" size={17} /> : <Camera size={17} />}
            </button>
          </div>
          <h2>{user.name}</h2>
          <p>
            {isStudent
              ? 'Học viên'
              : user.role === 'teacher'
                ? 'Giáo viên'
                : user.role === 'center'
                  ? 'Trung tâm đào tạo'
                  : 'Tài khoản quản trị'}
          </p>
          <input ref={avatarInput} className="profile-avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} disabled={avatarBusy} />
          {isAvatarSourceOpen && <div className="profile-avatar-source-menu" role="menu" aria-label="Nguồn ảnh đại diện">
            <button type="button" role="menuitem" onClick={() => { setIsAvatarSourceOpen(false); avatarInput.current?.click(); }} disabled={avatarBusy}><Camera size={16} /> Tải ảnh lên</button>
            <button type="button" role="menuitem" onClick={() => { setIsAvatarSourceOpen(false); setIsAvatarAlbumOpen(true); }}><ImagePlus size={16} /> Chọn từ album ảnh</button>
          </div>}
          {avatarError && (
            <p className="account-error" role="alert">
              {avatarError}
            </p>
          )}
          {avatarBusy && <small aria-live="polite">Đang cập nhật ảnh đại diện…</small>}
          {['teacher', 'center'].includes(user.role) && <Link className="profile-sidebar-link" to={ROUTES.VERIFICATION}><ShieldCheck size={16} /><span>{hasSubmittedVerification ? 'Hồ Sơ Xác Minh' : 'Xác Minh Hồ Sơ'}</span></Link>}
          {!isStudent && <Link className="profile-sidebar-link" to={ROUTES.TEACHER_PROFILE(user.id)}><UserRound size={16} /><span>Xem hồ sơ cá nhân</span></Link>}
        </aside>
        <section className="profile-settings-panel">
          <nav className="profile-settings-tabs" aria-label="Cài đặt tài khoản">
            <button
              type="button"
              aria-current={tab === 'profile' ? 'page' : undefined}
              onClick={() => selectTab('profile')}
            >
              <UserRound size={17} /> Hồ sơ năng lực
            </button>
            <button
              type="button"
              aria-current={tab === 'security' ? 'page' : undefined}
              onClick={() => selectTab('security')}
            >
              <ShieldCheck size={17} /> Bảo mật & mật khẩu
            </button>
          </nav>
          {tab === 'security' ? (
            <SecurityForm />
          ) : loading ? (
            <p role="status">Đang tải hồ sơ...</p>
          ) : (
            <form className="account-form" onSubmit={save} noValidate>
              <div className="profile-section-heading">
                <UserRound size={23} />
                <div>
                  <h2>Hồ sơ năng lực</h2>
                </div>
              </div>
              {message && (
                <p className="account-notice" role="status">
                  {message}
                </p>
              )}
              <fieldset disabled={busy}>
                <label className="account-field">
                  <span>{user.role === 'center' ? 'Tên trung tâm' : 'Họ và tên'}</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={change}
                    maxLength={user.role === 'center' ? 200 : 150}
                    required
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <small className="account-error">{errors.name}</small>}
                </label>
                <div className="account-grid">
                  <label className="account-field">
                    <span>Email</span>
                    <input value={user.email || 'Chưa cung cấp'} readOnly />
                  </label>
                  <label className="account-field">
                    <span>Số điện thoại</span>
                    <input value={user.phone || ''} readOnly />
                  </label>
                </div>
                {user.role !== 'center' && (
                  <label className="account-field">
                    <span>Ngày sinh</span>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={form.date_of_birth}
                      onChange={change}
                      max={getTodayDate()}
                    />
                    {errors.date_of_birth && (
                      <small className="account-error">{errors.date_of_birth}</small>
                    )}
                  </label>
                )}
                {isStudent && (
                  <>
                    {areasError && (
                      <p className="account-error" role="alert">
                        {areasError}{' '}
                        <button type="button" onClick={() => setRetry(retry + 1)}>
                          Thử tải lại
                        </button>
                      </p>
                    )}
                    {areaSelect('province_id', 'Tỉnh / Thành phố', provinces, false)}
                    {districts.length > 0 &&
                      areaSelect(
                        'district_id',
                        'Quận / Huyện (địa giới lịch sử)',
                        districts,
                        !form.province_id
                      )}
                    {areaSelect('ward_id', 'Phường / Xã', wards, !form.province_id)}
                  </>
                )}
                {!isStudent && <label className="account-field">
                  <span>Lĩnh vực giảng dạy</span>
                  <input name="teaching_field" value={form.teaching_field} onChange={change} maxLength={TEACHING_FIELD_MAX_LENGTH} placeholder="Lĩnh Vực Giảng Dạy ..." aria-invalid={Boolean(errors.teaching_field)} />
                  <small className={`profile-field-count ${form.teaching_field.length >= TEACHING_FIELD_MAX_LENGTH ? 'is-limit' : ''}`}>{form.teaching_field.length}/{TEACHING_FIELD_MAX_LENGTH} ký tự</small>
                  {errors.teaching_field && <small className="account-error">{errors.teaching_field}</small>}
                </label>}
                <label className="account-field">
                  <span>{isStudent ? 'Giới thiệu & mục tiêu học tập' : 'Hồ sơ năng lực'}</span>
                  <textarea
                    aria-label="Hồ sơ năng lực"
                    name="bio"
                    value={form.bio}
                    readOnly
                    onClick={() => setIsBioEditorOpen(true)}
                    rows={5}
                    className="profile-bio-preview"
                  />
                  {errors.bio && <small className="account-error">{errors.bio}</small>}
                </label>
              </fieldset>
              <div className="account-actions">
                <button className="account-primary" type="submit" disabled={busy}>
                  <Check size={17} /> {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <Modal open={isBioEditorOpen} onClose={() => setIsBioEditorOpen(false)} title={isStudent ? 'Giới thiệu & mục tiêu học tập' : 'Hồ sơ năng lực'} size="xl" className="profile-bio-editor" footer={<button type="button" className="profile-bio-editor__done" onClick={() => setIsBioEditorOpen(false)}>Xong</button>}>
        <textarea autoFocus name="bio" value={form.bio} onChange={change} rows="18" placeholder="Chia sẻ nội dung bạn muốn học viên biết..." aria-label="Hồ sơ năng lực" />
      </Modal>
      <Modal open={isAvatarAlbumOpen} onClose={() => setIsAvatarAlbumOpen(false)} title="Chọn ảnh đại diện từ album" description="Chọn một ảnh bạn đã đăng trên bảng tin hoặc trang cá nhân." size="lg" className="profile-avatar-album">
        {avatarAlbumItems.length ? <div className="profile-avatar-album__grid">{avatarAlbumItems.map((image, index) => <button type="button" key={`${image.id || image.src}-${index}`} onClick={() => chooseAvatarFromAlbum(image)}><img src={image.src} alt={`Ảnh trong album ${index + 1}`} /></button>)}</div> : <p className="profile-avatar-album__empty">Bạn chưa có ảnh nào trong album. Hãy tải ảnh lên để làm ảnh đại diện.</p>}
      </Modal>
      <ProfileImageCropDialog
        draft={avatarCropDraft}
        onClose={() => setAvatarCropDraft(null)}
        onSave={saveCroppedAvatar}
      />
    </main>
  );
}

export default ProfileSettingsPage;

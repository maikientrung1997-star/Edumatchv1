import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ImagePlus, Images, Upload } from 'lucide-react';
import { Modal } from '@/components/feedback/Modal';
import './profileImageSourceDialog.css';

const imageItemsOnly = (media) => media.filter((item) => item?.src && item.type !== 'video');

export function ProfileImageSourceDialog({ open, variant, media = [], onClose, onChooseExisting, onUpload }) {
  const [screen, setScreen] = useState('choice');
  const images = useMemo(() => imageItemsOnly(media), [media]);
  const isAvatar = variant === 'avatar';

  useEffect(() => {
    if (open) setScreen('choice');
  }, [open, variant]);

  const title = isAvatar ? 'Thay ảnh đại diện' : 'Thay ảnh bìa';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={screen === 'choice' ? 'Chọn nguồn ảnh, sau đó điều chỉnh vùng hiển thị.' : 'Chọn một ảnh đã có để điều chỉnh vùng hiển thị.'}
      size="lg"
      className="profile-image-source-dialog"
    >
      {screen === 'choice' ? (
        <div className="profile-image-source-dialog__choices">
          <button type="button" className="profile-image-source-choice" onClick={() => setScreen('library')}>
            <span className="profile-image-source-choice__icon"><Images size={23} /></span>
            <span><strong>Chọn ảnh có sẵn</strong><small>Chọn từ ảnh đã đăng trên hồ sơ</small></span>
          </button>
          <button type="button" className="profile-image-source-choice" onClick={onUpload}>
            <span className="profile-image-source-choice__icon"><Upload size={23} /></span>
            <span><strong>Tải ảnh lên</strong><small>Chọn ảnh mới từ thiết bị của bạn</small></span>
          </button>
        </div>
      ) : (
        <div className="profile-image-source-dialog__library">
          <button type="button" className="profile-image-source-dialog__back" onClick={() => setScreen('choice')}><ChevronLeft size={18} /> Quay lại</button>
          {images.length ? (
            <div className="profile-image-source-dialog__grid">
              {images.map((item, index) => (
                <button
                  type="button"
                  className="profile-image-source-dialog__image"
                  key={`${item.storageKey || item.src}-${index}`}
                  onClick={() => onChooseExisting?.(item)}
                  title={item.label || 'Chọn ảnh'}
                >
                  <img src={item.src} alt={item.label || 'Ảnh đã đăng'} />
                </button>
              ))}
            </div>
          ) : (
            <div className="profile-image-source-dialog__empty"><ImagePlus size={22} />Chưa có ảnh trên hồ sơ. Hãy tải ảnh mới lên.</div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default ProfileImageSourceDialog;

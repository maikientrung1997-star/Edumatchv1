import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '@/components/common/Button';

export const ConfirmDialog = ({
  open,
  isOpen,
  title = 'Xác nhận thao tác',
  message,
  children,
  onConfirm,
  onCancel,
  onClose,
  confirmText = 'Xác nhận',
  cancelText = 'Huỷ bỏ',
  variant = 'danger',
  loading = false,
}) => {
  const isDialogOpen = open !== undefined ? open : isOpen;
  const handleClose = onCancel || onClose;

  return (
    <Modal
      open={isDialogOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      className="em-confirm-dialog"
      overlayClassName="em-confirm-dialog-overlay"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} size="sm" loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-full shrink-0 ${
            variant === 'danger' ? 'bg-danger-light text-danger' : 'bg-mint text-primary'
          }`}
        >
          {variant === 'danger' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <HelpCircle className="w-5 h-5" />
          )}
        </div>
        <div className="text-body text-muted leading-relaxed pt-0.5">
          {message || children || 'Bạn có chắc chắn muốn thực hiện thao tác này?'}
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;

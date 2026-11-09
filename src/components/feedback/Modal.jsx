import React, { useEffect, useId, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '@/utils/cn';

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const modalStack = [];
let bodyOverflow;

export const Modal = ({
  open,
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  overlayClassName,
  backButton = false,
  onKeyDown,
}) => {
  const isModalOpen = open !== undefined ? open : isOpen;
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isModalOpen) return;

    const dialog = dialogRef.current;
    const overlay = overlayRef.current;
    const previousFocus = document.activeElement;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]';
    const focusableElements = () =>
      Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (element) => element.getClientRects().length > 0
      );

    const handleKeyDown = (e) => {
      if (modalStack.at(-1)?.dialog !== dialog || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
      if (e.key === 'Tab') {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          dialogRef.current?.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === dialogRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    if (!modalStack.length) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const zIndex = (modalStack.at(-1)?.zIndex ?? 49) + 1;
    modalStack.push({ dialog, zIndex });
    overlay.style.zIndex = zIndex;
    window.addEventListener('keydown', handleKeyDown);
    (focusableElements()[0] || dialogRef.current)?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const wasTop = modalStack.at(-1)?.dialog === dialog;
      modalStack.splice(modalStack.findIndex((entry) => entry.dialog === dialog), 1);
      if (!modalStack.length) document.body.style.overflow = bodyOverflow;
      const nextDialog = modalStack.at(-1)?.dialog;
      if (wasTop) {
        const focusTarget = previousFocus?.isConnected && (!nextDialog || nextDialog.contains(previousFocus))
          ? previousFocus
          : nextDialog;
        focusTarget?.focus({ preventScroll: true });
      }
    };
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  return (
    <div ref={overlayRef} className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', overlayClassName)}>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Window */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'relative w-full rounded-surface bg-surface text-ink shadow-2xl border border-line flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-150',
          modalSizes[size] || modalSizes.md,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            {title && (
              <h3 id={titleId} className="text-h3 font-semibold text-ink">
                {title}
              </h3>
            )}
            {description && (
              <p id={descriptionId} className="text-body text-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={backButton ? 'Quay lại' : 'Đóng hộp thoại'}
            className="p-1.5 text-faint hover:text-ink rounded-control hover:bg-soft transition-colors"
          >
            {backButton ? <ArrowLeft size={21} aria-hidden="true" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Body Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer Actions */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-line bg-soft/50 flex items-center justify-end gap-2.5 rounded-b-surface">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

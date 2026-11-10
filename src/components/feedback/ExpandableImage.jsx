import { useEffect, useState } from 'react';
import { Modal } from '@/components/feedback/Modal';
import { getMediaUrl, hydrateMedia } from '@/utils/mediaLibrary';
import './expandableImage.css';

function useResolvedMediaSrc(mediaOrSrc, explicitStorageKey = '') {
  const rawSrc = typeof mediaOrSrc === 'string' ? mediaOrSrc : (mediaOrSrc?.src || '');
  const storageKey = explicitStorageKey || (typeof mediaOrSrc === 'object' ? (mediaOrSrc?.storageKey || '') : '');
  const initialSrc = storageKey ? getMediaUrl(storageKey, rawSrc) : rawSrc;
  const [hydratedSrc, setHydratedSrc] = useState(() => (storageKey ? getMediaUrl(storageKey, '') : ''));
  const [failedSrc, setFailedSrc] = useState('');

  useEffect(() => {
    if (!storageKey || getMediaUrl(storageKey, '')) return undefined;
    let active = true;
    hydrateMedia(storageKey)
      .then(({ src }) => {
        if (active && src) setHydratedSrc(src);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storageKey, rawSrc]);

  const resolvedSrc = storageKey ? (hydratedSrc || initialSrc) : rawSrc;
  const isBroken = !resolvedSrc || failedSrc === resolvedSrc;

  const handleError = () => {
    if (storageKey) {
      hydrateMedia(storageKey)
        .then(({ src }) => {
          if (src && src !== resolvedSrc) {
            setHydratedSrc(src);
          } else {
            setFailedSrc(resolvedSrc);
          }
        })
        .catch(() => setFailedSrc(resolvedSrc));
    } else {
      setFailedSrc(resolvedSrc);
    }
  };

  return { resolvedSrc, isBroken, handleError };
}

export function ExpandableImage({ src, storageKey = '', media = null, alt, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const { resolvedSrc, isBroken, handleError } = useResolvedMediaSrc(media || src, storageKey);

  if (isBroken) return null;

  return (
    <>
      <button
        type="button"
        className="expandable-image"
        onClick={() => setIsOpen(true)}
        aria-label={`Phóng to ${alt || 'ảnh đính kèm'}`}
      >
        <img className={className} src={resolvedSrc} alt={alt} onError={handleError} />
      </button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Ảnh đính kèm"
        size="xl"
        className="expandable-image-dialog"
      >
        <div className="expandable-image-dialog__content">
          <img src={resolvedSrc} alt={alt} />
        </div>
      </Modal>
    </>
  );
}

export function DiscussionMedia({ media, alt = '', className = '', expandable = false }) {
  const { resolvedSrc, isBroken, handleError } = useResolvedMediaSrc(media);

  if (!media || isBroken) return null;

  if (media.type === 'video') {
    return (
      <video
        className={className}
        src={resolvedSrc}
        controls
        preload="metadata"
        onError={handleError}
      />
    );
  }

  if (expandable) {
    return <ExpandableImage media={media} alt={alt} className={className} />;
  }

  return <img className={className} src={resolvedSrc} alt={alt} onError={handleError} />;
}

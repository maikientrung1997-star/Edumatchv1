import { useEffect, useRef, useState } from 'react';
import './postCommentList.css';

const BATCH_SIZE = 10;

export function PostCommentList({ items, renderItem, moreLabel = 'Xem thêm bình luận' }) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const moreRef = useRef(null);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    const target = moreRef.current;
    if (!hasMore || !target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setVisibleCount((current) => Math.max(current, visibleCount + BATCH_SIZE));
    }, { rootMargin: '120px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  return (
    <>
      {items.slice(0, visibleCount).map(renderItem)}
      {hasMore && (
        <button
          type="button"
          className="post-comment-list__more"
          ref={moreRef}
          onClick={() => setVisibleCount((current) => Math.max(current, visibleCount + BATCH_SIZE))}
        >
          {moreLabel}
        </button>
      )}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, CornerDownRight, X } from 'lucide-react';
import './postCommentList.css';

const BATCH_SIZE = 10;
// Phản hồi không cuộn vô hạn: hiện từng nhóm nhỏ, bấm "Xem thêm" để hiện nhóm tiếp theo.
const REPLY_BATCH_SIZE = 3;

export function ReplyTagBadge({ name, onRemove }) {
  if (!name) return null;
  return (
    <span className="reply-tag-badge" title={`Đang trả lời ${name}`}>
      <span className="reply-tag-badge__name">{name}</span>
      {onRemove && (
        <button
          type="button"
          className="reply-tag-badge__remove"
          onClick={onRemove}
          aria-label={`Bỏ gắn thẻ ${name}`}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export function ReplyTaggedText({ replyToName, to, onLinkClick, text }) {
  if (!text && !replyToName) return null;
  return (
    <p>
      {replyToName && (
        to ? (
          <Link to={to} onClick={onLinkClick} className="reply-mention-tag">
            {replyToName}
          </Link>
        ) : (
          <strong className="reply-mention-tag">{replyToName}</strong>
        )
      )}
      {replyToName && text ? ' ' : ''}
      {text}
    </p>
  );
}

const SORT_OPTIONS = [
  {
    value: 'oldest',
    label: 'Tất cả bình luận',
    description: 'Hiển thị tất cả bình luận, từ cũ nhất đến mới nhất.',
  },
  {
    value: 'newest',
    label: 'Mới nhất',
    description: 'Hiển thị các bình luận mới nhất lên trên cùng.',
  },
];

const parseItemTime = (item) => {
  if (item?.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const idMatch = String(item?.id || '').match(/(\d{13})/);
  if (idMatch) return Number(idMatch[1]);
  return null;
};

export function PostCommentList({
  items = [],
  renderItem,
  moreLabel = 'Xem thêm bình luận',
  variant,
  sortable = true,
  naturalOrder = 'asc',
  expanded = false,
  wrapperClassName = '',
}) {
  const isReplies = variant === 'replies' || moreLabel === 'Xem thêm phản hồi';
  const batchSize = isReplies ? REPLY_BATCH_SIZE : BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(batchSize);
  // Phản hồi mới gửi trong lúc xem luôn được hiện, kể cả khi nằm ngoài nhóm đang hiển thị.
  const [pinnedReplyIds, setPinnedReplyIds] = useState([]);
  const [prevItemCount, setPrevItemCount] = useState(items.length);
  const [replyToggleState, setReplyToggleState] = useState(() => ({
    open: Boolean(expanded),
    countAtClose: items.length,
  }));
  const [prevExpanded, setPrevExpanded] = useState(Boolean(expanded));
  const [sortOrder, setSortOrder] = useState('oldest');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const moreRef = useRef(null);
  const sortMenuRef = useRef(null);

  // `expanded` (đang mở ô trả lời) chỉ tự mở danh sách tại thời điểm bắt đầu trả lời,
  // không khóa danh sách ở trạng thái mở, để nút "Ẩn phản hồi" vẫn hoạt động.
  if (Boolean(expanded) !== prevExpanded) {
    setPrevExpanded(Boolean(expanded));
    if (expanded) setReplyToggleState((current) => ({ ...current, open: true }));
  }

  if (items.length !== prevItemCount) {
    setPrevItemCount(items.length);
    if (isReplies && items.length > prevItemCount) {
      const addedIds = items.slice(prevItemCount).map((item) => item?.id).filter(Boolean);
      setPinnedReplyIds((current) => [...current, ...addedIds]);
    }
  }

  const setRepliesOpen = (open) => {
    setReplyToggleState({ open, countAtClose: items.length });
    setVisibleCount(REPLY_BATCH_SIZE);
    setPinnedReplyIds([]);
  };

  const isRepliesOpen = replyToggleState.open || items.length > replyToggleState.countAtClose;

  useEffect(() => {
    if (!isSortMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!sortMenuRef.current?.contains(event.target)) {
        setIsSortMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortMenuOpen]);

  const sortedItems = useMemo(() => {
    if (isReplies || !sortable) return items;
    const indexed = items.map((item, index) => ({
      item,
      time: parseItemTime(item),
      chronologicalIndex: naturalOrder === 'desc' ? items.length - 1 - index : index,
    }));

    indexed.sort((first, second) => {
      if (first.time !== null && second.time !== null && first.time !== second.time) {
        return sortOrder === 'oldest' ? first.time - second.time : second.time - first.time;
      }
      return sortOrder === 'oldest'
        ? first.chronologicalIndex - second.chronologicalIndex
        : second.chronologicalIndex - first.chronologicalIndex;
    });

    return indexed.map((entry) => entry.item);
  }, [isReplies, items, naturalOrder, sortOrder, sortable]);

  const hasMore = visibleCount < sortedItems.length;

  useEffect(() => {
    const target = moreRef.current;
    if (isReplies || !hasMore || !target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setVisibleCount((current) => Math.max(current, visibleCount + BATCH_SIZE));
    }, { rootMargin: '120px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isReplies, visibleCount]);

  if (!items.length) return null;

  if (isReplies) {
    const latestReply = items[items.length - 1];
    const latestAuthor = latestReply?.isAnonymous
      ? 'Học viên ẩn danh'
      : (latestReply?.authorName || latestReply?.author || '');

    if (!isRepliesOpen) {
      return (
        <button
          type="button"
          className="post-comment-list__replies-toggle"
          onClick={() => setRepliesOpen(true)}
          aria-expanded="false"
        >
          <CornerDownRight size={14} aria-hidden="true" />
          {latestAuthor && <strong className="post-comment-list__replies-author">{latestAuthor} đã trả lời · </strong>}
          <span>{items.length > 1 ? `Xem tất cả ${items.length} phản hồi` : 'Xem 1 phản hồi'}</span>
        </button>
      );
    }

    const shownReplies = sortedItems.slice(0, visibleCount);
    const pinnedReplies = sortedItems.slice(visibleCount).filter((item) => pinnedReplyIds.includes(item?.id));
    const hiddenReplyCount = sortedItems.length - shownReplies.length - pinnedReplies.length;

    const content = (
      <>
        {shownReplies.map(renderItem)}
        {hiddenReplyCount > 0 && (
          <button
            type="button"
            className="post-comment-list__more post-comment-list__more--replies"
            onClick={() => setVisibleCount((current) => current + REPLY_BATCH_SIZE)}
          >
            <CornerDownRight size={14} aria-hidden="true" />
            Xem thêm {hiddenReplyCount} phản hồi
          </button>
        )}
        {pinnedReplies.map(renderItem)}
        <button
          type="button"
          className="post-comment-list__replies-collapse"
          onClick={() => setRepliesOpen(false)}
          aria-expanded="true"
        >
          Ẩn phản hồi
        </button>
      </>
    );

    return wrapperClassName ? <div className={wrapperClassName}>{content}</div> : content;
  }

  const activeSortOption = SORT_OPTIONS.find((option) => option.value === sortOrder) || SORT_OPTIONS[0];

  return (
    <>
      {sortable && items.length > 0 && (
        <div className="post-comment-list__toolbar">
          <div className="post-comment-list__sort" ref={sortMenuRef}>
            <button
              type="button"
              className="post-comment-list__sort-trigger"
              aria-haspopup="menu"
              aria-expanded={isSortMenuOpen}
              onClick={() => setIsSortMenuOpen((current) => !current)}
            >
              <span>{activeSortOption.label}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {isSortMenuOpen && (
              <div className="post-comment-list__sort-menu" role="menu" aria-label="Bộ lọc bình luận">
                {SORT_OPTIONS.map((option) => {
                  const isSelected = option.value === sortOrder;
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      key={option.value}
                      className={`post-comment-list__sort-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSortOrder(option.value);
                        setIsSortMenuOpen(false);
                      }}
                    >
                      <div className="post-comment-list__sort-option-text">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </div>
                      {isSelected && <Check size={16} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {sortedItems.slice(0, visibleCount).map(renderItem)}
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

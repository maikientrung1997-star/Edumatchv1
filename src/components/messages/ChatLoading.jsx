/** Presentation only: placeholders mirror the real chat layout without delaying data. */
function Skeleton({ className = '' }) {
  return <span className={`em-skeleton ${className}`} />;
}

export function ChatHeaderLoading() {
  return <div className="em-header-loading" aria-hidden="true"><Skeleton className="em-skeleton--avatar"/><div><Skeleton className="em-skeleton--name"/><Skeleton className="em-skeleton--short"/></div></div>;
}

export function ChatLoading({ variant = 'inbox' }) {
  const label = { inbox: 'Đang tải hội thoại', messages: 'Đang tải tin nhắn', details: 'Đang tải thông tin hội thoại', media: 'Đang tải ảnh đã chia sẻ', files: 'Đang tải tệp đã chia sẻ' }[variant];
  return <div className={`em-loading em-loading--${variant}`} role="status" aria-label={label}>
    <span className="sr-only">{label}...</span>
    <div aria-hidden="true">
      {variant === 'inbox' && Array.from({ length: 6 }, (_, index) => <div className="em-loading-contact" key={index}><Skeleton className="em-skeleton--avatar"/><div><Skeleton className="em-skeleton--name"/><Skeleton className="em-skeleton--preview"/></div><Skeleton className="em-skeleton--time"/></div>)}
      {variant === 'messages' && <><div className="em-loading-date"><Skeleton/></div>{Array.from({ length: 5 }, (_, index) => <div className={`em-loading-message ${index % 2 ? 'is-own' : ''}`} key={index}>{index % 2 === 0 && <Skeleton className="em-skeleton--avatar"/>}<div><Skeleton className="em-skeleton--bubble"/><Skeleton className="em-skeleton--time"/></div></div>)}<p className="em-loading-caption"><span/><span/><span/>Đang tải cuộc trò chuyện</p></>}
      {variant === 'details' && <><div className="em-loading-profile"><Skeleton className="em-skeleton--avatar"/><Skeleton className="em-skeleton--name"/><Skeleton className="em-skeleton--short"/></div>{Array.from({ length: 3 }, (_, index) => <div className="em-loading-fact" key={index}><Skeleton/><div><Skeleton className="em-skeleton--short"/><Skeleton className="em-skeleton--preview"/></div></div>)}<div className="em-loading-gallery">{Array.from({length:6}, (_,index) => <Skeleton key={index}/>)}</div></>}
      {variant === 'media' && <div className="em-loading-gallery">{Array.from({length:6}, (_,index) => <Skeleton key={index}/>)}</div>}
      {variant === 'files' && Array.from({length:3}, (_,index) => <div className="em-loading-fact" key={index}><Skeleton/><div><Skeleton className="em-skeleton--name"/><Skeleton className="em-skeleton--short"/></div></div>)}
    </div>
  </div>;
}

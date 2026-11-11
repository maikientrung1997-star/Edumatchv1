import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/common/Button';
import './request-state.css';

export function Skeleton({ width, height, className = '' }) {
  return <span className={'request-skeleton ' + className} style={{ width, height }} aria-hidden="true" />;
}

export function RequestNotice({ title, description, onRetry, children }) {
  return (
    <div className="request-notice">
      <span className="request-notice__icon" aria-hidden="true"><WifiOff size={21} /></span>
      <div className="request-notice__copy" role="alert">
        <p className="request-notice__title">{title}</p>
        {description && <p className="request-notice__description">{description}</p>}
      </div>
      <div className="request-notice__actions">
        {onRetry && <Button type="button" variant="outline" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Thử lại</Button>}
        {children}
      </div>
    </div>
  );
}

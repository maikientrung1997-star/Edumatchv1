import { Skeleton } from '@/components/feedback/RequestState';

const cards = [0, 1, 2];

export function CatalogLoading({ providers = false, label }) {
  return (
    <>
      <span className="sr-only" role="status">{label}</span>
      {cards.map((card) => (
        <div key={card} className={(providers ? 'tutor-card' : 'course-card') + ' catalog-skeleton'} aria-hidden="true">
          {providers ? (
            <div className="catalog-skeleton__identity">
              <Skeleton width={54} height={60} />
              <div className="catalog-skeleton__stack">
                <Skeleton width="72%" height={16} />
                <Skeleton width="47%" />
                <Skeleton width="62%" />
              </div>
            </div>
          ) : (
            <>
              <div className="catalog-skeleton__split">
                <Skeleton width={68} height={20} className="request-skeleton--pill" />
                <Skeleton width={47} />
              </div>
              <Skeleton width={card === 1 ? '76%' : '88%'} height={19} />
              <div className="catalog-skeleton__identity">
                <Skeleton width={24} height={24} className="request-skeleton--round" />
                <Skeleton width="46%" />
              </div>
            </>
          )}
          <div className="catalog-skeleton__facts"><Skeleton width="38%" /><Skeleton width="29%" /></div>
          <div className="catalog-skeleton__split catalog-skeleton__footer">
            <Skeleton width="28%" height={17} />
            <Skeleton width="40%" height={33} />
          </div>
        </div>
      ))}
    </>
  );
}

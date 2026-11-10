import { useParams } from 'react-router-dom';
import { FeedPage } from './FeedPage';

/** A standalone, shareable page for one post while retaining the full discussion UI. */
export function PostDetailPage() {
  const { postId } = useParams();
  return <FeedPage key={postId} postId={postId} />;
}

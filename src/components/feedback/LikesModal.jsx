import { useMemo } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from './Modal';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { getCourses, getPosts } from '@/features/learning/marketplace';
import './likes-modal.css';

const addProfile = (directory, id, name, avatar = '', role = 'student') => {
  if (!id) return;
  directory.set(id, { id, name: name || 'Thành viên EduMatch', avatar, role });
};

const profileDirectory = (user) => {
  const directory = new Map();
  getCourses().forEach((course) => addProfile(directory, course.teacher?.id, course.teacher?.name, course.teacher?.avatar, course.teacher?.role));
  getPosts().forEach((post) => {
    addProfile(directory, post.authorId || post.teacherId, post.authorName || post.author || post.teacherName, post.authorAvatar, post.authorRole);
    (post.comments || []).forEach((comment) => {
      addProfile(directory, comment.authorId, comment.authorName || comment.author, comment.authorAvatar, comment.authorRole);
      (comment.replies || []).forEach((reply) => addProfile(directory, reply.authorId, reply.authorName || reply.author, reply.authorAvatar, reply.authorRole));
    });
  });
  addProfile(directory, user?.id, user?.name, user?.avatar, user?.role);
  return directory;
};

export function LikesModal({ target, onClose }) {
  const { user } = useAuth();
  const people = useMemo(() => {
    const directory = profileDirectory(user);
    return (target?.ids || []).map((id) => directory.get(id) || { id, name: 'Thành viên EduMatch', avatar: '' });
  }, [target?.ids, user]);

  const icon = target?.kind === 'share' ? <Share2 size={15} aria-hidden="true" /> : <Heart size={15} fill="currentColor" aria-hidden="true" />;
  return <Modal open={Boolean(target)} onClose={onClose} title={target?.title || 'Lượt thích'} description={target?.label || 'Những người đã bày tỏ sự yêu thích'} size="sm">
    <div className="likes-modal__list">
      {people.map((person, index) => <Link className="likes-modal__person" key={`${person.id}-${index}`} to={ROUTES.TEACHER_PROFILE(person.id)} onClick={onClose}>
        <span className="likes-modal__avatar">{person.avatar ? <img src={person.avatar} alt="" /> : <DefaultRoleAvatar role={person.role} size={17} />}</span>
        <strong>{person.name}</strong>
        <span className={`likes-modal__marker ${target?.kind === 'share' ? 'is-share' : ''}`}>{icon}</span>
      </Link>)}
      {!people.length && <p className="likes-modal__empty">{target?.emptyText || 'Chưa có lượt thích.'}</p>}
    </div>
  </Modal>;
}

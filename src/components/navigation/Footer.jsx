import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, GraduationCap, Mail, MessageCircle } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import './footer.css';

export const Footer = () => {
  const homeSection = (section) => `${ROUTES.HOME}#${section}`;
  const navigate = useNavigate();
  const { canUseStudentConsultation } = useAuth();
  const openDialog = (name) => navigate({ pathname: ROUTES.HOME, search: `?dialog=${name}` });
  return (
    <footer className="edu-footer">
      <div className="edu-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to={ROUTES.HOME} className="edu-brand">
              <span className="brand-symbol">
                E<span />
              </span>
              <span>
                Edu<span className="accent-text">Match</span>
              </span>
            </Link>
            <p>
              Kết nối tri thức, nuôi dưỡng tiềm năng.
              <br />
              Người thầy phù hợp cho mỗi hành trình.
            </p>
            <div className="footer-socials">
              <button onClick={() => openDialog('support')} aria-label="Trò chuyện hỗ trợ">
                <MessageCircle size={18} />
              </button>
              {canUseStudentConsultation && (
                <button onClick={() => openDialog('consultation')} aria-label="Tư vấn học tập">
                  <GraduationCap size={19} />
                </button>
              )}
              <Link to={homeSection('mon-hoc')} aria-label="Khám phá môn học">
                <BookOpen size={18} />
              </Link>
            </div>
          </div>
          <div className="footer-contact">
            <h3>Thông tin liên hệ</h3>
            <p className="footer-contact__address">Văn phòng đại diện: 223 Quan Hoa, Cầu Giấy, Hà Nội, Việt Nam</p>
            <a className="footer-contact__hotline" href="tel:19001345">Hỗ trợ học viên: <strong>19001345</strong></a>
            <a className="footer-contact__hotline" href="tel:19001234">Giáo viên &amp; đối tác: <strong>19001234</strong></a>
            <Link className="footer-support" to={ROUTES.CONTACT}>
              <Mail size={17} />
              Kết nối với EduMatch
              <ArrowUpRight size={16} />
            </Link>
            <span>Học tập tốt hơn, mỗi ngày.</span>
          </div>
          <div>
            <h3>Dành cho Học viên</h3>
            <Link to={homeSection('khoa-hoc')}>Tìm kiếm lớp học phù hợp</Link>
            <Link to={homeSection('giao-vien')}>Tìm kiếm giáo viên phù hợp</Link>
            {canUseStudentConsultation && <button onClick={() => openDialog('consultation')}>Tư vấn lộ trình học tập</button>}
            <Link to={homeSection('danh-gia')}>Câu chuyện học viên</Link>
            <button onClick={() => openDialog('faq')}>Câu hỏi thường gặp</button>
          </div>
          <div>
            <h3>Dành cho Giáo viên và Đối tác</h3>
            <Link to={ROUTES.CENTER_SUPPORT}>Hỗ trợ trung tâm đào tạo</Link>
            <Link to={ROUTES.PARTNER_TERMS}>Điều khoản Giáo viên &amp; Đối tác</Link>
            <Link to={ROUTES.LOGIN}>Đăng nhập tài khoản</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} EduMatch. Kết nối để cùng tiến bộ.</p>
          <div>
            <button onClick={() => openDialog('terms')}>Điều khoản sử dụng</button>
            <button onClick={() => openDialog('privacy')}>Chính sách bảo mật</button>
            <Link to={ROUTES.CONTACT}>Liên hệ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

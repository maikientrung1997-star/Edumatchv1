import { useEffect, useRef } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import './content-menu.css';

export function ContentMenu({ id, openId, onToggle, onEdit, onDelete, label = 'nội dung' }) {
  const menuRef = useRef(null);
  const isOpen = openId === id;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) onToggle(null);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick, true);
  }, [isOpen, onToggle]);

  return <div className="content-menu" ref={menuRef}>
    <button type="button" className="content-menu__trigger" onClick={() => onToggle(isOpen ? null : id)} aria-label={`Tùy chọn ${label}`} aria-expanded={isOpen}>
      <MoreHorizontal size={18} />
    </button>
    {isOpen && <div className="content-menu__popover" role="menu">
      <button type="button" role="menuitem" onClick={() => { onEdit(); onToggle(null); }}><Pencil size={14} /> Chỉnh sửa</button>
      <button type="button" role="menuitem" onClick={() => { onDelete(); onToggle(null); }}><Trash2 size={14} /> Xóa</button>
    </div>}
  </div>;
}

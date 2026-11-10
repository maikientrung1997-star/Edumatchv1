# Theme chung của EduMatch

`theme.css` là nơi duy nhất định nghĩa giá trị font, cỡ chữ, màu thương hiệu,
bo góc, bóng đổ và chiều rộng nội dung. Các giá trị lấy từ giao diện Home đã
được duyệt. File được import một lần trong `src/index.css`; page mới không cần
import lại hoặc khai báo bảng màu riêng.

## Typography

Font mặc định là **Be Vietnam Pro**, tải tại dự án với các weight
400 / 500 / 600 / 700 / 800. `font-sans` cũng dùng đúng font này.

| Vai trò | Class Tailwind | Biến CSS | Cỡ chữ / line-height |
| --- | --- | --- | --- |
| Banner lớn | `text-display` | `--text-display` | clamp(31px, 3.28vw, 46px) / 1.2 |
| Tiêu đề trang | `text-h1` | `--text-h1` | 28px / 1.25, weight 800 |
| Tiêu đề section | `text-h2` | `--text-h2` | 22px / 1.3, weight 700 |
| Tiêu đề card, dialog | `text-h3` | `--text-h3` | 18px / 1.35, weight 600 |
| Tiêu đề nhóm nhỏ | `text-h4` | `--text-h4` | 15px / 1.4, weight 600 |
| Nội dung chính | `text-body` | `--text-body` | 14px / 1.6 |
| Input, button, mô tả ngắn | `text-control` | `--text-control` | 12px / 1.6 |
| Chú thích | `text-caption` | `--text-caption` | 11px / 1.5 |
| Chú thích nhỏ | `text-caption-xs` | `--text-caption-xs` | 10px / 1.5 |
| Nhãn ngắn | `text-micro` | `--text-micro` | 9px / 1.4, weight 700 |

Các thẻ `h1`–`h4` tự nhận chuẩn tương ứng; body tự nhận `text-body`.
Không cần thêm `text-2xl`, `text-base` hoặc font khác cho mỗi page.
Home vẫn giữ các kích thước đặc thù của từng thành phần và breakpoint đã duyệt.
Các alias `--edu-*` giúp Home, Login, Register sử dụng cùng theme mà giữ nguyên
bố cục desktop và cách đặt ảnh cạnh nội dung trên mobile.

## Dùng với React / Tailwind

```jsx
import { Button } from '@/components/common/Button';

export function NewPage() {
  return (
    <main className="app-container py-8">
      <h1>Tiêu đề màn hình</h1>
      <p className="mt-2 text-control text-muted">Mô tả ngắn của màn hình.</p>
      <section className="mt-6 rounded-surface border border-line bg-surface p-6 shadow-edu">
        <h2>Thông tin của bạn</h2>
        <p className="mt-2 text-body text-muted">Nội dung chính.</p>
        <Button className="mt-4">Lưu thông tin</Button>
      </section>
    </main>
  );
}
```

Các class màu: `bg-primary`, `hover:bg-primary-hover`, `bg-primary-light`,
`bg-tag`, `bg-mint`, `bg-bg`, `bg-surface`, `bg-soft`, `text-ink`, `text-muted`,
`text-faint`, `border-line`, `border-line-strong`, `focus-visible:ring-focus`,
`text-badge-gold`, `bg-badge-gold-bg`.

`app-container` có chiều rộng tối đa 1240px và tổng khoảng trống hai bên
80px trên desktop, 56px ở ≤1200px, 48px ở ≤1023px và 32px ở ≤767px.
Button mặc định dùng chữ 12px, cao 44px và bo góc 10px; size `sm` dùng cho
hành động phụ, size `lg` dùng chữ 14px. Variant danger/success giữ màu trạng thái.

## Dùng với CSS riêng

```css
.new-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-surface);
  box-shadow: var(--shadow-edu);
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}
```

CSS riêng chỉ định nghĩa bố cục hoặc chi tiết đặc thù của thành phần.
Màu và typography dùng lại token thay vì sao chép mã HEX hoặc font family.

## Dùng trong JavaScript / icon / chart

```jsx
import { Search } from 'lucide-react';
import { COLORS, resolveThemeColor } from '@/constants/theme';

<Search color={COLORS.primary} />;
<div style={{ color: COLORS.ink, background: COLORS.surface }}>Nội dung</div>;

// Trong effect, sau khi stylesheet đã được tải:
context.fillStyle = resolveThemeColor('primary');
```

`COLORS` trả về chuỗi `var(--color-...)` cho CSS và SVG. Với Canvas hoặc thư
viện chart yêu cầu mã màu cụ thể, gọi `resolveThemeColor('primary')` ở phía
trình duyệt. Cách này giữ bảng màu gốc ở `theme.css`, tránh phải sửa mã HEX ở
cả CSS và JS. `@theme static` bảo đảm biến tồn tại dù chưa dùng class Tailwind.

## Thay đổi theme

Sửa token trong `theme.css`, sau đó kiểm tra Home, `/login`, `/register` và
`/register?role=teacher` ở desktop/mobile. Giữ màu riêng cho trạng thái
và minh họa môn học.

## Trang khóa học trong MainLayout

`CourseCard`, các trang trong `Courses` và `AdministrativePicker` dùng cùng
token typography, container và màu với Home. Trong `.edu-site`, heading cũ
được reset để giữ bố cục Home; CSS của page mới cần khai báo cả cỡ chữ,
font-weight và line-height bằng token tương ứng (không chỉ font-size).

Màu `--edu-bg`, `--edu-surface`, `--edu-ink`, `--edu-muted`, `--edu-green`
trỏ về bảng màu chung của EduMatch.
Chữ trên button nền thương hiệu dùng `--edu-on-primary`. Màu trạng thái
đóng lớp/lỗi vẫn giữ ý nghĩa riêng.

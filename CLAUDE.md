# EduMatch – hướng dẫn cho Claude

React 19 + Vite + Tailwind CSS v4. Alias `@/` trỏ tới `src/`.

## Lệnh

- `npm run dev` – chạy dev server
- `npm run build` – build production
- `npm run lint` – ESLint
- `npm run format` – Prettier
- Test: `npm run test:auth`, `test:chat`, `test:google`, `test:phase2`

## Thiết kế: font, cỡ chữ, màu (BẮT BUỘC)

Trước khi làm hoặc sửa bất kỳ giao diện nào, đọc `src/styles/README.md`.
`src/styles/theme.css` là nguồn duy nhất của font, cỡ chữ, màu, bo góc, bóng đổ.

- **Font:** chỉ dùng Be Vietnam Pro qua `font-sans` / `var(--font-sans)`.
  Không thêm font khác, không ghi `font-family` cứng.
- **Cỡ chữ:** chỉ dùng token chung.
  - Tailwind: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-h4`,
    `text-body`, `text-control`, `text-caption`, `text-caption-xs`, `text-micro`.
  - CSS riêng: `font-size: var(--text-body); line-height: var(--text-body--line-height);`
    (khai báo cả font-size, line-height và font-weight bằng token tương ứng).
  - Không ghi cỡ chữ cứng (`13px`, `12.5px`, `1rem`…), không dùng `text-[13px]`,
    `text-sm`, `text-base`, `text-xl`…
  - Nếu thiết kế cần một cỡ chưa có trong bảng, hỏi người dùng trước khi thêm
    token mới vào `theme.css`, không tự chế cỡ riêng trong file CSS của trang.
- **Màu:** dùng class/biến theme (`bg-primary`, `text-ink`, `text-muted`,
  `border-line`, `var(--color-surface)`…). Không chép mã HEX.
  Trong JS dùng `COLORS` / `resolveThemeColor` từ `@/constants/theme`.
- **Bố cục:** dùng `app-container`, `rounded-surface`, `shadow-edu`,
  component `Button` từ `@/components/common/Button`.
- **Ngoại lệ:** `src/pages/Home/home.css` cố ý giữ một số kích thước riêng đã duyệt;
  không tự chuyển đổi trừ khi người dùng yêu cầu.
- Khi sửa file CSS có sẵn cỡ chữ cứng, chỉ đổi sang token nếu nằm trong phạm vi
  việc được giao; không sửa lan sang chỗ khác.

Skill `design-taste-frontend` chỉ áp dụng phần phù hợp; với trang sản phẩm
(Feed, Chat, Khóa học, Hồ sơ…) luôn ưu tiên token và component sẵn có ở trên.

## Kiểm tra sau khi đổi giao diện

Xem lại trang đã sửa ở cả desktop và mobile (≤767px). Nếu đổi `theme.css`,
kiểm tra thêm Home, `/login`, `/register`, `/register?role=teacher`.

## Khác

- Giao tiếp với người dùng bằng tiếng Việt.
- Không commit/push trừ khi người dùng yêu cầu.

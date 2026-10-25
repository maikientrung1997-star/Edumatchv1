# Giao diện tin nhắn

- Route `/tin-nhan` vẫn giữ `ProtectedRoute`; `MainLayout` ẩn Header, Footer và FloatingChat ở route này.
- `index.js` xuất `MessengerWorkspace` dưới tên `MessagesPage`.
- `MessengerWorkspace.jsx` là bản UI theo ảnh mẫu. `CONTACTS`, `HISTORY`, trạng thái gửi tin, reaction, ghi chú và tệp đều là dữ liệu cục bộ; tải lại trang sẽ đặt lại. Không gọi API, Pusher hoặc lưu hội thoại vào localStorage.
- `MessagesPage.jsx` và `messages.css` cũ được giữ nguyên để tham khảo, tái sử dụng logic khi tích hợp.
- Emoji dùng `emoji-picker-react`, tải khi mở bộ chọn. Icon điều khiển dùng Lucide có sẵn trong dự án.
- Mobile dưới 768px: mặc định danh sách; chọn hội thoại để mở chat, mũi tên trong chat quay về danh sách. Nút thông tin mở bảng bên cạnh. Dưới 1280px, thông tin hội thoại mở dưới dạng drawer.
- Các nút gọi, hồ sơ và tạo lớp chỉ mở thông báo xem trước, chưa kết nối chức năng thật.
- Font, typography và màu sử dụng token trong `src/styles/theme.css`, bao gồm chế độ tối của MainLayout.

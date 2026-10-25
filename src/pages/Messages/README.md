# Tin nhắn realtime

`MessengerWorkspace.jsx` và `MessagesPage.jsx` xuất giao diện `RealtimeMessengerWorkspace.jsx` tại `/tin-nhan`. Bố cục ba cột và theme cũ được giữ; mobile mở danh sách, hội thoại và bảng thông tin theo từng màn.

- Dữ liệu thực qua `services/chatService.js`, không dùng CONTACTS/HISTORY/localStorage làm kho tin nhắn.
- `ChatProvider` quản lý inbox, unread và presence toàn ứng dụng. Header và FloatingChat cũng dùng dữ liệu này.
- `hooks/useRealtimeChat.js` quản lý private channel, lịch sử cursor, optimistic send/retry, read watermark, reaction và typing. Mỗi hội thoại được key theo user và ID để không lẫn state khi chuyển người dùng.
- `pusherService.js` dùng chung một kết nối WebSocket với thông báo. Channel pool chỉ unsubscribe khi hết bên sử dụng. Không polling hoặc XHR transport fallback.
- REST chỉ tải ban đầu, thao tác người dùng, focus/reconnect và tải bù sau sự kiện; không có interval tải tin hay đếm unread.
- `ChatPieces.jsx` chứa lịch sử, composer, emoji lazy-load, tệp private, lightbox và ghi chú autosave 800 ms. Công thức dùng KaTeX lazy-load, không cho HTML tin cậy.
- Tìm tên/điện thoại/email, mở lại direct, lọc all/unread/direct/group và tạo nhóm tối đa 20 thành viên. Người dạy từ CTA phải có ID BE thật; không đổi ID mẫu thành tài khoản khác.
- Ảnh, tài liệu tải bằng Bearer dưới dạng blob. Mỗi lần gửi tối đa 3 tệp, mỗi tệp 10 MB. Ghi chú chỉ tài khoản lưu thấy được.

## Cấu hình

FE cần `VITE_API_BASE_URL`, `VITE_PUSHER_APP_KEY`, `VITE_PUSHER_APP_CLUSTER`, tùy chọn `VITE_PUSHER_AUTH_ENDPOINT`. Không đặt Pusher secret ở FE. Khởi động lại Vite khi đổi `.env`.

Typing mặc định dùng POST do thao tác gõ để server push `message.typing`. Có thể bật client events ở Pusher và `CHAT_CLIENT_TYPING=true` tại BE để dùng `client-typing`. Cả hai cách đều không polling.

Tài liệu BE đầy đủ: `C:/laragon/www/admin_edumatchv1/app/docs/realtime-chat.md`.

## Kiểm tra

`npm run test:chat`, `npm run test:auth`, `npm run test:phase2`, `npm run lint`, `npm run build`.

Đã thử hai phiên độc lập với Pusher thật và schema QA riêng; ảnh minh chứng lưu tại `output/qa/realtime-chat-teacher.png`.

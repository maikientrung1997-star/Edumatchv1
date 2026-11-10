# Kế hoạch lưu thẻ và trạng thái chưa đọc

Phạm vi là các thao tác chọn, gắn, bỏ gắn và lọc thẻ của hội thoại, cùng thao tác đánh dấu chưa đọc. Trước khi sửa, FE lưu thẻ và cờ chưa đọc trong `localStorage`. Hàm `chatService.markUnread` trả về Promise rỗng.

| Hạng mục | Cách thực hiện | Tiêu chí nghiệm thu |
| --- | --- | --- |
| Chọn và gắn thẻ | Backend cấp sẵn VIP, Cần tư vấn, Đang học, Đã hoàn thành và Khác. Liên kết được lưu trong `chat_conversation_tags`. | Tải lại trang hoặc mở trên thiết bị khác vẫn thấy thẻ đã gắn. Mỗi tài khoản gắn tối đa hai thẻ cho một hội thoại. |
| Bỏ gắn thẻ | Bỏ gắn xóa liên kết của tài khoản với đúng hội thoại. Menu Phân loại chỉ liệt kê các mục mẫu. | Thẻ biến mất khỏi thanh hội thoại và danh sách tin nhắn. Thẻ mẫu vẫn có trong menu để chọn lại. |
| Lọc theo thẻ | Dùng `GET /api/chat/conversations?tag_id=...` và phân trang theo kết quả lọc. | Tìm được cả hội thoại ngoài trang đầu của danh sách chung. |
| Đánh dấu chưa đọc | Lưu `chat_participants.is_manual_unread` theo thành viên. Cập nhật qua `PUT /api/chat/conversations/{id}/unread` và đồng bộ trên kênh riêng đã có. | Số hội thoại chưa đọc phản ánh cờ đánh dấu. Số tin chưa đọc và mốc đã xem phản ánh tin nhắn thực tế. |

## Thứ tự triển khai và kiểm tra

1. Chạy migration BE rồi triển khai API Laravel. Migration thêm hai bảng và hai cột có giá trị mặc định cho dữ liệu hiện có.
2. Triển khai FE. Thư viện thẻ tải khi mở màn tin nhắn, còn các thao tác sửa gửi request theo hành động người dùng.
3. Kiểm tra gắn, bỏ gắn và lọc thẻ bằng hai tài khoản. Kiểm tra cờ chưa đọc trên hai phiên của cùng tài khoản và kiểm tra lại gửi, nhận, đã xem, typing, presence và tải bù khi kết nối lại.

Các thẻ và cờ đã tạo bằng bản cũ chỉ có trên trình duyệt đã tạo chúng. Bản này giữ dữ liệu cũ ở đó và bắt đầu sử dụng dữ liệu BE cho các thao tác mới.

Thẻ tự tạo đã được lưu vào DB trước khi áp dụng danh mục mẫu vẫn hiển thị ở các hội thoại đang gắn chúng. Người dùng có thể gỡ các thẻ đó.

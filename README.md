# DiNhiChat - PWA Chat 2 Người

Ứng dụng chat Web PWA riêng tư dành cho 2 người, tối ưu cho iPhone (iOS 16.4+) hỗ trợ Web Push Notifications.

## Cài đặt trên iPhone (iOS 16.4+)
1. Mở liên kết ứng dụng trên **Safari**: `https://<TEN_GITHUB>.github.io/dinhichat/`
2. Bấm nút **Chia sẻ** (biểu tượng hình vuông có mũi tên hướng lên ở thanh công cụ dưới).
3. Chọn **Thêm vào Màn hình chính** (Add to Home Screen).
4. Ra màn hình chính, mở ứng dụng từ icon **DiNhiChat**.
5. Nhập email & mật khẩu đã được cấp để **Đăng nhập**.
6. Bấm nút **🔔 Bật thông báo** ở góc trên và chọn **Cho phép** (Allow).

## Xử lý sự cố (Troubleshooting)
- **Không nhận được thông báo**:
  - Kiểm tra **Cài đặt** trên iPhone → cuộn xuống tìm **DiNhiChat** → mục **Thông báo** (Notifications) → bật **Cho phép thông báo**.
  - Kiểm tra chế độ **Tập trung** (Focus / Do Not Disturb) xem có đang chặn thông báo không.
  - Xem log Edge Function `notify` trong Supabase Dashboard (**Edge Functions** → `notify` → **Logs**).
- **Lỗi 410 / Hết hạn token Push**:
  - Mở app từ icon trên Màn hình chính, bấm nút **🔔 Bật thông báo** (nếu hiện) để cấp phát lại subscription mới.
- **App bị lỗi hiển thị / cache cũ**:
  - Xóa icon DiNhiChat trên màn hình chính, vào lại Safari và chọn **Thêm vào Màn hình chính** lại từ đầu.

## Cách cập nhật mã nguồn
Mỗi khi chỉnh sửa file, chỉ cần commit và push lên nhánh `main`:
```bash
git add .
git commit -m "Cập nhật ứng dụng"
git push origin main
```
GitHub Pages sẽ tự động cập nhật phiên bản mới nhất.

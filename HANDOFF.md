# DiNhiChat - HANDOFF
## Stack
- Vanilla JS, HTML5, CSS3 (PWA), Supabase (Auth, Postgres, Realtime, Storage, Edge Functions, pg_cron).
- Project ref: tqzmqobxzlxgfiyujlyj | Host: https://dylululu.github.io/dinhichat/

## Quy tắc làm việc
- Trả lời tiếng Việt, cực ngắn
- Không chạy git add/commit/push (tôi tự làm)
- Không đụng config.js, .env.local; không in secret
- Chỉ sửa file được nêu trong yêu cầu

## Bản đồ file
- `index.html`: UI chat, login, typing-indicator, attach menu, preview ảnh, thanh chat responsive.
- `app.js`: Logic client (initChat, addMsg, sendMessage, syncMessages, subscribeRoom, markRead, renderSeen, sendTyping, showTyping, cache).
- `sw.js`: Service worker (hiển thị webpush, notificationclick sync app).
- `config.js`: Cấu hình public SUPABASE_URL, anon key, VAPID_PUBLIC_KEY.
- `supabase/functions/notify/index.ts`: Edge Function gửi push tức thì khi có tin nhắn mới.
- `supabase/functions/remind/index.ts`: Edge Function kiểm tra chưa rep và push nhắc nhở (x-cron-secret).
- `supabase/cron.local.sql`: Script mẫu lệnh `cron.schedule` gọi edge function `remind`.
- `supabase/migrations/005_read.sql`: Thêm read_at, policy update cho người nhận, trigger bảo vệ tin nhắn.

## Database
- Bảng: `profiles` (id, name, push_subscription), `messages` (id, sender_id, content, created_at, image_path, remind_mode, remind_count, next_remind_at, remind_done, read_at). Bucket: `chat-images`.
- Migrations: `001_init.sql`, `002_images.sql`, `004_remind.sql`, `005_read.sql`.
- Functions deployed: `notify`, `remind`.

## Đã xong
- Đăng nhập 2 tài khoản, chat realtime và chống trùng tin nhắn.
- Web Push PWA (hỗ trợ iOS Safari PWA).
- Gửi ảnh: nén canvas 1280px JPEG, lưu private bucket, signed URL cache, xem toàn màn hình.
- Cache localStorage 100 tin, đồng bộ nhanh khi mở/focus/click thông báo.
- Nhắc lại tin nhắn (chế độ none/1/2/loop, hiện icon 🔔/🔁, trigger đặt next_remind_at, cron job định kỳ).
- Tinh chỉnh CSS thanh nhập tin nhắn responsive không tràn màn hình điện thoại.
- "Iu dấu đã xem": cập nhật read_at khi visible, hiện "Iu dấu đã xem lúc HH:mm" / "Đã gửi" ở tin cuối.
- "Iu dấu đang nhập": Realtime broadcast channel typing-room, hiện "💕 [tên] đang nhập...", tự ẩn sau 4s/stop.

## Đang làm / Dở dang
- Kiểm tra bằng `npx serve .`, tự chạy git add/commit/push lên GitHub, xóa icon iPhone rồi thêm lại.

## Lỗi đã biết / Lưu ý
- Kết nối trực tiếp DB bị chặn pass; chạy migration qua Supabase Management Query API.
- Background task trong Edge function bị ngắt khi trả response; đã chuyển sang pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

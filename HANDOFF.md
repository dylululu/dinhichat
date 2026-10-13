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
- `index.html`: UI chat, #kb bàn phím hồng, Telex/emoji và 🌐 chuyển bàn phím iOS; #chat-cover cố định 100lvh+120px, trượt parallax, sticker tray, trả lời, ảnh; viewport 1x.
- `app.js`: Logic client (initChat, ensurePush, openPinkKeyboard, handleKeyboardKey, convertTelexAtCaret, fitViewport RAF + visualViewport, cuộn list/ResizeObserver, chặn zoom gesture, resizeMessageInput, renderRemindMode, addMsg, addOptimisticMessage, promoteOptimisticRow, resolveReplyId, animateMessage, animateSendTextEffect, animateSendGatherEffect, loadCover, refreshCoverFromServer, openCoverCrop, layoutCoverCrop, exportCoverCrop, uploadCover, loadStickers, sendSticker, startReply, cache).
- `supabase/functions/remind/index.ts`: Gửi nhắc một lần, hai lần hoặc lặp đến khi người kia trả lời.
- `sw.js`: Service worker (hiển thị webpush, notificationclick sync app).
- `config.js`: Cấu hình public SUPABASE_URL, anon key, VAPID_PUBLIC_KEY.
- `supabase/functions/notify/index.ts`: Edge Function gửi push tức thì, nội dung riêng cho sticker.
- `supabase/functions/remind/index.ts`: Edge Function kiểm tra chưa rep và push nhắc nhở (x-cron-secret).
- `supabase/cron.local.sql`: Script mẫu lệnh `cron.schedule` gọi edge function `remind`.
- `supabase/migrations/005_read.sql`: Thêm read_at, policy update cho người nhận, trigger bảo vệ tin nhắn.
- `supabase/migrations/006_reply_to.sql`: Thêm reply_to và bảo vệ cột này khỏi bị sửa.
- `supabase/migrations/007_stickers.sql`: Thêm is_sticker, bảng stickers và RLS.
- `supabase/migrations/008_chat_settings.sql`: Bảng chat_settings và Realtime ảnh bìa chung.

## Database
- Bảng: `profiles` (id, name, push_subscription), `messages` (id, sender_id, content, created_at, image_path, reply_to, is_sticker, remind_mode, remind_count, next_remind_at, remind_done, read_at), `stickers` (id, owner_id, path, created_at), `chat_settings` (id, cover_path, updated_by, updated_at). Bucket: `chat-images`.
- Migrations: `001_init.sql`, `002_images.sql`, `004_remind.sql`, `005_read.sql`, `006_reply_to.sql`, `007_stickers.sql`, `008_chat_settings.sql`.
- Functions deployed: `notify`, `remind`.

## Đã xong
- Đăng nhập 2 tài khoản, chat realtime và chống trùng tin nhắn.
- Web Push PWA (hỗ trợ iOS Safari PWA).
- Gửi ảnh: nén canvas 1280px JPEG, lưu private bucket, signed URL cache, xem toàn màn hình.
- Cache localStorage 100 tin, đồng bộ nhanh khi mở/focus/click thông báo.
- Nhắc lại tin nhắn (chế độ none/1/2/loop, hiện icon 🔔/🔁, trigger đặt next_remind_at, cron job định kỳ).
- Chế độ nhắc áp dụng cho một tin gửi; sau khi gửi thành công tự về “Không nhắc”, không lưu lựa chọn cũ.
- Khi có tin mới từ cùng người gửi, Edge Function hủy các nhắc còn chờ của tin cũ.
- Chống zoom khi gõ trên iPhone PWA: khóa viewport 1x, font nhập 16px, RAF chỉ cập nhật --vvh/--vvt khi dùng bàn phím iOS, chặn gesture/double-tap.
- "Iu dấu đã xem": cập nhật read_at khi visible, hiện "Iu dấu đã xem lúc HH:mm" / "Đã gửi" ở tin cuối.
- "Iu dấu đang nhập": Realtime broadcast channel typing-room, hiện "💕 [tên] đang nhập...", tự ẩn sau 4s/stop.
- `ensurePush()` tự phục hồi subscription, cập nhật profiles khi mở app/trở lại foreground; nhắc nếu người kia chưa bật thông báo.
- Sửa cập nhật trạng thái nhắc cho service role; 1/2 lần dừng đúng số lượt, liên tục đến khi có trả lời.
- Bàn phím ảo hồng #kb thay bàn phím iOS cho ô chat, có Telex, emoji, xóa giữ lâu, 🌐 chuyển qua lại bàn phím hệ thống; #chat-cover trượt lên parallax khi mở và danh sách tự co/cuộn theo đáy.
- Vuốt phải tin nhắn để trả lời; resolve reply_to thành ID số khi gửi, chặn tin còn tmp-, đồng bộ ID ở DOM/Map/cache và hiện lý do nếu gửi lỗi.
- Sticker PNG nền trong suốt: khay dùng chung, thêm bằng file/dán ảnh, gửi, xóa khỏi khay và hiển thị trong chat.
- Ảnh bìa có màn crop kéo/zoom/xoay trước khi lưu; #chat-cover cố định 100lvh, preview tức thì, đồng bộ realtime; menu/input iOS hoạt động và keyboard cuộn list cuối.
- Tin chữ bay từ ô nhập vào nền; ảnh/sticker giữ hạt bay cũ, gửi optimistic và trạng thái gửi.

## Đang làm / Dở dang
- Bạn làm tay: `npx serve .` thử, tự git push, xóa icon iPhone rồi thêm lại, thử bàn phím trên iPhone thật.

## Lỗi đã biết / Lưu ý
- Kết nối trực tiếp DB bị chặn pass; chạy migration qua Supabase Management Query API.
- Background task trong Edge function bị ngắt khi trả response; đã chuyển sang pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

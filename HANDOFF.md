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
- `index.html`: UI chat, #kb hồng, #app fixed, #list contain, viên thuốc đang nhập, thanh trả lời, nút 😊+, #rxBar + #rxBackdrop, huy hiệu góc dưới phải, bong bóng user-select:none.
- `app.js`: Client logic (initChat, ensurePush, fitViewport, addMsg, reply, sticker, cache, nút 😊+ mở #rxBar (click duy nhất, KHÔNG nhấn giữ), pickReaction, đúp chạm ❤️).
- `sw.js` / `config.js`: Service worker và config public Supabase.
- `supabase/functions/`: notify (push tức thì), remind (cron nhắc chưa rep).
- `supabase/migrations/`: 001_init -> 009_reactions.

## Database
- Bảng: `profiles`, `messages`, `stickers`, `chat_settings`, `reactions` (message_id, user_id, emoji; PK; RLS; Realtime).

## Đã xong
- Chat realtime 2 người, chống trùng tin, Web Push PWA (iOS Safari).
- Gửi ảnh nén canvas 1280px, sticker trong suốt, ảnh bìa crop realtime.
- Cache 100 tin, nhắc tin nhắn none/1/2/loop qua pg_cron + Edge function.
- "Iu dấu đã xem" (read_at) và "Iu dấu đang nhập" (Realtime broadcast).
- Vuốt phải trả lời tin nhắn, resolve reply_to, chống giật layout bàn phím iOS.
- Bảng chức năng ➕ 4 cột, bàn phím iOS mặc định + phím hồng Telex 🌐.
- Thả cảm xúc: nút 😊+ cạnh tin người khác mở #rxBar + #rxBackdrop (chỉ click, KHÔNG nhấn giữ); chạm ngoài đóng; chạm đúp thả ❤️; huy hiệu góc dưới phải bong bóng, optimistic + toast.

## Đang làm / Dở dang
- Bạn làm tay: kiểm tra bằng `npx serve .`, tự git push, xóa icon iPhone rồi thêm lại.

## Lỗi đã biết / Lưu ý
- Chạy migration qua Supabase Management Query API (kết nối trực tiếp DB bị chặn pass).
- Background task trong Edge function bị ngắt khi trả response; dùng pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

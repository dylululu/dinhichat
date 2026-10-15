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
- `index.html`: UI chat, #kb hồng, #app fixed, #list contain, viên thuốc đang nhập, thanh trả lời, nút 🤍/huy hiệu là con bong bóng (right:-6px; bottom:-10px), #rxBar + #rxBackdrop, bong bóng user-select:none.
- `app.js`: Client logic (initChat, ensurePush, fitViewport, addMsg, reply, sticker, cache, nút 🤍 trong bong bóng mở #rxBar (click), huy hiệu chạm mở lại thanh, pickReaction, đúp chạm ❤️, streak header + sheet + rpc get_streak + cache + celebrate).
- `sw.js` / `config.js`: Service worker và config public Supabase.
- `supabase/functions/`: notify (push tức thì), remind (cron nhắc chưa rep).
- `supabase/migrations/`: 001_init -> 010_streak (hàm get_streak security definer).

## Database
- Bảng: `profiles`, `messages`, `stickers`, `chat_settings`, `reactions` (message_id, user_id, emoji; PK; RLS; Realtime). Hàm `get_streak()` → {current, best, today_me, today_other, last_both_date, week[7]} (ngày giờ VN, chuỗi date-row_number).

## Đã xong
- Chat realtime 2 người, chống trùng tin, Web Push PWA (iOS Safari).
- Gửi ảnh nén canvas 1280px, sticker trong suốt, ảnh bìa crop realtime.
- Cache 100 tin, nhắc tin nhắn none/1/2/loop qua pg_cron + Edge function.
- "Iu dấu đã xem" (read_at) và "Iu dấu đang nhập" (Realtime broadcast).
- Vuốt phải trả lời tin nhắn, resolve reply_to, chống giật layout bàn phím iOS.
- Bảng chức năng ➕ 4 cột, bàn phím iOS mặc định + phím hồng Telex 🌐.
- Thả cảm xúc: nút 🤍 22px là con bong bóng tin người kia (right:-6px; bottom:-10px, vùng chạm 40px), có reaction thì ẩn nút hiện huy hiệu cùng chỗ (chạm mở lại thanh); giờ margin-top 12px không bị che; #rxBar + #rxBackdrop (click), chạm đúp ❤️, optimistic + toast.
- Chuỗi giữ lửa: viên thuốc 💗/🤍 N ngày ở header (tim đập lub-dub 1.2s/2s + vòng sáng, chờ có chấm cam, reduced-motion đứng yên); bấm mở sheet (số lớn, kỷ lục, trạng thái hôm nay, 7 chấm tim); rpc get_streak khi mở app/visible/gửi/nhận (debounce 2s) + cache; tăng streak ăn mừng tim bay + toast, mốc 7/30/100/365 riêng.

## Đang làm / Dở dang
- Bạn làm tay: `npx serve .` thử, tự git push, xóa icon iPhone rồi thêm lại.

## Lỗi đã biết / Lưu ý
- Chạy migration qua Supabase Management Query API (kết nối trực tiếp DB bị chặn pass).
- Background task trong Edge function bị ngắt khi trả response; dùng pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

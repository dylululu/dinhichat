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
- `index.html`: UI chat, #kb hồng, #app fixed, #list contain, viên thuốc đang nhập, thanh trả lời, nút 🤍/huy hiệu là con bong bóng (right:-6px; bottom:-10px), #rxBar + #rxBackdrop, bong bóng user-select:none, banner + thiệp + lớp hoa #festive 20/10.
- `app.js`: Client logic (initChat, ensurePush, fitViewport, addMsg, reply, sticker, cache, nút 🤍 trong bong bóng mở #rxBar (click), huy hiệu chạm mở lại thanh, pickReaction, đúp chạm ❤️, streak header + sheet + rpc get_streak + cache + celebrate, tìm kiếm #search-screen + rpc search_messages + nhảy tới tin, 20/10 isEvent2010 + banner + #festive + thiệp).
- `sw.js` / `config.js`: Service worker và config public Supabase.
- `supabase/functions/`: notify (push tức thì), remind (cron nhắc chưa rep).
- `supabase/migrations/`: 001_init -> 012_search (unaccent + pg_trgm, f_unaccent immutable, chỉ mục GIN, rpc search_messages).

## Database
- Bảng: `profiles`, `messages`, `stickers`, `chat_settings`, `reactions` (message_id, user_id, emoji; PK; RLS; Realtime). Hàm `get_streak()` → {current, best, today_me, today_other, last_both_date, week[7]} (ngày giờ VN, chuỗi date-row_number). Hàm `search_messages(q, lim, before)` tìm chuỗi con không dấu/hoa-thường (f_unaccent + đ→d, escape %_), GIN trgm, tối đa 50/lần; tin ảnh/sticker không chữ không vào kết quả.

## Đã xong
- Chat realtime 2 người, chống trùng tin, Web Push PWA (iOS Safari).
- Gửi ảnh nén canvas 1280px, sticker trong suốt, ảnh bìa crop realtime.
- Cache 100 tin, nhắc tin nhắn none/1/2/loop qua pg_cron + Edge function.
- "Iu dấu đã xem" (read_at) và "Iu dấu đang nhập" (Realtime broadcast).
- Vuốt phải trả lời tin nhắn, resolve reply_to, chống giật layout bàn phím iOS.
- Bảng chức năng ➕ 4 cột, bàn phím iOS mặc định + phím hồng Telex 🌐.
- Thả cảm xúc: nút 🤍 22px là con bong bóng tin người kia (right:-6px; bottom:-10px, vùng chạm 40px), có reaction thì ẩn nút hiện huy hiệu cùng chỗ (chạm mở lại thanh); giờ margin-top 12px không bị che; #rxBar + #rxBackdrop (click), chạm đúp ❤️, optimistic + toast.
- Chuỗi giữ lửa: viên thuốc 💗/🤍 N ngày ở header (tim đập lub-dub 1.2s/2s + vòng sáng, chờ có chấm cam, reduced-motion đứng yên); bấm mở sheet (số lớn, kỷ lục, trạng thái hôm nay, 7 chấm tim); rpc get_streak khi mở app/visible/gửi/nhận (debounce 2s) + cache; tăng streak ăn mừng tim bay + toast, mốc 7/30/100/365 riêng.
- Tìm kiếm tin nhắn: nút 🔍 trong panel ➕ mở màn #search-screen (bàn phím iOS, ẩn #kb/panel, đóng trả trạng thái); debounce 300ms, q ≥ 2 ký tự, hủy kết quả cũ bằng requestId; kết quả avatar + tên + giờ + mark vàng (so khớp không dấu bằng textContent); cuộn vô hạn (before, 30/lần); 5 từ khóa gần nhất + xóa lịch sử; tối + 320px OK.
- Đã xong (jump): `jumpToMessage` tra bằng data-id=String(id), thiếu thì tải 30 tin `<=created_at` (desc) + 30 `>` (asc), gộp/sắp xếp, bỏ tin có sẵn; `insertMsgSorted` chèn đúng thứ tự + bù scrollTop; cờ `viewingOldMessages` khi có khoảng hở (chặn cuộn đáy, exitOldView nạp 100 tin khi về đáy); đóng màn tìm kiếm + 2 rAF (timeout 400ms), cuộn tức thì, `jumpLockUntil` 800ms, cuộn lại sau 300ms, nháy `.msg-highlight` 1.5s; lỗi → console.error(id, truy vấn) + toast "Không mở được tin này".
- Đã xong (scroll): gom toàn bộ cuộn đáy về MỘT hàm `scrollToBottom(reason)` — forced chỉ với `mySend`/`jumpDown`/`init`, mọi reason khác (`auto/sync/newMsg/image/keyboard/viewport/resize/input`) chỉ cuộn khi `stickBottom`; cờ `stickBottom` (<80px) CHỈ sự kiện `scroll` của #list cập nhật; không ở đáy → không cuộn + nút nổi "↓ Tin mới (N)" (bấm → jumpDown/reset, tự cuộn về đáy thì tắt); `syncMessages` chỉ addMsg tin thiếu, không đổi scrollTop, hoãn 500ms nếu đang cuộn (touchmove/scroll <300ms); `overflow-anchor:auto`; `maybeLoadOlder` khi scrollTop<200 (chống trùng, insertMsgSorted bù scrollTop); `handleIncomingMessage` một nơi quyết định; jump không bị kéo về đáy.
- 20/10: isEvent2010() giờ VN + ?event=2010 thử (check khi mở app/visible/mỗi 60s); banner marquee dưới header (flex, ẩn ngoài ngày, nút ✕ 44px thu gọn theo phiên); #festive 14 hoa rơi WAAPI transform/opacity + pháo hoa 24 hạt + toast (1 lần/ngày dnc_2010_seen); gửi tin thay tim bằng hoa; tiêu đề 🌸; thiệp bottom sheet + điền sẵn lời chúc; reduced-motion/hidden tắt; tối + safe-area + 320px OK. Banner thêm: shine chéo 3.5s, nền thở 8s, icon nhún + tên phát sáng, 🌹 heartbeat 1.2s + ✨ lấp lánh, tia sáng đáy 5s, 6 hoa bay ngang, vào trượt 350ms + chạm nảy .97; paused khi hidden. Lời chúc cố định cho "Vợ iu" (banner/thiệp/ô nhập), không dùng biệt danh.

## Đang làm / Dở dang
- Bạn làm tay: `npx serve .` thử (lướt đọc tin cũ thấy "↓ Tin mới (N)", ở đáy vẫn tự cuộn, gửi tin luôn xuống; jump tìm tin cũ; ?event=2010), tự git push TRƯỚC ngày 20/10, xóa icon iPhone rồi thêm lại.

## Lỗi đã biết / Lưu ý
- Chạy migration qua Supabase Management Query API (kết nối trực tiếp DB bị chặn pass).
- Background task trong Edge function bị ngắt khi trả response; dùng pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

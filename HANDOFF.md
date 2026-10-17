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
- `index.html`: UI chat, #kb hồng, #app fixed, #list contain, viên thuốc đang nhập, thanh trả lời, nút 🤍/huy hiệu là con bong bóng (right:-6px; bottom:-10px), #rxBar + #rxBackdrop, bong bóng user-select:none, banner + thiệp + lớp hoa #festive 20/10, mục "👤 Hồ sơ" trong panel ➕, màn `#profile-screen` (absolute inset:0, z 700, 2 tab, CSS .pf/.pv-item, tối + 340px).
- `app.js`: Client logic (initChat, ensurePush, fitViewport, addMsg, reply, sticker, cache, nút 🤍 trong bong bóng mở #rxBar (click), huy hiệu chạm mở lại thanh, pickReaction, đúp chạm ❤️, streak header + sheet + rpc get_streak + cache + celebrate, tìm kiếm #search-screen + rpc search_messages + nhảy tới tin, 20/10 isEvent2010 + banner + #festive + thiệp, hồ sơ openProfile/switchProfileTab/saveProfile/uploadAvatar/subscribeProfilesChange).
- `sw.js` / `config.js`: Service worker và config public Supabase.
- `supabase/functions/`: notify (push tức thì), remind (cron nhắc chưa rep).
- `supabase/migrations/`: 001_init -> 012_search (unaccent + pg_trgm, f_unaccent immutable, chỉ mục GIN, rpc search_messages) + 013_push_status (last_push_status/last_push_at) + 014_profile (cột hồ sơ, check độ dài/khoảng, realtime publication).

## Database
- Bảng: `profiles`, `messages`, `stickers`, `chat_settings`, `reactions` (message_id, user_id, emoji; PK; RLS; Realtime). Hàm `get_streak()` → {current, best, today_me, today_other, last_both_date, week[7]} (ngày giờ VN, chuỗi date-row_number). Hàm `search_messages(q, lim, before)` tìm chuỗi con không dấu/hoa-thường (f_unaccent + đ→d, escape %_), GIN trgm, tối đa 50/lần; tin ảnh/sticker không chữ không vào kết quả.
- `profiles` cột hồ sơ (014): nickname, birthday date, height_cm, weight_kg, shoe_size, clothes_size, blood_type, fav_color, fav_food, hobbies, likes, dislikes, allergies, note, avatar_path, profile_updated_at. Check: hobbies/likes/dislikes/allergies/note ≤500; nickname/clothes_size/blood_type/fav_color/fav_food ≤60; height 50–250, weight 20–300, shoe 20–55 (null được). RLS cũ giữ nguyên (đọc tất cả, chỉ sửa của mình), không trigger cột push; profiles đã vào publication supabase_realtime. Biệt danh hiển thị = cột `name`.

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
- Đã xong (scroll): gom toàn bộ cuộn đáy về MỘT hàm `scrollToBottom(reason)` — forced chỉ `mySend`/`jumpDown`/`init`, lý do khác (`auto/sync/newMsg/image/keyboard/viewport/resize/input`) chỉ cuộn khi `stickBottom`; cờ `stickBottom` (<80px) CHỈ sự kiện `scroll` của #list cập nhật; không ở đáy → không cuộn + nút nổi "↓ Tin mới (N)" (bấm → jumpDown, tự về đáy thì tắt); `syncMessages` chỉ addMsg tin thiếu, không đổi scrollTop, hoãn 500ms nếu đang cuộn (<300ms); `overflow-anchor:auto`; `maybeLoadOlder` khi scrollTop<200 (chống trùng, insertMsgSorted bù scrollTop); `handleIncomingMessage` một nơi quyết định; jump không bị kéo về đáy.
- Đã xong (push bền): `notify`/`remind` (đã deploy --no-verify-jwt) — webpush `{urgency:'high', TTL:86400}`, thử lại tối đa 2 lần (cách 2s) với 5xx/429/timeout, chỉ xoá subscription khi 404/410, ghi `profiles.last_push_status` ('ok' hoặc mã lỗi) + `last_push_at` cho người nhận, `console.error` đủ message id + mã (migration 013). Client: `ensurePush()` ghi đè subscription ở mở app/visible/pageshow/mỗi30 phút + `resub` từ sw `pushsubscriptionchange`; `showNotifyButton()` hiện lại 🔔 khi chưa granted hoặc subscribe lỗi; dòng xám dưới ô nhập "Iu dấu chưa nhận được thông báo…" khi peer thiếu sub hoặc `last_push_status !== 'ok'` (loadProfiles/visibility/pageshow/+6s sau khi gửi).
- Đã xong (hồ sơ): màn `#profile-screen` mở từ avatar/tên ở header (của mình), mục "👤 Hồ sơ" trong panel ➕, tên người kia trên tin sticker (tab "Của tôi"/biệt danh người kia, ← + nút Lưu chỉ tab mình); avatar 96px bấm để đổi (dùng lại overlay cắt ảnh, vuông 256×256 JPEG 0.85, upload `avatars/` + `profiles.avatar_path` ngay), ngày sinh "còn N ngày + tuổi" (giờ VN); 5 thẻ 14 ô nhập (font 16px, inputmode decimal, textarea đếm 500 ký tự, lỗi ngay dưới ô, phạm vi số 50–250/20–300/20–55); Lưu chỉ gửi ô đổi (rỗng→null) + toast "Đã lưu hồ sơ 💕" + cập nhật profilesMap/tiêu đề/tên trên tin + cache; nháp tự lưu 500ms, thoát khi bẩn hỏi "Bỏ thay đổi?"; tab người kia chỉ đọc "Chưa cập nhật" + nút Sao chép (size áo, size giày, món yêu thích, dị ứng) → toast; realtime UPDATE profiles (`subscribeProfilesChange`) cập nhật header/tên/hồ sơ đang mở; hồ sơ dùng bàn phím iOS (đóng #kb, trả lại khi đóng), tự cuộn ô focus vào giữa; textContent chống XSS, tối + safe-area + 320px.
- 20/10: isEvent2010() giờ VN + ?event=2010 thử (check khi mở app/visible/mỗi 60s); banner marquee dưới header (flex, ẩn ngoài ngày, nút ✕ 44px thu gọn theo phiên); #festive 14 hoa rơi WAAPI transform/opacity + pháo hoa 24 hạt + toast (1 lần/ngày dnc_2010_seen); gửi tin thay tim bằng hoa; tiêu đề 🌸; thiệp bottom sheet + điền sẵn lời chúc; reduced-motion/hidden tắt; tối + safe-area + 320px OK. Banner thêm: shine chéo 3.5s, nền thở 8s, icon nhún + tên phát sáng, 🌹 heartbeat 1.2s + ✨ lấp lánh, tia sáng đáy 5s, 6 hoa bay ngang, vào trượt 350ms + chạm nảy .97; paused khi hidden. Lời chúc cố định cho "Vợ iu" (banner/thiệp/ô nhập), không dùng biệt danh.

## Đang làm / Dở dang
- Bạn làm tay: tự git push TRƯỚC ngày 20/10; xóa icon iPhone rồi thêm lại; cài đặt thông báo + Tập trung ở cả hai máy; `npx serve .` mở DevTools chế độ điện thoại thử hồ sơ (avatar header → sửa + Lưu, tab người kia chỉ đọc, đổi ảnh avatar, mở app máy kia thấy tên/ảnh đổi ngay), rồi test "↓ Tin mới (N)", jump tin cũ, ?event=2010, dòng xám "chưa nhận được thông báo".

## Lỗi đã biết / Lưu ý
- Chạy migration qua Supabase Management Query API (kết nối trực tiếp DB bị chặn pass).
- Background task trong Edge function bị ngắt khi trả response; dùng pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

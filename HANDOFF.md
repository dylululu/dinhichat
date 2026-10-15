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
- `index.html`: UI chat, #kb bàn phím hồng `height:auto`, phím VI/EN riêng, Telex/emoji và 🌐 chuyển bàn phím iOS; phím vào bằng pointerdown; #chat-cover fixed 100lvh độc lập (--cover-shift chỉ khi pink kb); #app fixed top=--vvt + height=--vvh (không transform), contain layout paint; #list contain layout paint style + overflow-anchor none; dòng "đang nhập" viên thuốc absolute trên form; thanh trả lời absolute; html/body fixed inset 0 nền #fce4ec; thanh nhập chỉ [➕][ô nhập][Gửi], bảng chức năng #attach-menu lưới 4 cột; reaction-bar nổi trong #app, huy hiệu góc dưới phải bong bóng; bong bóng user-select:none/chặn callout.
- `app.js`: Logic client (initChat, ensurePush, openPinkKeyboard, handleKeyboardPointerDown, cacheKeyboardKeyCoordinates, toggleKeyboardLanguage, telex(word,key) `uo`→`ươ` kể cả trước phụ âm cuối, fitViewport RAF + debounce trailing 120ms + __fitStats, resizeMessageInput bằng mirror textarea, addMsg, addOptimisticMessage, reply, crop ảnh bìa, sticker, cache, reactions (pickReaction/subscribeReactions/renderReactionBadges/loadReactionsForMessages, đúp chạm/long-press 400ms, bar nổi #reaction-bar trong #app, huy hiệu ≤2 góc bong bóng, optimistic + rollback toast, cache localStorage, toast khi người kia thả vào tin mình).
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
- Bảng: `profiles` (id, name, push_subscription), `messages` (id, sender_id, content, created_at, image_path, reply_to, is_sticker, remind_mode, remind_count, next_remind_at, remind_done, read_at), `stickers` (id, owner_id, path, created_at), `chat_settings` (id, cover_path, updated_by, updated_at), `reactions` (message_id, user_id, emoji, created_at; PK (message_id,user_id); RLS chỉ thả vào tin người khác; realtime publication + replica identity full). Bucket: `chat-images`.
- Migrations: `001_init.sql`, `002_images.sql`, `004_remind.sql`, `005_read.sql`, `006_reply_to.sql`, `007_stickers.sql`, `008_chat_settings.sql`, `009_reactions.sql`.
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
- "Iu dấu đang nhập": Realtime broadcast channel typing-room; dòng viên thuốc absolute ngay trên thanh nhập (bottom:100% của form, z-8, không đổi layout), nội dung "💕 [tên] đang nhập" bằng textContent + 3 chấm nhảy transform/opacity 150ms lệch pha, ẩn khi stop/4s; panel ➕/sticker mở thì ẩn tạm (opacity), prefers-reduced-motion chỉ nhấp nháy.
- `ensurePush()` tự phục hồi subscription, cập nhật profiles khi mở app/trở lại foreground; nhắc nếu người kia chưa bật thông báo.
- Sửa cập nhật trạng thái nhắc cho service role; 1/2 lần dừng đúng số lượt, liên tục đến khi có trả lời.
- Bàn phím iPhone hệ thống mặc định, resetToNativeKeyboard() tự bật lại khi mở app/trở lại foreground (initChat/pageshow/visibilitychange); 🌐 chuyển sang #kb hồng; Telex w đổi `uo`→`ươ`, dấu thanh trên ơ, phím a/e/o/d chỉ hoàn tác đúng phím lặp; chèn pointerdown, việc phụ qua RAF.
- Vuốt phải tin nhắn để trả lời; resolve reply_to thành ID số khi gửi, chặn tin còn tmp-, đồng bộ ID ở DOM/Map/cache và hiện lý do nếu gửi lỗi.
- Sticker PNG nền trong suốt: khay dùng chung, thêm bằng file/dán ảnh, gửi, xóa khỏi khay và hiển thị trong chat.
- Ảnh bìa có màn crop kéo/zoom/xoay trước khi lưu; #chat-cover cố định 100lvh, preview tức thì, đồng bộ realtime; menu/input iOS hoạt động và keyboard cuộn list cuối.
- Chống giật khung tin nhắn khi gõ #kb: ô nhập giãn bằng mirror textarea (chỉ ghi height khi số dòng đổi, gom RAF, không 'auto'), #list chỉ cuộn khi height thật sự đổi/nearBottom, ResizeObserver so lastH, typing indicator + thanh trả lời absolute, #kb/#list contain layout, overflow-anchor none.
- Chống giật khung hình khi bàn phím iOS trượt: fitViewport gom 1 RAF + debounce trailing 120ms (chỉ đổi --vvh lúc bắt đầu và lúc ổn định, bỏ qua <2px); #app contain layout paint + transition none, #list contain layout paint style, header/thanh nhập contain layout; cuộn #list 1 lần sau khi ổn định; bàn phím iOS: #kb display:none; không autofocus.
- Sửa lệch kép khi bàn phím iOS mở: #app không transform, chỉ top=offsetTop + height=vv.height; #cover fixed 100lvh độc lập phía sau; html/body fixed inset 0 nền #fce4ec; chặn iOS cuộn trang (scrollTo trong rAF khi pageYOffset/scrollTop lệch), lắng nghe cả visualViewport scroll+resize.
- Gom nút chức năng vào bảng lưới 4 cột mở từ nút ➕ (camera/thư viện/sticker/nhắc/bàn phím); thanh nhập chỉ [➕][ô nhập][Gửi]; ➕ xoay 45°, chấm hồng khi nhắc bật, panel absolute không đổi layout #list, chọn mục tự đóng (trừ nhắc), đóng khi chạm ra ngoài/mở sticker; Gửi ẩn/hiện scale+opacity.
- Thả cảm xúc: đúp chạm hoặc long-press 350ms vào tin người khác (hủy >10px, không đụng vuốt trả lời) → thanh 6 emoji + nút 📋 sao chép nội dung nổi trong #app (tự trên/dưới tùy chỗ trống, không đẩy layout); trùng = bỏ, optimistic + rollback toast; realtime reactions cập nhật huy hiệu; cache localStorage; ❤️ tim bay, reduced-motion tắt. Huy hiệu viên 20px emoji 12px gắn góc dưới phải bong bóng (right:6px bottom:-10px, ≤2 emoji/viên), time cách 14px không chồng; bong bóng user-select:none + chặn contextmenu/selectstart, long-press removeAllRanges + chặn click sinh ra.

## Đang làm / Dở dang
- Bạn làm tay: `npx supabase db push` (chạy migration 009), `npx serve .` thử bằng 2 cửa sổ, tự git push, xóa icon iPhone rồi thêm lại.

## Lỗi đã biết / Lưu ý
- Kết nối trực tiếp DB bị chặn pass; chạy migration qua Supabase Management Query API.
- Background task trong Edge function bị ngắt khi trả response; đã chuyển sang pg_cron gọi function remind.
- iOS chỉ nhận web push khi app được cài ra màn hình chính (Standalone PWA).

## Cách cập nhật
Cuối mỗi phiên: sửa HANDOFF.md tại chỗ (không thêm nhật ký). Chuyển mục xong sang 'Đã xong' (1 dòng/tính năng), xóa mục cũ không còn đúng, cập nhật 'Đang làm'. Giữ file ≤ 60 dòng.

// app.js - DiNhiChat client logic v3 (low-latency sync)

(function () {
  'use strict';

  const supabase = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY
  );

  // DOM
  const authScreen = document.getElementById('auth-screen');
  const chatScreen = document.getElementById('chat-screen');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const btnLogin = document.getElementById('btn-login');
  const loginError = document.getElementById('login-error');

  const chatTitle = document.getElementById('chat-title');
  const userAvatar = document.getElementById('current-user-avatar');
  const btnNotify = document.getElementById('btn-enable-notify');
  const btnLogout = document.getElementById('btn-logout');
  const pwaInstallBanner = document.getElementById('pwa-install-banner');
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send');

  const btnAttach = document.getElementById('btn-attach');
  const attachMenu = document.getElementById('attach-menu');
  const btnCamera = document.getElementById('btn-camera');
  const btnGallery = document.getElementById('btn-gallery');
  const fileCamera = document.getElementById('file-camera');
  const fileGallery = document.getElementById('file-gallery');

  const imgOverlay = document.getElementById('img-overlay');
  const imgOverlayImg = document.getElementById('img-overlay-img');

  let currentUser = null;
  let currentProfile = null;
  let realtimeChannel = null;
  const messageIds = new Set();
  const signedUrlCache = new Map();

  // Cache keys
  const CACHE_MSGS_KEY = 'dinhichat_msgs_cache';
  const CACHE_PROFILES_KEY = 'dinhichat_profiles_cache';

  // ─── LocalStorage helpers ────────────────────────────────────────────────────
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  const remindSelect = document.getElementById('remind-select');
  if (remindSelect) {
    const savedRemind = lsGet('dinhichat_remind_mode');
    if (savedRemind) remindSelect.value = savedRemind;
    remindSelect.addEventListener('change', () => {
      lsSet('dinhichat_remind_mode', remindSelect.value);
    });
  }

  // ─── Service Worker ──────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.error('SW registration failed:', err);
    });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'sync') syncMessages();
    });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────
  function isStandaloneMode() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  // ─── Push subscription ───────────────────────────────────────────────────────
  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Trình duyệt không hỗ trợ Web Push.'); return false;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(window.CONFIG.VAPID_PUBLIC_KEY)
        });
      }
      if (currentUser && sub) {
        const { error } = await supabase.from('profiles')
          .update({ push_subscription: sub.toJSON() }).eq('id', currentUser.id);
        if (error) { console.error('Lỗi lưu subscription:', error); return false; }
      }
      return true;
    } catch (err) { console.error('Lỗi đăng ký push:', err); return false; }
  }

  async function checkNotificationStatus() {
    if (!('Notification' in window)) { btnNotify.style.display = 'none'; return; }
    if (!isStandaloneMode()) {
      btnNotify.style.display = 'inline-flex';
      btnNotify.onclick = () => {
        pwaInstallBanner.style.display = 'block';
        alert('Để nhận thông báo trên iPhone, hãy bấm nút Chia sẻ rồi chọn "Thêm vào Màn hình chính".');
      };
      return;
    }
    pwaInstallBanner.style.display = 'none';
    if (Notification.permission === 'granted') {
      btnNotify.style.display = 'none'; subscribePush();
    } else {
      btnNotify.style.display = 'inline-flex';
      btnNotify.onclick = async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          if (await subscribePush()) btnNotify.style.display = 'none';
        } else {
          alert('Bạn đã từ chối quyền thông báo. Hãy kiểm tra Cài đặt của iPhone.');
        }
      };
    }
  }

  // ─── Signed URL cache ────────────────────────────────────────────────────────
  async function getSignedUrl(imagePath) {
    if (signedUrlCache.has(imagePath)) return signedUrlCache.get(imagePath);
    const { data, error } = await supabase.storage.from('chat-images').createSignedUrl(imagePath, 3600);
    if (error || !data) { console.error('Lỗi signed url:', error); return null; }
    signedUrlCache.set(imagePath, data.signedUrl);
    setTimeout(() => signedUrlCache.delete(imagePath), 55 * 60 * 1000);
    return data.signedUrl;
  }

  // ─── Save messages to cache ──────────────────────────────────────────────────
  function saveMsgsToCache() {
    // Collect up to 100 rendered message IDs (in order)
    try {
      const rows = messagesContainer.querySelectorAll('.message-row[data-msg]');
      const arr = [];
      rows.forEach((r) => {
        try { arr.push(JSON.parse(r.dataset.msg)); } catch {}
      });
      const last100 = arr.slice(-100);
      lsSet(CACHE_MSGS_KEY, last100);
    } catch {}
  }

  // ─── Render one message (addMsg) ─────────────────────────────────────────────
  async function addMsg(message, scroll = true) {
    if (!message || !message.id) return;
    if (messageIds.has(message.id)) return;
    messageIds.add(message.id);

    const isSelf = currentUser && message.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = 'message-row ' + (isSelf ? 'self' : 'other');
    row.id = 'msg-' + message.id;
    // Store raw msg JSON on element for cache
    try { row.dataset.msg = JSON.stringify(message); } catch {}

    if (message.image_path) {
      const wrap = document.createElement('div');
      wrap.className = 'msg-image-wrap';
      const img = document.createElement('img');
      img.className = 'msg-image';
      img.loading = 'lazy';
      img.alt = 'ảnh';
      getSignedUrl(message.image_path).then((url) => {
        if (url) {
          img.src = url;
          img.onload = () => {
            img.style.minHeight = '';
            if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
          };
        }
      });
      img.addEventListener('click', () => {
        imgOverlayImg.src = img.src;
        imgOverlay.classList.add('open');
      });
      wrap.appendChild(img);
      row.appendChild(wrap);
      if (message.content) {
        const caption = document.createElement('div');
        caption.className = 'message-bubble';
        caption.style.marginTop = '4px';
        caption.textContent = message.content;
        row.appendChild(caption);
      }
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = message.content || '';
      row.appendChild(bubble);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    let remindIcon = '';
    if (isSelf && message.remind_mode && message.remind_mode !== 'none') {
      remindIcon = message.remind_mode === 'loop' ? ' 🔁' : ' 🔔';
    }
    time.textContent = formatTime(message.created_at) + remindIcon;
    row.appendChild(time);

    messagesContainer.appendChild(row);
    if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ─── Sync 50 latest messages ─────────────────────────────────────────────────
  async function syncMessages() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { console.error('syncMessages error:', error); return; }
    if (data && data.length > 0) {
      const sorted = data.reverse();
      for (const msg of sorted) await addMsg(msg, false);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      saveMsgsToCache();
    }
  }

  // ─── Subscribe realtime ──────────────────────────────────────────────────────
  function subscribeRoom() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          if (payload.new) {
            await addMsg(payload.new, true);
            saveMsgsToCache();
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          syncMessages();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeRoom, 1500);
        }
      });
  }

  // ─── Load from cache then sync ───────────────────────────────────────────────
  async function loadFromCacheThenSync() {
    // Draw from cache immediately
    const cached = lsGet(CACHE_MSGS_KEY);
    if (cached && cached.length > 0) {
      for (const msg of cached) await addMsg(msg, false);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    // Then fetch from server
    await syncMessages();
  }

  // ─── Temp bubble helpers ─────────────────────────────────────────────────────
  function removeTempBubble(tempId) {
    const el = document.getElementById(tempId);
    if (el) el.remove();
  }

  // ─── Image resize ─────────────────────────────────────────────────────────────
  async function resizeImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const maxSide = 1280;
    let w = bitmap.width, h = bitmap.height;
    if (w > maxSide || h > maxSide) {
      if (w >= h) { h = Math.round(h * maxSide / w); w = maxSide; }
      else { w = Math.round(w * maxSide / h); h = maxSide; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  }

  // ─── Upload image ─────────────────────────────────────────────────────────────
  async function uploadAndSendImage(file, captionText) {
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const tempRow = document.createElement('div');
    tempRow.id = tempId;
    tempRow.className = 'message-row self';
    const tempBubble = document.createElement('div');
    tempBubble.className = 'message-bubble';
    tempBubble.style.fontStyle = 'italic';
    tempBubble.style.opacity = '0.7';
    tempBubble.textContent = 'Đang gửi ảnh...';
    tempRow.appendChild(tempBubble);
    messagesContainer.appendChild(tempRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const blob = await resizeImage(file);
      const rand = Math.random().toString(36).slice(2, 6);
      const path = `chat-images/${currentUser.id}/${Date.now()}-${rand}.jpg`;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const insertData = { image_path: path, sender_id: currentUser.id };
      if (captionText) insertData.content = captionText;
      const remindSelect = document.getElementById('remind-select');
      insertData.remind_mode = remindSelect ? remindSelect.value : 'none';
      const { error: insErr } = await supabase.from('messages').insert(insertData);
      if (insErr) throw insErr;
      removeTempBubble(tempId);
    } catch (err) {
      console.error('Lỗi gửi ảnh:', err);
      const errRow = document.getElementById(tempId);
      if (errRow) {
        errRow.innerHTML = '';
        const errBubble = document.createElement('div');
        errBubble.className = 'message-bubble';
        errBubble.style.background = '#ffebee';
        errBubble.style.color = '#c62828';
        const errText = document.createElement('span');
        errText.textContent = 'Gửi ảnh thất bại';
        errBubble.appendChild(errText);
        const retryBtn = document.createElement('button');
        retryBtn.textContent = ' Thử lại';
        retryBtn.style.cssText = 'margin-left:8px;background:transparent;border:none;color:#e91e63;font-weight:bold;cursor:pointer;font-size:13px;';
        retryBtn.addEventListener('click', () => { removeTempBubble(tempId); uploadAndSendImage(file, captionText); });
        errBubble.appendChild(retryBtn);
        errRow.appendChild(errBubble);
      }
    }
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    const caption = messageInput.value.trim();
    if (caption) messageInput.value = '';
    for (let i = 0; i < files.length; i++) {
      await uploadAndSendImage(files[i], i === 0 ? caption : '');
    }
  }

  // ─── Attach menu ─────────────────────────────────────────────────────────────
  if (btnAttach && attachMenu) {
    btnAttach.addEventListener('click', (e) => { e.stopPropagation(); attachMenu.classList.toggle('open'); });
    document.addEventListener('click', () => attachMenu.classList.remove('open'));
    attachMenu.addEventListener('click', (e) => e.stopPropagation());
  }
  if (btnCamera && fileCamera) {
    btnCamera.addEventListener('click', () => { if (attachMenu) attachMenu.classList.remove('open'); fileCamera.value = ''; fileCamera.click(); });
    fileCamera.addEventListener('change', () => handleFiles(fileCamera.files));
  }
  if (btnGallery && fileGallery) {
    btnGallery.addEventListener('click', () => { if (attachMenu) attachMenu.classList.remove('open'); fileGallery.value = ''; fileGallery.click(); });
    fileGallery.addEventListener('change', () => handleFiles(fileGallery.files));
  }

  // ─── Image overlay ────────────────────────────────────────────────────────────
  if (imgOverlay && imgOverlayImg) {
    imgOverlay.addEventListener('click', () => { imgOverlay.classList.remove('open'); imgOverlayImg.src = ''; });
  }

  // ─── Send text message ────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;
    messageInput.value = '';
    btnSend.disabled = true;
    
    const remindSelect = document.getElementById('remind-select');
    const remindMode = remindSelect ? remindSelect.value : 'none';
    
    const { error } = await supabase.from('messages').insert({ 
      content: text, 
      sender_id: currentUser.id,
      remind_mode: remindMode
    });
    
    btnSend.disabled = false;
    messageInput.focus();
    if (error) { console.error('Lỗi gửi:', error); alert('Không gửi được tin nhắn: ' + error.message); }
  }

  // ─── Visibility / focus sync ──────────────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) syncMessages();
  });
  window.addEventListener('pageshow', () => { if (currentUser) syncMessages(); });
  window.addEventListener('focus', () => { if (currentUser) syncMessages(); });

  // ─── initChat ────────────────────────────────────────────────────────────────
  async function initChat(user) {
    try {
      currentUser = user;
      authScreen.classList.remove('active');
      chatScreen.classList.add('active');

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentProfile = profile;
        userAvatar.textContent = (profile.name || 'DN').substring(0, 2).toUpperCase();
        chatTitle.textContent = profile.name || 'DiNhiChat';
      }

      await loadFromCacheThenSync();
      subscribeRoom();
      checkNotificationStatus();
    } catch (err) {
      console.error('initChat error:', err);
    }
  }

  function showAuth() {
    currentUser = null; currentProfile = null;
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    chatScreen.classList.remove('active');
    authScreen.classList.add('active');
  }

  // ─── Login form ───────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    btnLogin.disabled = true;
    btnLogin.textContent = 'Đang đăng nhập...';
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      });
      btnLogin.disabled = false;
      btnLogin.textContent = 'Đăng nhập';
      if (error) {
        loginError.textContent = error.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu.' : error.message;
        return;
      }
      if (data.user) await initChat(data.user);
    } catch (err) {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Đăng nhập';
      loginError.textContent = 'Lỗi kết nối: ' + (err.message || String(err));
    }
  });

  btnLogout.addEventListener('click', async () => { await supabase.auth.signOut(); showAuth(); });
  btnSend.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

  supabase.auth.getSession().then(({ data }) => {
    if (data?.session?.user) initChat(data.session.user);
    else showAuth();
  }).catch((err) => {
    console.error('getSession error:', err);
    showAuth();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') showAuth();
    else if (event === 'SIGNED_IN' && session?.user) {
      if (!currentUser || currentUser.id !== session.user.id) initChat(session.user);
    }
  });
})();

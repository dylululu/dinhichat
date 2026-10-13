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
  const btnCover = document.getElementById('btn-cover');
  const coverMenu = document.getElementById('cover-menu');
  const coverChange = document.getElementById('cover-change');
  const coverRemove = document.getElementById('cover-remove');
  const coverFile = document.getElementById('cover-file');
  const pwaInstallBanner = document.getElementById('pwa-install-banner');
  const messagesContainer = document.getElementById('messages-container');
  const sendGatherOverlay = document.getElementById('send-gather-overlay');
  const newMessagesButton = document.getElementById('new-messages-button');
  const messageInput = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send');
  const replyBar = document.getElementById('reply-bar');
  const replyBarText = document.getElementById('reply-bar-text');
  const replyCancel = document.getElementById('reply-cancel');

  const btnAttach = document.getElementById('btn-attach');
  const attachMenu = document.getElementById('attach-menu');
  const btnSticker = document.getElementById('btn-sticker');
  const stickerPanel = document.getElementById('sticker-panel');
  const stickerGrid = document.getElementById('sticker-grid');
  const fileSticker = document.getElementById('file-sticker');
  const btnCamera = document.getElementById('btn-camera');
  const btnGallery = document.getElementById('btn-gallery');
  const fileCamera = document.getElementById('file-camera');
  const fileGallery = document.getElementById('file-gallery');

  const imgOverlay = document.getElementById('img-overlay');
  const imgOverlayImg = document.getElementById('img-overlay-img');
  const typingIndicator = document.getElementById('typing-indicator');
  const peerPushNotice = document.getElementById('peer-push-notice');
  const notificationHelp = document.getElementById('notification-help');
  let viewportKeyboardOpen = false;

  function syncVisualViewport() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const focused = document.activeElement;
    const editing = focused && (focused.matches('input, textarea, select') || focused.isContentEditable);
    const keyboardOpen = editing && viewport.height < window.innerHeight - 120;
    const top = keyboardOpen ? viewport.offsetTop : 0;
    const left = keyboardOpen ? viewport.offsetLeft : 0;
    const width = keyboardOpen ? viewport.width : window.innerWidth;
    const height = keyboardOpen ? viewport.height : null;
    [authScreen, chatScreen].forEach((screen) => {
      screen.style.top = `${top}px`;
      screen.style.left = `${left}px`;
      screen.style.width = `${width}px`;
      screen.style.height = height ? `${height}px` : '100dvh';
      screen.style.right = 'auto';
      screen.style.bottom = 'auto';
    });
    if (sendGatherOverlay) {
      sendGatherOverlay.style.top = `${top}px`;
      sendGatherOverlay.style.left = `${left}px`;
      sendGatherOverlay.style.width = `${width}px`;
      sendGatherOverlay.style.height = height ? `${height}px` : '100dvh';
    }
    if (keyboardOpen && !viewportKeyboardOpen) {
      requestAnimationFrame(() => messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' }));
    }
    viewportKeyboardOpen = keyboardOpen;
    try { window.scrollTo(0, 0); } catch {}
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncVisualViewport);
    window.visualViewport.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', syncVisualViewport);
    syncVisualViewport();
  }

  let currentUser = null;
  let currentProfile = null;
  let realtimeChannel = null;
  let typingChannel = null;
  let coverChannel = null;
  let typingTimer = null;
  let lastTypingSent = 0;
  const messageIds = new Set();
  const signedUrlCache = new Map();
  const coverUrlCache = new Map();
  const profilesMap = new Map();
  const messageCache = new Map();
  let stickerItems = [];
  let ensurePushPromise = null;
  let activeReply = null;
  let tempMessageSequence = 0;
  let activeHeartCount = 0;
  let sendGatherRunning = false;
  let sendGatherAnimations = [];

  try { navigator.storage?.persist().catch(() => {}); } catch {}

  // Cache keys
  const CACHE_MSGS_KEY = 'dinhichat_msgs_cache';
  const CACHE_PROFILES_KEY = 'dinhichat_profiles_cache';
  const COVER_PATH_KEY = 'dinhichat_cover_path';
  const COVER_URL_KEY = 'dinhichat_cover_url';

  // ─── LocalStorage helpers ────────────────────────────────────────────────────
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function applyCoverUrl(url) {
    messagesContainer.style.setProperty('--chat-cover-image', `url("${url}")`);
    messagesContainer.classList.add('has-cover');
  }

  async function applyCoverPath(path, forceRefresh = false) {
    if (!path) {
      messagesContainer.classList.remove('has-cover');
      messagesContainer.style.removeProperty('--chat-cover-image');
      try {
        localStorage.removeItem(COVER_PATH_KEY);
        localStorage.removeItem(COVER_URL_KEY);
      } catch {}
      coverUrlCache.clear();
      return;
    }

    lsSet(COVER_PATH_KEY, path);
    messagesContainer.classList.add('has-cover');
    const now = Date.now();
    let cached = coverUrlCache.get(path);
    const saved = lsGet(COVER_URL_KEY);
    if (!cached && saved?.path === path && saved.expiresAt > now) {
      cached = saved;
      coverUrlCache.set(path, saved);
    }
    if (cached?.url && cached.expiresAt > now) applyCoverUrl(cached.url);
    if (!forceRefresh && cached?.expiresAt - now > 5 * 60 * 1000) return;

    const { data, error } = await supabase.storage.from('chat-images').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      console.error('Không tải được ảnh bìa:', error);
      return;
    }
    const fresh = { path, url: data.signedUrl, expiresAt: now + 3600 * 1000 };
    coverUrlCache.set(path, fresh);
    lsSet(COVER_URL_KEY, fresh);
    applyCoverUrl(fresh.url);
  }

  async function refreshCoverFromServer() {
    const { data, error } = await supabase.from('chat_settings').select('cover_path').eq('id', 1).maybeSingle();
    if (error) {
      console.error('Không đồng bộ được ảnh bìa:', error);
      return;
    }
    const path = data?.cover_path || null;
    const cachedPath = lsGet(COVER_PATH_KEY);
    if (path !== cachedPath) await applyCoverPath(path, true);
    else if (path) await applyCoverPath(path);
    else await applyCoverPath(null);
  }

  async function loadCover() {
    const path = lsGet(COVER_PATH_KEY);
    const saved = lsGet(COVER_URL_KEY);
    if (path) {
      if (saved?.path === path && saved.expiresAt > Date.now()) {
        coverUrlCache.set(path, saved);
        applyCoverUrl(saved.url);
      } else {
        messagesContainer.classList.add('has-cover');
      }
    }
    await refreshCoverFromServer();
  }

  function subscribeCoverSettings() {
    if (coverChannel) supabase.removeChannel(coverChannel);
    coverChannel = supabase.channel('chat-settings-cover')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_settings', filter: 'id=eq.1'
      }, (payload) => {
        applyCoverPath(payload.new?.cover_path || null, true);
      })
      .subscribe();
  }

  async function resizeCoverImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas không tạo được ảnh.'));
    }, 'image/jpeg', 0.8));
  }

  async function uploadCover(file) {
    try {
      const blob = await resizeCoverImage(file);
      const path = `${currentUser.id}/covers/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, blob, {
        contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('chat_settings').update({
        cover_path: path,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString()
      }).eq('id', 1);
      if (updateError) throw updateError;
      await applyCoverPath(path, true);
      coverMenu.classList.remove('open');
    } catch (error) {
      console.error('Đổi ảnh bìa thất bại:', error);
      alert('Đổi ảnh bìa thất bại');
    }
  }

  async function removeCover() {
    try {
      const { error } = await supabase.from('chat_settings').update({
        cover_path: null,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString()
      }).eq('id', 1);
      if (error) throw error;
      await applyCoverPath(null);
      coverMenu.classList.remove('open');
    } catch (error) {
      console.error('Xóa ảnh bìa thất bại:', error);
      alert('Đổi ảnh bìa thất bại');
    }
  }

  // ─── Profiles ────────────────────────────────────────────────────────────────
  async function loadProfiles() {
    const cached = lsGet(CACHE_PROFILES_KEY);
    if (cached && Array.isArray(cached)) {
      cached.forEach((p) => profilesMap.set(p.id, p));
    }
    const { data, error } = await supabase.from('profiles').select('id, name, push_subscription');
    if (!error && data) {
      data.forEach((p) => profilesMap.set(p.id, p));
      lsSet(CACHE_PROFILES_KEY, data);
      updatePeerPushNotice(data);
    }
  }

  function updatePeerPushNotice(profiles) {
    if (!peerPushNotice || !currentUser) return;
    const peer = profiles.find((profile) => profile.id !== currentUser.id);
    peerPushNotice.style.display = peer && peer.push_subscription === null ? 'block' : 'none';
  }

  const remindSelect = document.getElementById('remind-select');
  if (remindSelect) remindSelect.value = 'none';

  function resizeMessageInput() {
    if (messageInput.tagName !== 'TEXTAREA') return;
    messageInput.style.height = '40px';
    const height = Math.min(messageInput.scrollHeight, 120);
    messageInput.style.height = height + 'px';
    messageInput.style.overflowY = messageInput.scrollHeight > 120 ? 'auto' : 'hidden';
  }

  function replySnippet(message, maxLength = 20) {
    if (!message) return 'Tin nhắn không còn';
    if (message.is_sticker) return '🎟️ Sticker';
    if (message.image_path && !message.content) return '📷 Ảnh';
    const text = (message.content || (message.image_path ? '📷 Ảnh' : '')).trim();
    return text.length > maxLength ? text.slice(0, maxLength) + '…' : (text || 'Tin nhắn không còn');
  }

  function senderName(message) {
    return profilesMap.get(message.sender_id)?.name || 'Iu dấu';
  }

  function clearReply() {
    activeReply = null;
    replyBar.style.display = 'none';
    replyBarText.textContent = '';
  }

  function startReply(message) {
    if (!message || !message.id) return;
    activeReply = message;
    replyBarText.textContent = '↩ ' + senderName(message) + ': ' + replySnippet(message);
    replyBar.style.display = 'flex';
    messageInput.focus();
  }

  async function getMessageById(id) {
    if (!id) return null;
    if (messageCache.has(id)) return messageCache.get(id);
    const row = document.getElementById('msg-' + id);
    if (row?.dataset.msg) {
      try {
        const message = JSON.parse(row.dataset.msg);
        messageCache.set(message.id, message);
        return message;
      } catch {}
    }
    const cached = lsGet(CACHE_MSGS_KEY);
    const message = Array.isArray(cached) ? cached.find((item) => item.id === id) : null;
    if (message) {
      messageCache.set(message.id, message);
      return message;
    }
    const { data, error } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('Không tải được tin trả lời:', error); return null; }
    if (data) messageCache.set(data.id, data);
    return data || null;
  }

  function scrollToOriginalMessage(id) {
    const row = document.getElementById('msg-' + id);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('reply-flash');
    setTimeout(() => row.classList.remove('reply-flash'), 1000);
  }

  function createReplyQuote(replyTo) {
    const quote = document.createElement('div');
    quote.className = 'reply-quote';
    const name = document.createElement('div');
    name.className = 'reply-quote-name';
    const text = document.createElement('div');
    text.className = 'reply-quote-text';
    quote.append(name, text);
    quote.addEventListener('click', () => scrollToOriginalMessage(replyTo));
    getMessageById(replyTo).then((original) => {
      if (original) {
        name.textContent = senderName(original);
        text.textContent = replySnippet(original, 120);
      } else {
        name.textContent = '';
        text.textContent = 'Tin nhắn không còn';
      }
    });
    return quote;
  }

  function enableSwipeReply(row, message) {
    const icon = document.createElement('div');
    icon.className = 'reply-swipe-icon';
    icon.textContent = '↩';
    row.appendChild(icon);
    let startX = 0;
    let startY = 0;
    let distance = 0;
    let horizontal = false;

    row.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      distance = 0;
      horizontal = false;
      row.style.transition = '';
    }, { passive: true });

    row.addEventListener('touchmove', (event) => {
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!horizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) horizontal = true;
      if (!horizontal || dx <= 0) return;
      event.preventDefault();
      distance = Math.min(dx, 84);
      row.classList.add('swiping');
      row.style.transform = 'translateX(' + distance + 'px)';
    }, { passive: false });

    row.addEventListener('touchend', () => {
      const activate = horizontal && distance > 60;
      row.classList.remove('swiping');
      row.style.transition = 'transform 180ms ease-out';
      row.style.transform = '';
      if (activate) {
        try { navigator.vibrate?.(15); } catch {}
        startReply(message);
      }
      setTimeout(() => { row.style.transition = ''; }, 200);
    }, { passive: true });
  }

  // ─── Service Worker ──────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.error('SW registration failed:', err);
    });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'sync') syncMessages();
      if (e.data && e.data.type === 'resub') ensurePush();
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
  async function ensurePush() {
    if (navigator.standalone !== true || Notification.permission !== 'granted' || !currentUser) return false;
    if (ensurePushPromise) return ensurePushPromise;
    ensurePushPromise = (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(window.CONFIG.VAPID_PUBLIC_KEY)
        });
        if (!sub) {
          btnNotify.style.display = 'inline-flex';
          btnNotify.onclick = () => checkNotificationStatus();
          return false;
        }
        const { error } = await supabase.from('profiles')
          .update({ push_subscription: sub.toJSON() }).eq('id', currentUser.id);
        if (error) {
          console.error('Lỗi lưu subscription:', error);
          btnNotify.style.display = 'inline-flex';
          btnNotify.onclick = () => checkNotificationStatus();
          return false;
        }
        btnNotify.style.display = 'none';
        return true;
      } catch (err) {
        console.error('Lỗi đăng ký push:', err);
        btnNotify.style.display = 'inline-flex';
        btnNotify.onclick = () => checkNotificationStatus();
        return false;
      } finally {
        ensurePushPromise = null;
      }
    })();
    return ensurePushPromise;
  }

  async function checkNotificationStatus() {
    if (!('Notification' in window)) { btnNotify.style.display = 'none'; return; }
    notificationHelp.style.display = Notification.permission === 'denied' ? 'block' : 'none';
    notificationHelp.textContent = Notification.permission === 'denied'
      ? 'Hãy bật thông báo trong Cài đặt → Thông báo → DiNhiChat' : '';
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
      const subscribed = await ensurePush();
      btnNotify.style.display = subscribed ? 'none' : 'inline-flex';
      btnNotify.onclick = async () => {
        const restored = await ensurePush();
        btnNotify.style.display = restored ? 'none' : 'inline-flex';
      };
    } else if (Notification.permission === 'denied') {
      btnNotify.style.display = 'none';
    } else {
      btnNotify.style.display = 'inline-flex';
      btnNotify.onclick = async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          if (await ensurePush()) btnNotify.style.display = 'none';
          await checkNotificationStatus();
        } else if (perm === 'denied') {
          await checkNotificationStatus();
        } else {
          btnNotify.style.display = 'inline-flex';
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

  function closeStickerPanel() {
    stickerPanel.classList.remove('open');
    stickerPanel.setAttribute('aria-hidden', 'true');
  }

  function nearMessagesBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
  }

  function scrollMessagesToBottom() {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    if (newMessagesButton) newMessagesButton.classList.remove('visible');
  }

  function animateMessage(row, isSelf) {
    if (!row || document.hidden) return;
    row.classList.add(isSelf ? 'animate-outgoing' : 'animate-incoming');
    row.addEventListener('animationend', () => {
      row.classList.remove('animate-outgoing', 'animate-incoming');
    }, { once: true });
  }

  function updateSendButtonVisibility() {
    if (btnSend) btnSend.classList.toggle('is-empty', !messageInput.value.trim());
  }

  function animateSendButton() {
    if (!btnSend || document.hidden) return;
    btnSend.classList.remove('is-pressed');
    void btnSend.offsetWidth;
    btnSend.classList.add('is-pressed');
    setTimeout(() => btnSend.classList.remove('is-pressed'), 170);
    try { navigator.vibrate?.(10); } catch {}
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rect = btnSend.getBoundingClientRect();
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count && activeHeartCount < 8; i++) {
      const heart = document.createElement('span');
      heart.className = 'send-heart';
      heart.textContent = Math.random() < .5 ? '💗' : '💕';
      heart.style.setProperty('--heart-x', `${rect.left + rect.width / 2 - 9}px`);
      heart.style.setProperty('--heart-y', `${rect.top + 2}px`);
      heart.style.setProperty('--heart-size', `${12 + Math.floor(Math.random() * 7)}px`);
      heart.style.setProperty('--heart-dx', `${Math.round(Math.random() * 72 - 36)}px`);
      document.body.appendChild(heart);
      activeHeartCount++;
      setTimeout(() => { heart.remove(); activeHeartCount = Math.max(0, activeHeartCount - 1); }, 720);
    }
  }

  async function animateSendGatherEffect(messageRow) {
    let particles = [];
    let ripple = null;
    let ownsEffect = false;
    const cancelOnHide = () => {
      if (document.hidden) sendGatherAnimations.forEach((animation) => animation.cancel());
    };
    try {
      if (sendGatherRunning || document.hidden || !sendGatherOverlay ||
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      sendGatherRunning = true;
      ownsEffect = true;
      document.addEventListener('visibilitychange', cancelOnHide);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (document.hidden) return;

      const inputRect = messageInput.getBoundingClientRect();
      const rowRect = messageRow?.getBoundingClientRect();
      const sourceX = inputRect.left + inputRect.width / 2;
      const sourceY = inputRect.top + inputRect.height / 2;
      const targetX = rowRect && rowRect.width && rowRect.height ? rowRect.left + rowRect.width / 2 : sourceX;
      const targetY = rowRect && rowRect.width && rowRect.height ? rowRect.top + rowRect.height / 2 : sourceY;
      const glyphs = ['💗', '💕', '✨'];
      const particlesData = [];
      const count = 10 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('span');
        particle.className = 'send-gather-particle';
        particle.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
        particle.style.fontSize = `${10 + Math.random() * 8}px`;
        const startX = sourceX + (Math.random() - .5) * 34;
        const startY = sourceY + (Math.random() - .5) * 18;
        const clusterX = targetX + (Math.random() - .5) * 18;
        const clusterY = targetY + (Math.random() - .5) * 18;
        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;
        sendGatherOverlay.appendChild(particle);
        particles.push(particle);
        particlesData.push({ particle, startX, startY, clusterX, clusterY });
      }

      const gatherAnimations = particlesData.map(({ particle, startX, startY, clusterX, clusterY }) =>
        particle.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: .95 },
          { transform: `translate(${clusterX - startX}px, ${clusterY - startY}px) scale(1)`, opacity: 1 }
        ], { duration: 250, easing: 'ease-in', fill: 'forwards' }));
      sendGatherAnimations = gatherAnimations;
      await Promise.all(gatherAnimations.map((animation) => animation.finished.catch(() => {})));
      if (document.hidden) return;
      particlesData.forEach(({ particle, clusterX, clusterY }, index) => {
        particle.style.left = `${clusterX}px`;
        particle.style.top = `${clusterY}px`;
        gatherAnimations[index].cancel();
      });

      const squeezeAnimations = particles.map((particle) => particle.animate([
        { transform: 'scale(1)', opacity: .88 },
        { transform: 'scale(.6)', opacity: 1 }
      ], { duration: 120, easing: 'ease-in', fill: 'forwards' }));
      sendGatherAnimations = squeezeAnimations;
      await Promise.all(squeezeAnimations.map((animation) => animation.finished.catch(() => {})));
      if (document.hidden) return;
      squeezeAnimations.forEach((animation) => animation.cancel());

      const listRect = messagesContainer.getBoundingClientRect();
      const destinationX = listRect.left + 12 + Math.random() * Math.max(1, listRect.width - 24);
      const destinationY = listRect.top + listRect.height * (.2 + Math.random() * .4);
      const flightAnimations = particlesData.map(({ particle, clusterX, clusterY }) => {
        const endX = destinationX + (Math.random() - .5) * 54;
        const endY = destinationY + (Math.random() - .5) * 42;
        const dx = endX - clusterX;
        const dy = endY - clusterY;
        const arc = 36 + Math.random() * 36;
        return particle.animate([
          { transform: 'translate(0, 0) scale(.6)', opacity: 1, offset: 0 },
          { transform: `translate(${dx * .5}px, ${dy * .5 - arc}px) scale(.42)`, opacity: .72, offset: .52 },
          { transform: `translate(${dx}px, ${dy}px) scale(.2)`, opacity: 0, offset: 1 }
        ], { duration: 700, easing: 'ease-out', fill: 'forwards' });
      });
      sendGatherAnimations = flightAnimations;
      await Promise.all(flightAnimations.map((animation) => animation.finished.catch(() => {})));
      if (document.hidden) return;

      ripple = document.createElement('span');
      ripple.className = 'send-gather-ripple';
      ripple.style.left = `${destinationX - 15}px`;
      ripple.style.top = `${destinationY - 15}px`;
      sendGatherOverlay.appendChild(ripple);
      const rippleAnimation = ripple.animate([
        { transform: 'scale(0)', opacity: .35 },
        { transform: 'scale(1.7)', opacity: 0 }
      ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
      sendGatherAnimations = [rippleAnimation];
      await rippleAnimation.finished.catch(() => {});
    } catch (error) {
      console.warn('Hiệu ứng gửi tin bị bỏ qua:', error);
    } finally {
      if (ownsEffect) {
        document.removeEventListener('visibilitychange', cancelOnHide);
        sendGatherAnimations.forEach((animation) => { try { animation.cancel(); } catch {} });
        particles.forEach((particle) => particle.remove());
        ripple?.remove();
        sendGatherRunning = false;
        sendGatherAnimations = [];
      }
    }
  }

  function captureTextFlightSource() {
    try {
      const rect = messageInput.getBoundingClientRect();
      const style = getComputedStyle(messageInput);
      return {
        left: rect.left + parseFloat(style.paddingLeft || '0'),
        top: rect.top + parseFloat(style.paddingTop || '0'),
        width: Math.max(40, rect.width - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')),
        height: Math.max(24, rect.height - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')),
        font: style.font,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: style.color,
        textAlign: style.textAlign
      };
    } catch {
      return null;
    }
  }

  function canStartSendVisualEffect() {
    try {
      return !sendGatherRunning && !document.hidden && !!sendGatherOverlay &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function revealTextMessage(row) {
    if (!row) return;
    const bubble = row.querySelector('.message-bubble');
    const content = row.querySelector('.message-content');
    if (content) content.style.opacity = '1';
    if (bubble) {
      bubble.style.transition = 'opacity 150ms ease';
      bubble.style.opacity = '.6';
      requestAnimationFrame(() => { bubble.style.opacity = '1'; });
    }
  }

  async function animateSendTextEffect(messageRow, text, source) {
    let textFly = null;
    let particles = [];
    let ownsEffect = false;
    const cancelOnHide = () => {
      if (document.hidden) sendGatherAnimations.forEach((animation) => animation.cancel());
    };
    try {
      if (!text || !source || !canStartSendVisualEffect() || typeof Element.prototype.animate !== 'function') return false;
      sendGatherRunning = true;
      ownsEffect = true;
      document.addEventListener('visibilitychange', cancelOnHide);

      const rowRect = messageRow?.getBoundingClientRect();
      const listRect = messagesContainer.getBoundingClientRect();
      const targetX = rowRect?.width ? rowRect.left + rowRect.width / 2 : listRect.left + listRect.width / 2;
      const targetY = rowRect?.height ? rowRect.top + rowRect.height / 2 : listRect.top + listRect.height / 2;
      textFly = document.createElement('span');
      textFly.className = 'send-flying-text';
      textFly.textContent = Array.from(text).length > 40 ? `${Array.from(text).slice(0, 40).join('')}…` : text;
      Object.assign(textFly.style, {
        left: `${source.left}px`, top: `${source.top}px`, width: `${source.width}px`,
        maxHeight: `${source.height}px`, font: source.font, fontFamily: source.fontFamily,
        fontSize: source.fontSize, fontWeight: source.fontWeight, lineHeight: source.lineHeight,
        letterSpacing: source.letterSpacing, color: source.color, textAlign: source.textAlign
      });
      sendGatherOverlay.appendChild(textFly);
      const startX = source.left;
      const startY = source.top;
      const dx = targetX - startX;
      const dy = targetY - startY;
      const flight = textFly.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * .55}px, ${dy * .55 - 18}px) scale(.95)`, opacity: .92, offset: .55 },
        { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: .78, offset: 1 }
      ], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      sendGatherAnimations = [flight];
      await flight.finished.catch(() => {});
      if (document.hidden) return false;

      revealTextMessage(messageRow);
      const displayText = textFly.textContent;
      textFly.remove();
      textFly = null;
      const endX = targetX;
      const endY = targetY;
      const glyphs = Array.from(displayText)
        .filter((character) => !/\s/.test(character)).slice(0, 24);
      for (let i = 0; i < glyphs.length; i++) {
        const character = document.createElement('span');
        character.className = 'send-flying-character';
        character.textContent = glyphs[i];
        character.style.left = `${endX + (Math.random() - .5) * 18}px`;
        character.style.top = `${endY + (Math.random() - .5) * 10}px`;
        sendGatherOverlay.appendChild(character);
        particles.push(character);
      }
      const charsText = particles.map((character) => character.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: .95 },
        {
          transform: `translate(${Math.round(Math.random() * 80 - 40)}px, ${Math.round(-10 - Math.random() * 40)}px) rotate(${Math.round(Math.random() * 40 - 20)}deg) scale(.65)`,
          opacity: 0
        }
      ], { duration: 500, delay: Math.floor(Math.random() * 121), easing: 'ease-out', fill: 'forwards' }));
      const hearts = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < hearts; i++) {
        const heart = document.createElement('span');
        heart.className = 'send-flying-heart';
        heart.textContent = '💗';
        heart.style.left = `${endX + (Math.random() - .5) * 24}px`;
        heart.style.top = `${endY + (Math.random() - .5) * 14}px`;
        sendGatherOverlay.appendChild(heart);
        particles.push(heart);
        charsText.push(heart.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          {
            transform: `translate(${Math.round(Math.random() * 80 - 40)}px, ${Math.round(-10 - Math.random() * 40)}px) scale(.5)`,
            opacity: 0
          }
        ], { duration: 500, delay: Math.floor(Math.random() * 121), easing: 'ease-out', fill: 'forwards' }));
      }
      sendGatherAnimations = charsText;
      await Promise.all(charsText.map((animation) => animation.finished.catch(() => {})));
      return !document.hidden;
    } catch (error) {
      console.warn('Hiệu ứng chữ bay bị bỏ qua:', error);
      return false;
    } finally {
      if (ownsEffect) {
        document.removeEventListener('visibilitychange', cancelOnHide);
        sendGatherAnimations.forEach((animation) => { try { animation.cancel(); } catch {} });
        textFly?.remove();
        particles.forEach((particle) => particle.remove());
        sendGatherAnimations = [];
        sendGatherRunning = false;
      }
    }
  }

  function messageMatches(a, b) {
    return a.sender_id === b.sender_id && (a.content || null) === (b.content || null) &&
      (a.image_path || null) === (b.image_path || null) && (a.reply_to || null) === (b.reply_to || null) &&
      !!a.is_sticker === !!b.is_sticker && (a.remind_mode || 'none') === (b.remind_mode || 'none');
  }

  function promoteOptimisticRow(row, serverMessage) {
    if (!row || !serverMessage) return;
    const oldId = row.id;
    if (oldId && oldId.startsWith('tmp-')) messageIds.delete(oldId);
    row.id = 'msg-' + serverMessage.id;
    delete row.dataset.temp;
    row.dataset.msg = JSON.stringify(serverMessage);
    row.dataset.sendStatus = 'sent';
    row.classList.remove('is-sending', 'send-error');
    row.style.opacity = '1';
    row.style.transition = 'opacity 200ms ease';
    const retry = row.querySelector('.retry-send');
    if (retry) retry.remove();
    messageIds.add(serverMessage.id);
    messageCache.delete(oldId);
    messageCache.set(serverMessage.id, serverMessage);
    const previewUrl = row.dataset.tempObjectUrl;
    if (previewUrl && serverMessage.image_path) {
      getSignedUrl(serverMessage.image_path).then((url) => {
        const img = row.querySelector('.msg-image, .msg-sticker');
        if (url && img) {
          img.onload = () => { URL.revokeObjectURL(previewUrl); delete row.dataset.tempObjectUrl; };
          img.src = url;
        } else {
          URL.revokeObjectURL(previewUrl);
          delete row.dataset.tempObjectUrl;
        }
      });
    }
    renderSeen();
    saveMsgsToCache();
  }

  async function addOptimisticMessage(message, insertMessage, options = {}) {
    const tempId = `tmp-${Date.now()}-${++tempMessageSequence}`;
    const optimistic = { ...message, id: tempId, created_at: new Date().toISOString() };
    const isTextMessage = !message.image_path && !message.is_sticker && !!message.content;
    const useTextFlight = isTextMessage && !!options.textFlightSource && canStartSendVisualEffect();
    const row = await addMsg(optimistic, false, {
      temporary: true,
      animate: true,
      hideTextContent: useTextFlight,
      localImageUrl: options.localImageUrl || null
    });
    if (!row) return;
    row.dataset.sendStatus = 'sending';
    row.classList.add('is-sending');
    renderSeen();
    scrollMessagesToBottom();
    if (message.image_path || message.is_sticker) {
      animateSendGatherEffect(row);
    } else if (useTextFlight) {
      animateSendTextEffect(row, message.content, options.textFlightSource)
        .then((played) => { if (!played) revealTextMessage(row); })
        .catch(() => revealTextMessage(row));
    }
    let restoredAfterFailure = false;

    const send = async () => {
      const retry = row.querySelector('.retry-send');
      if (retry) retry.remove();
      row.classList.remove('send-error');
      row.classList.add('is-sending');
      row.dataset.sendStatus = 'sending';
      row.style.opacity = '.6';
      renderSeen();
      try {
        const serverMessage = await insertMessage();
        if (!serverMessage) throw new Error('Không nhận được xác nhận từ máy chủ.');
        promoteOptimisticRow(row, serverMessage);
        if (restoredAfterFailure && options.restoreText && messageInput.value.trim() === options.restoreText) {
          messageInput.value = '';
          resizeMessageInput();
          updateSendButtonVisibility();
        }
        if (options.onSuccess) options.onSuccess(serverMessage);
      } catch (error) {
        if (row.dataset.sendStatus === 'sent') return;
        console.error('Lỗi gửi tin:', error);
        row.classList.remove('is-sending');
        row.classList.add('send-error');
        row.style.opacity = '1';
        row.dataset.sendStatus = 'failed';
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'retry-send';
        retryButton.textContent = 'Thử lại';
        retryButton.addEventListener('click', send);
        row.appendChild(retryButton);
        if (options.restoreText && !messageInput.value.trim()) {
          messageInput.value = options.restoreText;
          restoredAfterFailure = true;
          resizeMessageInput();
          updateSendButtonVisibility();
        }
        renderSeen();
      }
    };
    send();
  }

  async function sendSticker(sticker) {
    if (!currentUser || !sticker?.path) return false;
    const remindSelect = document.getElementById('remind-select');
    const payload = {
      sender_id: currentUser.id,
      image_path: sticker.path,
      is_sticker: true,
      content: null,
      reply_to: activeReply?.id || null,
      remind_mode: remindSelect ? remindSelect.value : 'none'
    };
    animateSendButton();
    await addOptimisticMessage(payload, async () => {
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }, { onSuccess: () => {
      if (remindSelect) remindSelect.value = 'none';
      clearReply();
      closeStickerPanel();
    } });
    if (remindSelect) remindSelect.value = 'none';
    clearReply();
    closeStickerPanel();
    return true;
  }

  async function renderStickerTray() {
    stickerGrid.replaceChildren();
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'sticker-item sticker-add';
    addButton.textContent = '➕ Thêm sticker';
    addButton.addEventListener('click', () => {
      fileSticker.value = '';
      fileSticker.click();
    });
    stickerGrid.appendChild(addButton);

    for (const sticker of stickerItems) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sticker-item';
      button.setAttribute('aria-label', 'Gửi sticker');
      const img = document.createElement('img');
      img.alt = 'sticker';
      img.loading = 'lazy';
      getSignedUrl(sticker.path).then((url) => { if (url) img.src = url; });

      let holdTimer = null;
      let suppressClick = false;
      const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
      button.addEventListener('pointerdown', () => {
        if (sticker.owner_id !== currentUser?.id) return;
        holdTimer = setTimeout(async () => {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 1000);
          if (confirm('Xóa sticker này khỏi khay?')) {
            const { error } = await supabase.from('stickers').delete()
              .eq('id', sticker.id).eq('owner_id', currentUser.id);
            if (error) alert('Không xóa được sticker: ' + error.message);
            else {
              stickerItems = stickerItems.filter((item) => item.id !== sticker.id);
              renderStickerTray();
            }
          }
        }, 650);
      });
      button.addEventListener('pointerup', cancelHold);
      button.addEventListener('pointercancel', cancelHold);
      button.addEventListener('pointerleave', cancelHold);
      button.addEventListener('contextmenu', (event) => {
        if (sticker.owner_id !== currentUser?.id) return;
        event.preventDefault();
      });
      button.addEventListener('click', () => {
        if (suppressClick) { suppressClick = false; return; }
        sendSticker(sticker);
      });
      button.appendChild(img);
      stickerGrid.appendChild(button);
    }
  }

  async function loadStickers() {
    const { data, error } = await supabase.from('stickers').select('id, owner_id, path, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Không tải được sticker:', error);
      return;
    }
    stickerItems = data || [];
    await renderStickerTray();
  }

  async function stickerBlobFromFile(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Hãy chọn tệp ảnh.');
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Không chuyển được ảnh sang PNG.'));
    }, 'image/png'));
  }

  async function addStickerFile(file, sendAfterSave = false) {
    try {
      const blob = await stickerBlobFromFile(file);
      const random = Math.random().toString(36).slice(2, 8);
      const path = `${currentUser.id}/stickers/${Date.now()}-${random}.png`;
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, blob, {
        contentType: 'image/png'
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('stickers').insert({
        owner_id: currentUser.id,
        path
      });
      if (insertError) throw insertError;
      const sticker = { owner_id: currentUser.id, path, created_at: new Date().toISOString() };
      if (sendAfterSave) await sendSticker(sticker);
      await loadStickers();
    } catch (error) {
      console.error('Lỗi thêm sticker:', error);
      alert('Không thêm được sticker: ' + (error.message || String(error)));
    }
  }

  async function handleStickerFiles(files, sendAfterSave = false) {
    const images = Array.from(files || []).filter((file) => file.type?.startsWith('image/'));
    for (const image of images) await addStickerFile(image, sendAfterSave);
  }

  // ─── Save messages to cache ──────────────────────────────────────────────────
  function saveMsgsToCache() {
    // Collect up to 100 rendered message IDs (in order)
    try {
      const rows = messagesContainer.querySelectorAll('.message-row[data-msg]');
      const arr = [];
      rows.forEach((r) => {
        if (r.dataset.temp === 'true') return;
        try { arr.push(JSON.parse(r.dataset.msg)); } catch {}
      });
      const last100 = arr.slice(-100);
      lsSet(CACHE_MSGS_KEY, last100);
    } catch {}
  }

  // ─── Read status ─────────────────────────────────────────────────────────────
  async function markRead() {
    if (!currentUser || document.visibilityState !== 'visible') return;
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .neq('sender_id', currentUser.id)
        .is('read_at', null);
    } catch (err) {
      console.error('markRead error:', err);
    }
  }

  function renderSeen() {
    if (!currentUser) return;
    const existing = messagesContainer.querySelectorAll('.message-seen-status');
    existing.forEach((el) => el.remove());

    const selfRows = messagesContainer.querySelectorAll('.message-row.self[data-msg]');
    if (!selfRows || selfRows.length === 0) return;
    const lastSelfRow = selfRows[selfRows.length - 1];

    let msgData = null;
    try {
      msgData = JSON.parse(lastSelfRow.dataset.msg);
    } catch {}

    const seenEl = document.createElement('div');
    seenEl.className = 'message-seen-status';
    seenEl.style.opacity = '0';
    requestAnimationFrame(() => { seenEl.style.opacity = '1'; });
    if (lastSelfRow.dataset.sendStatus === 'sending') {
      seenEl.textContent = 'Đang gửi…';
    } else if (lastSelfRow.dataset.sendStatus === 'failed') {
      seenEl.textContent = 'Chưa gửi được';
    } else if (msgData && msgData.read_at) {
      seenEl.textContent = 'Iu dấu đã xem lúc ' + formatTime(msgData.read_at);
    } else {
      seenEl.textContent = 'Đã gửi';
    }
    lastSelfRow.appendChild(seenEl);
  }

  function updateMsgReadAt(updatedMsg) {
    if (!updatedMsg || !updatedMsg.id) return;
    const row = document.getElementById('msg-' + updatedMsg.id);
    if (row && row.dataset.msg) {
      try {
        const current = JSON.parse(row.dataset.msg);
        current.read_at = updatedMsg.read_at;
        row.dataset.msg = JSON.stringify(current);
      } catch {}
    }
    saveMsgsToCache();
    renderSeen();
  }

  // ─── Typing indicator ────────────────────────────────────────────────────────
  function subscribeTyping() {
    if (typingChannel) supabase.removeChannel(typingChannel);

    typingChannel = supabase.channel('typing-room', {
      config: { broadcast: { self: false } }
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const senderId = payload.payload?.user_id;
        if (currentUser && senderId && senderId !== currentUser.id) {
          showTyping(senderId);
        }
      })
      .on('broadcast', { event: 'stop' }, (payload) => {
        const senderId = payload.payload?.user_id;
        if (currentUser && senderId && senderId !== currentUser.id) {
          hideTyping();
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeTyping, 1500);
        }
      });
  }

  function showTyping(senderId) {
    if (!typingIndicator) return;
    const name = profilesMap.get(senderId)?.name || 'Iu dấu';
    typingIndicator.textContent = '💕 ' + name + ' đang nhập...';
    typingIndicator.style.display = 'block';
    clearTimeout(typingTimer);
    typingTimer = setTimeout(hideTyping, 4000);
  }

  function hideTyping() {
    clearTimeout(typingTimer);
    if (!typingIndicator) return;
    typingIndicator.textContent = '';
    typingIndicator.style.display = 'none';
  }

  function sendTyping() {
    if (!currentUser || document.visibilityState !== 'visible' || !typingChannel) return;
    const val = messageInput.value.trim();
    if (!val) {
      sendStopTyping();
      return;
    }
    const now = Date.now();
    if (now - lastTypingSent > 2000) {
      lastTypingSent = now;
      typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUser.id }
      });
    }
  }

  function sendStopTyping() {
    if (!currentUser || !typingChannel) return;
    lastTypingSent = 0;
    typingChannel.send({
      type: 'broadcast',
      event: 'stop',
      payload: { user_id: currentUser.id }
    });
  }

  // ─── Render one message (addMsg) ─────────────────────────────────────────────
  async function addMsg(message, scroll = true, options = {}) {
    if (!message || !message.id) return;
    if (!String(message.id).startsWith('tmp-') && currentUser && message.sender_id === currentUser.id) {
      const pendingRows = messagesContainer.querySelectorAll('.message-row[data-send-status="sending"]');
      for (const pendingRow of pendingRows) {
        try {
          const pendingMessage = JSON.parse(pendingRow.dataset.msg);
          if (messageMatches(pendingMessage, message)) {
            promoteOptimisticRow(pendingRow, message);
            return pendingRow;
          }
        } catch {}
      }
    }
    messageCache.set(message.id, message);
    if (messageIds.has(message.id)) {
      const existingRow = document.getElementById('msg-' + message.id);
      if (existingRow && existingRow.dataset.msg) {
        try {
          const current = JSON.parse(existingRow.dataset.msg);
          existingRow.dataset.msg = JSON.stringify({ ...current, ...message });
        } catch {}
      }
      return document.getElementById('msg-' + message.id);
    }
    messageIds.add(message.id);

    const isSelf = currentUser && message.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = 'message-row ' + (isSelf ? 'self' : 'other');
    row.id = 'msg-' + message.id;
    if (options.temporary) {
      row.dataset.temp = 'true';
      row.dataset.sendStatus = 'sending';
      row.classList.add('is-sending');
      row.style.opacity = '.6';
      if (options.localImageUrl) row.dataset.tempObjectUrl = options.localImageUrl;
    }
    // Store raw msg JSON on element for cache
    try { row.dataset.msg = JSON.stringify(message); } catch {}

    const replyQuote = message.reply_to ? createReplyQuote(message.reply_to) : null;

    if (message.is_sticker) {
      row.classList.add('sticker-message');
      if (replyQuote) row.appendChild(replyQuote);
      const name = document.createElement('div');
      name.className = 'sticker-sender';
      name.textContent = senderName(message);
      row.appendChild(name);
      const img = document.createElement('img');
      img.className = 'msg-sticker';
      img.loading = 'lazy';
      img.alt = 'sticker';
      if (options.localImageUrl) img.src = options.localImageUrl;
      else getSignedUrl(message.image_path).then((url) => { if (url) img.src = url; });
      row.appendChild(img);
    } else if (message.image_path) {
      const wrap = document.createElement('div');
      wrap.className = 'msg-image-wrap';
      if (replyQuote) wrap.appendChild(replyQuote);
      const img = document.createElement('img');
      img.className = 'msg-image';
      img.loading = 'lazy';
      img.alt = 'ảnh';
      if (options.localImageUrl) {
        img.src = options.localImageUrl;
        img.style.minHeight = '';
      } else getSignedUrl(message.image_path).then((url) => {
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
      if (replyQuote) bubble.appendChild(replyQuote);
      const content = document.createElement('span');
      content.className = 'message-content';
      content.textContent = message.content || '';
      if (options.hideTextContent) content.style.opacity = '0';
      bubble.appendChild(content);
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
    enableSwipeReply(row, message);
    if (options.animate) animateMessage(row, isSelf);
    renderSeen();
    if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return row;
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
      renderSeen();
      await markRead();
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
            const alreadyRendered = messageIds.has(payload.new.id);
            const wasNearBottom = nearMessagesBottom();
            await addMsg(payload.new, false, { animate: !alreadyRendered });
            if (currentUser && payload.new.sender_id !== currentUser.id) {
              if (wasNearBottom) scrollMessagesToBottom();
              else if (newMessagesButton) newMessagesButton.classList.add('visible');
            } else if (!alreadyRendered) {
              scrollMessagesToBottom();
            }
            saveMsgsToCache();
            if (currentUser && payload.new.sender_id !== currentUser.id) {
              hideTyping();
              markRead();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new) {
            updateMsgReadAt(payload.new);
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
      renderSeen();
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
  async function uploadAndSendImage(file, captionText, replyToId = null) {
    if (!currentUser || !file) return false;
    const remindSelect = document.getElementById('remind-select');
    const path = `chat-images/${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const objectUrl = URL.createObjectURL(file);
    const payload = {
      sender_id: currentUser.id,
      image_path: path,
      content: captionText || null,
      reply_to: replyToId,
      remind_mode: remindSelect ? remindSelect.value : 'none'
    };
    animateSendButton();
    await addOptimisticMessage(payload, async () => {
      const blob = await resizeImage(file);
      if (!blob) throw new Error('Không xử lý được ảnh.');
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, blob, {
        contentType: 'image/jpeg', upsert: true
      });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }, {
      localImageUrl: objectUrl,
      restoreText: captionText || '',
      onSuccess: () => {
        if (remindSelect) remindSelect.value = 'none';
      }
    });
    if (remindSelect) remindSelect.value = 'none';
    return true;
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    sendStopTyping();
    const caption = messageInput.value.trim();
    if (caption) {
      messageInput.value = '';
      resizeMessageInput();
      updateSendButtonVisibility();
    }
    const replyToId = activeReply?.id || null;
    for (let i = 0; i < files.length; i++) {
      uploadAndSendImage(files[i], i === 0 ? caption : '', replyToId);
    }
    if (replyToId) clearReply();
  }

  // ─── Attach menu ─────────────────────────────────────────────────────────────
  if (btnAttach && attachMenu) {
    btnAttach.addEventListener('click', (e) => { e.stopPropagation(); attachMenu.classList.toggle('open'); });
    document.addEventListener('click', () => attachMenu.classList.remove('open'));
    attachMenu.addEventListener('click', (e) => e.stopPropagation());
  }
  if (btnSticker && stickerPanel && stickerGrid && fileSticker) {
    btnSticker.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (attachMenu) attachMenu.classList.remove('open');
      const open = !stickerPanel.classList.contains('open');
      stickerPanel.classList.toggle('open', open);
      stickerPanel.setAttribute('aria-hidden', String(!open));
      if (open) await loadStickers();
    });
    stickerPanel.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', (event) => {
      if (!stickerPanel.contains(event.target) && event.target !== btnSticker) closeStickerPanel();
    });
    fileSticker.addEventListener('change', () => handleStickerFiles(fileSticker.files));
    messageInput.addEventListener('paste', (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type?.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      if (confirm('Lưu làm sticker và gửi?')) handleStickerFiles(files, true);
    });
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
    const textFlightSource = captureTextFlightSource();
    sendStopTyping();
    const remindSelect = document.getElementById('remind-select');
    const remindMode = remindSelect ? remindSelect.value : 'none';
    const replyToId = activeReply?.id || null;
    const payload = {
      content: text,
      sender_id: currentUser.id,
      remind_mode: remindMode,
      reply_to: replyToId
    };
    messageInput.value = '';
    resizeMessageInput();
    updateSendButtonVisibility();
    animateSendButton();
    await addOptimisticMessage(payload, async () => {
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }, {
      restoreText: text,
      textFlightSource,
      onSuccess: () => {
        if (remindSelect) remindSelect.value = 'none';
        clearReply();
      }
    });
    if (remindSelect) remindSelect.value = 'none';
    clearReply();
    messageInput.focus();
  }

  // ─── Visibility / focus sync ──────────────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
      syncMessages();
      markRead();
      checkNotificationStatus();
      ensurePush();
      refreshCoverFromServer();
    } else if (document.visibilityState === 'hidden') {
      sendStopTyping();
    }
  });
  window.addEventListener('pageshow', () => { if (currentUser) { syncMessages(); markRead(); checkNotificationStatus(); ensurePush(); refreshCoverFromServer(); } });
  window.addEventListener('focus', () => { if (currentUser) { syncMessages(); markRead(); } });
  setInterval(() => {
    if (document.visibilityState === 'visible') ensurePush();
  }, 30 * 60 * 1000);

  // ─── initChat ────────────────────────────────────────────────────────────────
  async function initChat(user) {
    try {
      currentUser = user;
      authScreen.classList.remove('active');
      chatScreen.classList.add('active');
      requestAnimationFrame(syncVisualViewport);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentProfile = profile;
        userAvatar.textContent = (profile.name || 'DN').substring(0, 2).toUpperCase();
        chatTitle.textContent = profile.name || 'DiNhiChat';
      }

      await loadProfiles();
      await loadCover();
      subscribeCoverSettings();
      await loadFromCacheThenSync();
      subscribeRoom();
      subscribeTyping();
      await checkNotificationStatus();
      ensurePush();
      await markRead();
    } catch (err) {
      console.error('initChat error:', err);
    }
  }

  function showAuth() {
    currentUser = null; currentProfile = null;
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (typingChannel) { supabase.removeChannel(typingChannel); typingChannel = null; }
    if (coverChannel) { supabase.removeChannel(coverChannel); coverChannel = null; }
    hideTyping();
    chatScreen.classList.remove('active');
    authScreen.classList.add('active');
    requestAnimationFrame(syncVisualViewport);
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
  btnCover.addEventListener('click', (event) => {
    event.stopPropagation();
    coverMenu.classList.toggle('open');
  });
  coverMenu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', (event) => {
    if (!coverMenu.contains(event.target) && event.target !== btnCover) coverMenu.classList.remove('open');
  });
  coverChange.addEventListener('click', () => {
    coverMenu.classList.remove('open');
    coverFile.value = '';
    coverFile.click();
  });
  coverRemove.addEventListener('click', removeCover);
  coverFile.addEventListener('change', () => {
    if (coverFile.files?.[0]) uploadCover(coverFile.files[0]);
  });
  btnSend.addEventListener('click', sendMessage);
  if (newMessagesButton) newMessagesButton.addEventListener('click', scrollMessagesToBottom);
  replyCancel.addEventListener('click', clearReply);
  messageInput.addEventListener('input', () => { resizeMessageInput(); updateSendButtonVisibility(); sendTyping(); });
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  updateSendButtonVisibility();

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

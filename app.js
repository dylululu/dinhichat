// app.js - DiNhiChat client logic

(function () {
  'use strict';

  // Khởi tạo Supabase client
  const supabase = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY
  );

  // DOM Elements
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

  let currentUser = null;
  let currentProfile = null;
  let realtimeChannel = null;
  const messageIds = new Set();

  // Đăng ký Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.error('ServiceWorker registration failed:', err);
    });
  }

  // Kiểm tra Standalone (PWA trên iPhone hoặc trình duyệt khác)
  function isStandaloneMode() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  // Chuyển đổi VAPID public key
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Đăng ký và lưu Web Push Subscription
  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Trình duyệt không hỗ trợ Web Push.');
      return false;
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
        const { error } = await supabase
          .from('profiles')
          .update({ push_subscription: sub.toJSON() })
          .eq('id', currentUser.id);

        if (error) {
          console.error('Lỗi lưu subscription:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Lỗi khi đăng ký push:', err);
      return false;
    }
  }

  // Cập nhật trạng thái nút thông báo
  async function checkNotificationStatus() {
    if (!('Notification' in window)) {
      btnNotify.style.display = 'none';
      return;
    }

    const standalone = isStandaloneMode();

    if (!standalone) {
      btnNotify.style.display = 'inline-flex';
      btnNotify.onclick = () => {
        pwaInstallBanner.style.display = 'block';
        alert('Để nhận thông báo trên iPhone, hãy bấm nút Chia sẻ (biểu tượng mũi tên ở thanh dưới Safari) rồi chọn "Thêm vào Màn hình chính".');
      };
      return;
    }

    pwaInstallBanner.style.display = 'none';

    if (Notification.permission === 'granted') {
      btnNotify.style.display = 'none';
      // Tự động đồng bộ lại subscription
      subscribePush();
    } else {
      btnNotify.style.display = 'inline-flex';
      btnNotify.onclick = async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const success = await subscribePush();
          if (success) {
            btnNotify.style.display = 'none';
          }
        } else {
          alert('Bạn đã từ chối quyền thông báo. Hãy kiểm tra Cài đặt của iPhone.');
        }
      };
    }
  }

  // Format thời gian HH:mm
  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Render 1 tin nhắn vào DOM (chống trùng theo message.id và chống XSS bằng textContent)
  function appendMessage(message, scroll = true) {
    if (messageIds.has(message.id)) {
      return;
    }
    messageIds.add(message.id);

    const isSelf = currentUser && message.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `message-row ${isSelf ? 'self' : 'other'}`;
    row.id = `msg-${message.id}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.content;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(message.created_at);

    row.appendChild(bubble);
    row.appendChild(time);
    messagesContainer.appendChild(row);

    if (scroll) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Tải 100 tin nhắn gần nhất
  async function loadRecentMessages() {
    messagesContainer.innerHTML = '';
    messageIds.clear();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Lỗi tải tin nhắn:', error);
      return;
    }

    if (data && data.length > 0) {
      // Đảo ngược để hiển thị theo thứ tự thời gian tăng dần
      const sorted = data.reverse();
      sorted.forEach((msg) => appendMessage(msg, false));
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Thiết lập kênh Realtime lắng nghe tin nhắn mới
  function setupRealtime() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new) {
            appendMessage(payload.new, true);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status);
      });
  }

  // Gửi tin nhắn
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;

    messageInput.value = '';
    btnSend.disabled = true;

    const { error } = await supabase.from('messages').insert({
      content: text,
      sender_id: currentUser.id
    });

    btnSend.disabled = false;
    messageInput.focus();

    if (error) {
      console.error('Lỗi gửi tin nhắn:', error);
      alert('Không gửi được tin nhắn: ' + error.message);
    }
  }

  // Khởi tạo màn hình Chat sau khi đăng nhập thành công
  async function initChat(user) {
    currentUser = user;
    authScreen.classList.remove('active');
    chatScreen.classList.add('active');

    // Lấy thông tin profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      currentProfile = profile;
      const initial = (profile.name || 'DN').substring(0, 2).toUpperCase();
      userAvatar.textContent = initial;
      chatTitle.textContent = profile.name || 'DiNhiChat';
    }

    await loadRecentMessages();
    setupRealtime();
    checkNotificationStatus();
  }

  // Khởi tạo màn hình đăng nhập
  function showAuth() {
    currentUser = null;
    currentProfile = null;
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    chatScreen.classList.remove('active');
    authScreen.classList.add('active');
  }

  // Form đăng nhập
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    btnLogin.disabled = true;
    btnLogin.textContent = 'Đang đăng nhập...';

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    btnLogin.disabled = false;
    btnLogin.textContent = 'Đăng nhập';

    if (error) {
      loginError.textContent = error.message === 'Invalid login credentials'
        ? 'Sai email hoặc mật khẩu.'
        : error.message;
      return;
    }

    if (data.user) {
      initChat(data.user);
    }
  });

  // Đăng xuất
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showAuth();
  });

  // Gửi tin nhắn qua Enter hoặc nút Gửi
  btnSend.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Kiểm tra phiên đăng nhập ban đầu
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      initChat(session.user);
    } else {
      showAuth();
    }
  });

  // Lắng nghe thay đổi trạng thái xác thực
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showAuth();
    } else if (event === 'SIGNED_IN' && session?.user) {
      if (!currentUser || currentUser.id !== session.user.id) {
        initChat(session.user);
      }
    }
  });
})();

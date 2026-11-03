// app.js - DiNhiChat client logic v3 (low-latency sync)

(function () {
  'use strict';

  const supabase = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY
  );

  // DOM
  const authScreen = document.getElementById('auth-screen');
  const chatScreen = document.getElementById('app');
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
  const coverCropOverlay = document.getElementById('cover-crop-overlay');
  const coverCropStage = document.getElementById('cover-crop-stage');
  const coverCropImage = document.getElementById('cover-crop-image');
  const coverCropFrame = document.getElementById('cover-crop-frame');
  const coverCropZoom = document.getElementById('cover-crop-zoom');
  const coverCropZoomLabel = document.getElementById('cover-crop-zoom-label');
  const coverCropCancel = document.getElementById('cover-crop-cancel');
  const coverCropRotate = document.getElementById('cover-crop-rotate');
  const coverCropDone = document.getElementById('cover-crop-done');
  const pwaInstallBanner = document.getElementById('pwa-install-banner');
  const messagesContainer = document.getElementById('messages-container');
  const sendGatherOverlay = document.getElementById('send-gather-overlay');
  const newMessagesButton = document.getElementById('new-messages-button');
  const messageInput = document.getElementById('message-input');
  const customKeyboard = document.getElementById('kb');
  const customKeyboardToggle = document.getElementById('kb-toggle');
  const customKeyboardHide = document.getElementById('kb-hide');
  const customKeyboardEmojiPicker = document.getElementById('kb-emoji-picker');
  const customKeyboardEmojiGrid = document.getElementById('kb-emoji-grid');
  const customKeyboardEmojiTabs = document.getElementById('kb-emoji-tabs');
  const customKeyboardPopover = document.getElementById('kb-popover');
  const keyboardLangToast = document.getElementById('kb-lang-toast');
  const keyboardSpaceLabel = document.getElementById('kb-space-label');
  const customKeyboardSymbols = document.querySelector('.kb-symbols');
  const customKeyboardLetters = document.querySelector('.kb-letters');
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
  const coverElement = document.getElementById('chat-cover');
  const typingIndicator = document.getElementById('typing-indicator');
  const peerPushNotice = document.getElementById('peer-push-notice');
  const notificationHelp = document.getElementById('notification-help');
  let fitViewportFrame = null;
  let lastViewportHeight = null;
  let lastViewportTop = null;
  let stickBottom = true;         // CHỈ sự kiện 'scroll' của #list mới được cập nhật cờ này (<80px)
  let lastUserScrollAt = 0;       // thời điểm cuộn/touchmove gần nhất (hoãn sync khi đang cuộn)
  let newMsgCount = 0;            // tin mới chưa xem khi stickBottom=false
  let bottomSettleTimer = null;
  let loadingOlder = false;       // chống tải trùng khi cuộn lên đầu
  let noMoreOlder = false;        // đã tải hết tin cũ
  let jumpLockUntil = 0;          // chặn auto-scroll 800ms sau khi nhảy tới tin cũ
  let viewingOldMessages = false; // đang xem tin cũ (có khoảng hở): không tự cuộn đáy
  let inputFocusPending = false;
  let keyboardBottomTimer = null;
  let pinkKeyboardOpen = false;
  let nativeKeyboardMode = true;
  document.body.classList.add('native-keyboard-mode');
  let keyboardTab = 'letters';
  let keyboardPreviousTab = 'letters';
  let keyboardEmojiCategory = 'recent';
  let keyboardShift = false;
  let keyboardCapsLock = false;
  const keyboardLangStorageKey = 'dinhichat_keyboard_lang_v1';
  let kbLang = 'vi';
  try { kbLang = localStorage.getItem(keyboardLangStorageKey) === 'en' ? 'en' : 'vi'; } catch {}
  let deleteRepeatTimer = null;
  let deleteRepeatStart = null;
  let emojiHoldTimer = null;
  let emojiHoldFired = false;
  let pendingEmojiKey = null;
  let alternateSymbols = false;
  let langPointerDown = null;
  let lastLangToggleAt = 0;
  let langToastTimer = null;
  let keyboardKeyCoordinates = new Map();
  let keyboardKeyPositions = new Map();
  let keyboardCoordinateFrame = null;
  let composerInputFramePending = false;

  function renderKeyboardLanguage() {
    const languageKey = customKeyboard.querySelector('[data-kb-key="language"]');
    if (languageKey) {
      languageKey.textContent = kbLang.toUpperCase();
      languageKey.classList.toggle('vi-active', kbLang === 'vi');
      languageKey.classList.toggle('en-active', kbLang === 'en');
      languageKey.setAttribute('aria-label', kbLang === 'vi' ? 'Tiếng Việt đang bật' : 'English đang bật');
    }
    if (keyboardSpaceLabel) keyboardSpaceLabel.textContent = kbLang.toUpperCase();
  }

  function toggleKeyboardLanguage() {
    kbLang = kbLang === 'vi' ? 'en' : 'vi';
    try { localStorage.setItem(keyboardLangStorageKey, kbLang); } catch {}
    renderKeyboardLanguage();
    if (keyboardLangToast) {
      keyboardLangToast.textContent = kbLang === 'vi' ? 'Tiếng Việt' : 'English';
      keyboardLangToast.classList.add('visible');
      clearTimeout(langToastTimer);
      langToastTimer = setTimeout(() => keyboardLangToast.classList.remove('visible'), 800);
    }
  }
  renderKeyboardLanguage();

  function completeKeyboardLanguagePointer(type, event) {
    if (!langPointerDown || event.pointerId !== langPointerDown.pointerId) return;
    const down = langPointerDown;
    langPointerDown = null;
    const upTarget = document.elementFromPoint?.(event.clientX, event.clientY) || event.target;
    const upKey = upTarget.closest?.('[data-kb-key="language"]');
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const now = Date.now();
    if (type === 'pointerup' && upKey === down.button && !down.moved && moved <= 10 && now - lastLangToggleAt >= 300) {
      lastLangToggleAt = now;
      toggleKeyboardLanguage();
    }
  }

  function openPinkKeyboard() {
    if (!customKeyboard || stickerPanel?.classList.contains('open')) return;
    nativeKeyboardMode = false;
    messageInput.setAttribute('inputmode', 'none');
    document.body.classList.remove('native-keyboard-mode', 'kb');
    document.documentElement.style.setProperty('--vvh', '100dvh');
    document.documentElement.style.setProperty('--vvt', '0px');
    customKeyboard.classList.add('open');
    customKeyboard.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pink-kb-open');
    pinkKeyboardOpen = true;
    const keyboardHeight = customKeyboard.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--cover-shift', `${-Math.round(keyboardHeight * .35)}px`);
    scheduleKeyboardCoordinateCache();
    scrollMessagesAfterKeyboard();
  }

  function closePinkKeyboard() {
    if (!customKeyboard) return;
    customKeyboard.classList.remove('open');
    customKeyboard.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pink-kb-open');
    document.documentElement.style.setProperty('--cover-shift', '0px');
    pinkKeyboardOpen = false;
    clearTimeout(deleteRepeatTimer);
    deleteRepeatTimer = null;
    scrollMessagesAfterKeyboard();
  }

  function useNativeKeyboard() {
    closePinkKeyboard();
    nativeKeyboardMode = true;
    document.body.classList.add('native-keyboard-mode');
    messageInput.removeAttribute('inputmode');
    messageInput.blur();
    try { messageInput.focus({ preventScroll: true }); } catch { messageInput.focus(); }
    scheduleFitViewport();
  }

  function usePinkKeyboard() {
    nativeKeyboardMode = false;
    document.body.classList.remove('native-keyboard-mode');
    messageInput.blur();
    messageInput.setAttribute('inputmode', 'none');
    openPinkKeyboard();
    try { messageInput.focus({ preventScroll: true }); } catch { messageInput.focus(); }
  }

  function resetToNativeKeyboard() {
    if (nativeKeyboardMode && !pinkKeyboardOpen) return;
    closePinkKeyboard();
    nativeKeyboardMode = true;
    document.body.classList.add('native-keyboard-mode');
    messageInput.removeAttribute('inputmode');
  }

  function emitComposerInput(inputType = 'insertText', data = null) {
    try { messageInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data })); }
    catch { messageInput.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function replaceComposerRange(start, end, text) {
    // 'end' đặt caret sau ký tự chèn, không cần setSelectionRange riêng.
    messageInput.setRangeText(text, start, end, 'end');
  }

  const toneFamilies = {
    a: ['a','á','à','ả','ã','ạ'], ă: ['ă','ắ','ằ','ẳ','ẵ','ặ'], â: ['â','ấ','ầ','ẩ','ẫ','ậ'],
    e: ['e','é','è','ẻ','ẽ','ẹ'], ê: ['ê','ế','ề','ể','ễ','ệ'], i: ['i','í','ì','ỉ','ĩ','ị'],
    o: ['o','ó','ò','ỏ','õ','ọ'], ô: ['ô','ố','ồ','ổ','ỗ','ộ'], ơ: ['ơ','ớ','ờ','ở','ỡ','ợ'],
    u: ['u','ú','ù','ủ','ũ','ụ'], ư: ['ư','ứ','ừ','ử','ữ','ự'], y: ['y','ý','ỳ','ỷ','ỹ','ỵ']
  };
  const toneBase = {};
  Object.entries(toneFamilies).forEach(([base, forms]) => forms.forEach((form) => { toneBase[form] = base; toneBase[form.toUpperCase()] = base.toUpperCase(); }));

  const toneKeys = { s: 1, f: 2, r: 3, x: 4, j: 5 };
  const vowelBases = new Set(['a','ă','â','e','ê','i','o','ô','ơ','u','ư','y']);
  const plainBase = (char) => (toneBase[char] || char).toLowerCase();
  const plainWord = (word) => Array.from(word, (char) => toneBase[char] || char).join('');
  const toneOf = (char) => {
    const base = plainBase(char);
    const family = toneFamilies[base];
    if (!family) return 0;
    const current = char.toLowerCase();
    return family.findIndex((form) => form === current);
  };
  const withShape = (char, target) => char === char.toUpperCase() ? target.toUpperCase() : target;

  function telexVowels(word) {
    const chars = Array.from(word);
    const bases = chars.map(plainBase);
    const result = [];
    for (let i = 0; i < bases.length; i++) {
      if (!vowelBases.has(bases[i])) continue;
      if (bases[i] === 'u' && i > 0 && bases[i - 1] === 'q') continue;
      if (bases[i] === 'i' && i > 0 && bases[i - 1] === 'g' && i + 1 < bases.length && vowelBases.has(bases[i + 1])) continue;
      result.push(i);
    }
    return { chars, bases, indices: result };
  }

  function toneTarget(word) {
    const { chars, bases, indices } = telexVowels(word);
    if (!indices.length) return -1;
    const shaped = indices.filter((i) => ['ă','â','ê','ô','ơ','ư'].includes(bases[i]));
    if (shaped.length) {
      const roundedO = shaped.filter((i) => bases[i] === 'ơ' && i > 0 && ['ư','u'].includes(bases[i - 1]));
      if (roundedO.length) return roundedO[roundedO.length - 1];
      return shaped[shaped.length - 1];
    }
    const selected = indices.map((i) => bases[i]);
    if (selected.slice(-3).join('') === 'uye') return indices[indices.length - 1];
    if (indices.length === 1) return indices[0];
    if (indices.length === 2) {
      const endsInConsonant = !vowelBases.has(bases[bases.length - 1]);
      const pair = selected.join('');
      if (endsInConsonant || ['oe','uy','uê'].includes(pair)) return indices[1];
      return indices[0];
    }
    if (indices.length === 3) return indices[1];
    return indices[Math.floor(indices.length / 2)];
  }

  function applyTone(word, tone) {
    const target = toneTarget(word);
    if (target < 0) return word;
    const chars = Array.from(word);
    const base = plainBase(chars[target]);
    const family = toneFamilies[base];
    if (!family) return word;
    const upper = chars[target] === chars[target].toUpperCase();
    chars[target] = upper ? family[tone].toUpperCase() : family[tone];
    return chars.join('');
  }

  function telex(word, key) {
    if (!/^[a-z]$/i.test(key) || !/^[\p{Script=Latin}]*$/u.test(word)) return word + key;
    const lowerKey = key.toLowerCase();
    const caseChar = (char, target) => withShape(char, target);
    const oldChars = Array.from(word);
    let oldTone = 0;
    oldChars.forEach((char) => { if (toneOf(char) > 0) oldTone = toneOf(char); });
    let clean = plainWord(word);

    if (lowerKey === 'z') {
      if (oldTone) return clean;
      return clean + key;
    }

    if (toneKeys[lowerKey]) {
      if (lowerKey === 'j' && clean.toLowerCase().startsWith('dươc')) clean = (clean[0] === clean[0].toUpperCase() ? 'Đ' : 'đ') + clean.slice(1);
      const target = toneTarget(clean);
      if (target < 0) return clean.toLowerCase().endsWith(lowerKey) ? clean : clean + key;
      if (oldTone === toneKeys[lowerKey]) return clean + key;
      return applyTone(clean, toneKeys[lowerKey]);
    }

    if (lowerKey === 'w') {
      const chars = Array.from(clean);
      const bases = chars.map(plainBase);
      // w shapes a contiguous uo/ưo cluster anywhere in the word, before or after final consonants.
      for (let i = bases.length - 1; i > 0; i--) {
        if (['u','ư'].includes(bases[i - 1]) && ['o','ơ'].includes(bases[i]) && !(i - 1 > 0 && bases[i - 2] === 'q')) {
          // Retyping w on ươ restores uo and leaves a literal w.
          if (bases[i - 1] === 'ư' && bases[i] === 'ơ') {
            chars[i - 1] = caseChar(chars[i - 1], 'u');
            chars[i] = caseChar(chars[i], 'o');
            return applyTone(chars.join('') + key, oldTone);
          }
          chars[i - 1] = caseChar(chars[i - 1], 'ư');
          chars[i] = caseChar(chars[i], 'ơ');
          return applyTone(chars.join(''), oldTone);
        }
      }
      // Otherwise modify the nearest eligible vowel in the trailing vowel run.
      for (let i = bases.length - 1; i >= 0; i--) {
        if (!vowelBases.has(bases[i])) break;
        if (['a','o','u'].includes(bases[i]) && !(bases[i] === 'u' && i > 0 && bases[i - 1] === 'q')) {
          chars[i] = caseChar(chars[i], { a:'ă', o:'ơ', u:'ư' }[bases[i]]);
          return applyTone(chars.join(''), oldTone);
        }
      }
      if (!clean) return 'ư';
      return clean + key;
    }

    if (lowerKey === 'a' || lowerKey === 'e' || lowerKey === 'o' || lowerKey === 'd') {
      const lastChar = Array.from(clean).pop() || '';
      const inverse = { 'â':['a','a'], 'ê':['e','e'], 'ô':['o','o'], 'đ':['d','d'] }[lastChar.toLowerCase()];
      const inverseKey = { 'â':'a', 'ê':'e', 'ô':'o', 'đ':'d' }[lastChar.toLowerCase()];
      if (inverse && lowerKey === inverseKey) {
        const chars = Array.from(clean); const last = chars.pop();
        clean = chars.join('') + caseChar(last, inverse[0]) + caseChar(last, inverse[1]);
        return applyTone(clean, oldTone);
      }
      const chars = Array.from(clean); const lastBase = plainBase(chars[chars.length - 1] || '');
      const shapes = { a:'â', e:'ê', o:'ô', d:'đ' };
      if (lastBase === lowerKey && shapes[lowerKey]) {
        const source = chars[chars.length - 1];
        chars.splice(-1, 1, caseChar(source, shapes[lowerKey]));
        return applyTone(chars.join(''), oldTone);
      }
    }

    return applyTone(clean + key, oldTone);
  }

  if (typeof window !== 'undefined') window.telex = telex;

  function insertComposerText(text, useTelex = true) {
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    const currentValue = messageInput.value;
    let value = text;
    const letter = /^[a-z]$/i.test(value);
    if (letter) {
      const prefix = currentValue.slice(Math.max(0, start - 20), start);
      if (keyboardCapsLock || keyboardShift || !prefix.trim() || /[.!?]\s*$|\n\s*$/.test(prefix)) value = value.toUpperCase();
      if (keyboardShift && !keyboardCapsLock) { keyboardShift = false; updateKeyboardCase(); }
    }
    if (useTelex && kbLang === 'vi' && letter && start === end) {
      const prefix = currentValue.slice(Math.max(0, start - 20), start);
      const match = prefix.match(/[\p{Script=Latin}]+$/u);
      if (match) {
        const wordStart = Math.max(0, start - 20) + prefix.length - match[0].length;
        const transformed = telex(match[0], value);
        replaceComposerRange(wordStart, start, transformed);
      } else replaceComposerRange(start, end, value);
    } else replaceComposerRange(start, end, value);
    emitComposerInput('insertText', value);
  }

  function eraseComposerCharacter() {
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    if (start !== end) replaceComposerRange(start, end, '');
    else if (start > 0) {
      let previous = start - 1;
      try {
        const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(messageInput.value.slice(0, start))];
        previous = segments.length ? segments[segments.length - 1].index : previous;
      } catch {
        const points = Array.from(messageInput.value.slice(0, start));
        const cluster = [points.pop() || ''];
        let rightmost = cluster[0];
        while (points.length) {
          const prior = points[points.length - 1];
          const needsJoin = /[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u0300-\u036F]/u.test(rightmost) || rightmost === '\u200d' || prior === '\u200d';
          if (!needsJoin) break;
          rightmost = points.pop();
          cluster.unshift(rightmost);
        }
        previous = start - cluster.join('').length;
      }
      replaceComposerRange(previous, start, '');
    } else return;
    emitComposerInput('deleteContentBackward');
  }

  const recentEmojiStorageKey = 'dinhichat_recent_emojis_v1';
  const keyboardEmojiCategories = {
    heart: '❤️ 💕 💗 💖 💘 💝 💞 💓 💟 ❣️ 😘 🥰 😍 😚 😙 😗 😻 💋 💌 🫶 🤍 🩷',
    face: '😂 🥺 😴 😊 😅 🙈 🤗 😉 😭 😁 😃 😄 😆 🤣 🥹 🙂 🙃 🥲 😌 😔 😢 😳 😮 😱 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 😎 🤓 🧐 🤔 🫢 🫣 🫡 😶 😐 😑 😬 🙄 😏',
    hand: '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🖐️ 🖖 👋 🤚 🫱 🫲 🫳 🫴',
    other: '🌙 ✨ 🌟 ⭐️ 💫 ☀️ 🌈 🌸 🌷 🌹 🦋 🎀 🐰 🐱 🐻 🐼 🍓 🍰 ☕️ 💤 🎉 🎊 🎁 🧸 💐'
  };

  function recentEmojis() {
    try { return JSON.parse(localStorage.getItem(recentEmojiStorageKey) || '[]').filter((value) => typeof value === 'string').slice(0, 12); }
    catch { return []; }
  }

  function renderKeyboardEmoji() {
    if (!customKeyboardEmojiGrid) return;
    customKeyboardEmojiGrid.replaceChildren();
    let emojis = keyboardEmojiCategory === 'recent' ? recentEmojis() : (keyboardEmojiCategories[keyboardEmojiCategory] || '').split(' ');
    if (!emojis.length) emojis = ['❤️','💕','💗','💖','💘','😘','🥰','😍','😂','🥺','😴','🌙'];
    emojis.forEach((emoji) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'kb-emoji'; button.textContent = emoji;
      button.dataset.kbKey = 'emoji:' + emoji;
      customKeyboardEmojiGrid.appendChild(button);
    });
    customKeyboardEmojiTabs?.querySelectorAll('[data-emoji-category]').forEach((button) => {
      button.classList.toggle('active', button.dataset.emojiCategory === keyboardEmojiCategory);
    });
  }

  function insertEmoji(emoji) {
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    messageInput.setRangeText(emoji, start, end, 'end');
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    try {
      const recent = [emoji, ...recentEmojis().filter((item) => item !== emoji)].slice(0, 12);
      localStorage.setItem(recentEmojiStorageKey, JSON.stringify(recent));
    } catch {}
    if (keyboardEmojiCategory === 'recent') renderKeyboardEmoji();
  }

  function setKeyboardTab(tab) {
    keyboardTab = tab;
    customKeyboard.classList.toggle('emoji-mode', tab === 'emoji');
    if (customKeyboardLetters) customKeyboardLetters.style.display = tab === 'letters' ? '' : 'none';
    if (customKeyboardSymbols) customKeyboardSymbols.hidden = tab !== 'symbols';
    if (customKeyboardEmojiPicker) customKeyboardEmojiPicker.hidden = tab !== 'emoji';
    const symbolsButton = customKeyboard.querySelector('.kb-bottom-row [data-kb-key="symbols"]');
    if (symbolsButton) symbolsButton.textContent = tab === 'symbols' ? 'ABC' : '123';
    if (tab === 'emoji') renderKeyboardEmoji();
    scheduleKeyboardCoordinateCache();
  }

  function handleKeyboardKey(key) {
    if (key === 'shift') {
      if (keyboardCapsLock) { keyboardCapsLock = false; keyboardShift = false; }
      else if (keyboardShift) { keyboardCapsLock = true; keyboardShift = false; }
      else keyboardShift = true;
      updateKeyboardCase();
      return;
    }
    if (key === 'backspace') { eraseComposerCharacter(); return; }
    if (key === 'symbols') { setKeyboardTab(keyboardTab === 'symbols' ? 'letters' : 'symbols'); return; }
    if (key === 'moreSymbols') {
      alternateSymbols = !alternateSymbols;
      const symbolRows = customKeyboardSymbols?.querySelectorAll('.kb-key-row');
      const row = symbolRows?.[1];
      const values = alternateSymbols ? ['\\','[',']','{','}','%','^','*','+','='] : ['-','/',':',';','(',')','₫','&','@','"'];
      row?.querySelectorAll('[data-kb-key]').forEach((button, index) => {
        button.dataset.kbKey = values[index]; button.textContent = values[index];
      });
      return;
    }
    if (key === 'letters') { setKeyboardTab('letters'); return; }
    if (key === 'language') return;
    if (key === 'emoji') {
      if (keyboardTab === 'emoji') setKeyboardTab(keyboardPreviousTab);
      else { keyboardPreviousTab = keyboardTab; setKeyboardTab('emoji'); }
      return;
    }
    if (key === 'globe') { useNativeKeyboard(); return; }
    if (key === 'newline') { insertComposerText('\n', false); return; }
    if (key === 'space') { insertComposerText(' ', false); return; }
    if (key.startsWith('emoji:')) { insertEmoji(key.slice(6)); return; }
    insertComposerText(key, keyboardTab === 'letters');
  }

  function updateKeyboardCase() {
    document.querySelectorAll('#kb [data-kb-key]').forEach((button) => {
      const value = button.dataset.kbKey;
      if (/^[a-z]$/.test(value)) button.textContent = (keyboardShift || keyboardCapsLock) ? value.toUpperCase() : value;
    });
    const shiftKey = customKeyboard.querySelector('[data-kb-key="shift"]');
    shiftKey?.classList.toggle('shift-on', keyboardShift || keyboardCapsLock);
    shiftKey?.classList.toggle('caps-lock', keyboardCapsLock);
  }

  function clearDeleteRepeat() {
    clearTimeout(deleteRepeatTimer);
    clearTimeout(deleteRepeatStart);
    deleteRepeatTimer = null;
    deleteRepeatStart = null;
  }

  function startDeleteRepeat() {
    clearDeleteRepeat();
    eraseComposerCharacter();
    deleteRepeatStart = setTimeout(function repeatDelete() {
      eraseComposerCharacter();
      deleteRepeatTimer = setTimeout(repeatDelete, 60);
    }, 400);
  }

  function cacheKeyboardKeyCoordinates() {
    if (!customKeyboard) return;
    const keyboardRect = customKeyboard.getBoundingClientRect();
    const nextCoordinates = new Map();
    const nextPositions = new Map();
    customKeyboard.querySelectorAll('.kb-key-row').forEach((row) => {
      const keys = [];
      row.querySelectorAll('[data-kb-key]').forEach((button) => {
        const rect = button.getBoundingClientRect();
        const position = {
          button,
          centerX: rect.left + rect.width / 2,
          popoverLeft: rect.left + rect.width / 2 - keyboardRect.left,
          popoverTop: Math.max(8, rect.top - keyboardRect.top - 56)
        };
        keys.push(position);
        nextPositions.set(button, position);
      });
      nextCoordinates.set(row, keys);
    });
    keyboardKeyCoordinates = nextCoordinates;
    keyboardKeyPositions = nextPositions;
  }

  function scheduleKeyboardCoordinateCache() {
    if (keyboardCoordinateFrame !== null) cancelAnimationFrame(keyboardCoordinateFrame);
    keyboardCoordinateFrame = requestAnimationFrame(() => {
      keyboardCoordinateFrame = null;
      cacheKeyboardKeyCoordinates();
    });
  }

  function nearestKeyboardKey(row, clientX) {
    const keys = keyboardKeyCoordinates.get(row) || [];
    if (!keys.length) return null;
    let nearest = keys[0];
    let distance = Math.abs(clientX - nearest.centerX);
    for (let i = 1; i < keys.length; i++) {
      const nextDistance = Math.abs(clientX - keys[i].centerX);
      if (nextDistance < distance) { nearest = keys[i]; distance = nextDistance; }
    }
    return nearest.button;
  }

  function showKeyboardPopover(keyButton) {
    if (!customKeyboardPopover || !/^[a-z]$/i.test(keyButton.dataset.kbKey || '')) return;
    const position = keyboardKeyPositions.get(keyButton);
    if (!position) return;
    customKeyboardPopover.textContent = keyButton.textContent.trim();
    customKeyboardPopover.style.setProperty('--kb-pop-x', `${position.popoverLeft}px`);
    customKeyboardPopover.style.setProperty('--kb-pop-y', `${position.popoverTop}px`);
    customKeyboardPopover.classList.add('visible');
  }

  function handleKeyboardPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    let keyButton = event.target.closest?.('[data-kb-key]');
    if (!keyButton) {
      const row = event.target.closest?.('.kb-key-row');
      if (row) keyButton = nearestKeyboardKey(row, event.clientX);
    }
    if (!keyButton) return;
    try { keyButton.setPointerCapture(event.pointerId); } catch {}
    keyButton.classList.add('pressed');
    const key = keyButton.dataset.kbKey;
    if (key === 'emoji') {
      pendingEmojiKey = keyButton;
      emojiHoldFired = false;
      clearTimeout(emojiHoldTimer);
      emojiHoldTimer = setTimeout(() => {
        emojiHoldFired = true;
        pendingEmojiKey = null;
        useNativeKeyboard();
      }, 500);
      return;
    }
    if (key === 'language') {
      langPointerDown = { pointerId: event.pointerId, button: keyButton, x: event.clientX, y: event.clientY, moved: false };
      return;
    }
    if (key === 'backspace') startDeleteRepeat();
    else handleKeyboardKey(key);
    showKeyboardPopover(keyButton);
  }

  customKeyboard.addEventListener('pointerdown', handleKeyboardPointerDown);
  customKeyboard.addEventListener('pointermove', (event) => {
    if (!langPointerDown || event.pointerId !== langPointerDown.pointerId) return;
    if (Math.hypot(event.clientX - langPointerDown.x, event.clientY - langPointerDown.y) > 10) langPointerDown.moved = true;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => customKeyboard.addEventListener(type, (event) => {
    completeKeyboardLanguagePointer(type, event);
    if (pendingEmojiKey) {
      clearTimeout(emojiHoldTimer);
      if (type === 'pointerup' && !emojiHoldFired) handleKeyboardKey('emoji');
      pendingEmojiKey = null;
    }
    const pressed = customKeyboard.querySelector('.pressed');
    pressed?.classList.remove('pressed');
    customKeyboardPopover?.classList.remove('visible');
    if (pressed?.dataset.kbKey === 'backspace') clearDeleteRepeat();
  }));

  customKeyboardEmojiTabs?.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('[data-emoji-category]');
    if (!button) return;
    event.preventDefault();
    keyboardEmojiCategory = button.dataset.emojiCategory;
    renderKeyboardEmoji();
  });

  customKeyboardHide?.addEventListener('pointerdown', (event) => { event.preventDefault(); closePinkKeyboard(); });
  customKeyboardToggle?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    closeFuncPanel();
    if (nativeKeyboardMode) usePinkKeyboard(); else useNativeKeyboard();
  });
  document.addEventListener('pointerdown', (event) => {
    const keepPinkKeyboard = event.target.closest?.('#kb, .chat-input-bar, #cover-menu, #attach-menu, #sticker-panel, #reply-bar');
    if (pinkKeyboardOpen && !keepPinkKeyboard) closePinkKeyboard();
    if (nativeKeyboardMode && !event.target.closest?.('.chat-input-bar')) {
      messageInput.blur();
    }
  }, true);

  function scrollMessagesAfterKeyboard() {
    // Mọi lệnh cuộn đáy đều đi qua scrollToBottom(reason) — ở đây reason='keyboard'
    // nên CHỈ cuộn khi stickBottom=true (giữ nguyên vị trí đọc khi không ở đáy).
    scrollToBottom('keyboard');
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('keyboard')));
    clearTimeout(keyboardBottomTimer);
    keyboardBottomTimer = setTimeout(() => scrollToBottom('keyboard'), 350);
  }

  // Debounce viewport: 1 RAF/khung hình, chỉ áp dụng khi bắt đầu trượt (1 lần)
  // và khi ổn định 120ms (1 lần trailing); bỏ qua thay đổi < 2px.
  window.__fitStats = { runs: 0, vvhChanges: 0 };
  let viewportSettleTimer = null;
  let viewportAnimating = false;

  function applyViewportMetrics(force) {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const height = Math.round(viewport.height);
    const top = Math.round(viewport.offsetTop);
    const rootStyle = document.documentElement.style;
    window.__fitStats.runs++;
    if (force || lastViewportHeight === null || Math.abs(height - lastViewportHeight) >= 2) {
      if (height !== lastViewportHeight) {
        rootStyle.setProperty('--vvh', `${height}px`);
        lastViewportHeight = height;
        window.__fitStats.vvhChanges++;
      }
    }
    // #app đặt theo top = offsetTop (không transform); offsetTop=0 → top:0.
    rootStyle.setProperty('--vvt', top > 0 ? `${top}px` : '0px');
    lastViewportTop = top;
    // Chặn iOS cuộn trang: chỉ scrollTo khi thật sự lệch, bọc trong rAF.
    if (window.pageYOffset !== 0 || document.documentElement.scrollTop !== 0) {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
    const keyboardOpen = window.innerHeight - height > 120;
    if (document.body.classList.contains('kb') !== keyboardOpen) {
      document.body.classList.toggle('kb', keyboardOpen);
    }
  }

  function settleViewport() {
    viewportAnimating = false;
    if (!pinkKeyboardOpen) applyViewportMetrics(true);
    // Cuộn #list đúng 1 lần sau khi chiều cao ổn định, không smooth (chỉ khi stickBottom).
    scrollToBottom('viewport');
    inputFocusPending = false;
  }

  function fitViewport() {
    if (pinkKeyboardOpen) {
      document.documentElement.style.setProperty('--vvh', '100dvh');
      document.documentElement.style.setProperty('--vvt', '0px');
      document.body.classList.remove('kb');
      return;
    }
    if (!window.visualViewport) return;
    if (fitViewportFrame !== null) return; // đã có 1 RAF đang chờ
    fitViewportFrame = window.requestAnimationFrame(() => {
      fitViewportFrame = null;
      if (pinkKeyboardOpen) return;
      // Lúc đang trượt: KHÔNG đổi --vvh/--vvt theo từng bước, chỉ giữ timer.
      if (viewportAnimating) {
        clearTimeout(viewportSettleTimer);
        viewportSettleTimer = window.setTimeout(settleViewport, 120);
        return;
      }
      applyViewportMetrics(true);
      viewportAnimating = true;
      clearTimeout(viewportSettleTimer);
      viewportSettleTimer = window.setTimeout(settleViewport, 120);
    });
  }

  function scheduleFitViewport() {
    fitViewport();
  }

  messageInput.addEventListener('focusin', () => {
    if (!nativeKeyboardMode) openPinkKeyboard();
  });
  messageInput.addEventListener('pointerdown', () => {
    if (!nativeKeyboardMode && !pinkKeyboardOpen) openPinkKeyboard();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitViewport);
    window.visualViewport.addEventListener('scroll', fitViewport); // iOS cuộn trang khi mở bàn phím
    window.addEventListener('orientationchange', () => window.setTimeout(fitViewport, 300));
    messageInput.addEventListener('focusin', () => {
      if (!nativeKeyboardMode) return;
      inputFocusPending = true;
      scheduleFitViewport();
      setTimeout(() => { inputFocusPending = false; }, 800);
    });
    messageInput.addEventListener('focusout', () => {
      if (!nativeKeyboardMode) return;
      inputFocusPending = false;
      scheduleFitViewport();
    });
    fitViewport();
  }

  function keepMessageInputFocused() {
    try { messageInput.focus({ preventScroll: true }); }
    catch { messageInput.focus(); }
    fitViewport();
  }

  const touchMoveGuard = (event) => {
    const target = event.target;
    if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (target.closest?.('button, label, a, [role="button"], #cover-menu')) return;
    const scrollArea = target.closest?.('.sticker-panel, .attach-menu, .cover-menu');
    if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight) return;
    event.preventDefault();
  };
  document.querySelector('.chat-header')?.addEventListener('touchmove', touchMoveGuard, { passive: false });
  document.querySelector('.chat-input-bar')?.addEventListener('touchmove', touchMoveGuard, { passive: false });

  const preventZoomGesture = (event) => event.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
    document.addEventListener(type, preventZoomGesture, { passive: false });
  });
  let lastTouchEndAt = 0;
  document.addEventListener('touchend', (event) => {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (target?.closest?.('#kb')) { lastTouchEndAt = 0; return; }
    if (target?.closest?.('button, label, input, textarea, select, a, [role="button"], #cover-menu')) {
      lastTouchEndAt = 0;
      return;
    }
    const now = Date.now();
    if (lastTouchEndAt && now - lastTouchEndAt < 300) event.preventDefault();
    lastTouchEndAt = now;
  }, { passive: false });

  let currentUser = null;
  let currentProfile = null;
  let realtimeChannel = null;
  let typingChannel = null;
  let coverChannel = null;
  // Mô hình crop duy nhất: s (coverCropScale) = px màn hình/1px ảnh; tx, ty = toạ độ
  // góc trên-trái ảnh so với góc trên-trái khung (px màn hình); khung có kích thước
  // coverCropFrameSize lưu 1 lần khi mở (chỉ tính lại khi resize/orientation).
  let coverCropBitmap = null;                 // nguồn ảnh (ImageBitmap đã đúng chiều EXIF, hoặc canvas sau khi Xoay)
  let coverCropFrameSize = { width: 0, height: 0 };
  let coverCropFramePos = { x: 0, y: 0 };     // khung trong stage (px CSS)
  let coverCropScale = 1;                     // s
  let coverCropMinScale = 1;
  let coverCropMaxScale = 1;
  let coverCropTx = 0;
  let coverCropTy = 0;
  let coverCropRotation = 0;                  // chỉ để hiển thị/đổi nguồn khi bấm Xoay
  let coverCropPointers = new Map();
  let coverCropGesture = null;
  let coverCropTarget = 'cover';              // 'cover' (tỉ lệ khung, ≤1280px) | 'avatar' (vòng tròn D, xuất vuông 512px)
  let typingTimer = null;
  let lastTypingSent = 0;
  let peerPingTimer = null;      // gửi "ping" 60s để người kia biết mình còn hoạt động
  let peerStatusTicker = null;   // làm mới dòng trạng thái ở header 30s
  let peerLastActive = 0;        // ms epoch lần cuối thấy người kia hoạt động (có ping/tin/nhập)
  const messageIds = new Set();
  const signedUrlCache = new Map();
  let avatarBlobUrl = null; // blob URL ảnh hồ sơ vừa cắt (hiện ngay khi bấm Xong, trước khi upload xong)
  const coverUrlCache = new Map();
  const profilesMap = new Map();
  const messageCache = new Map();
  // reactions: message_id (string) -> Map(user_id -> emoji)
  const reactions = new Map();
  const CACHE_REACTIONS_KEY = 'dinhichat_reactions_v1';
  const REACTION_EMOJIS = ['❤️', '😂', '😮', '🥺', '😡', '👍'];
  let stickerItems = [];
  let ensurePushPromise = null;
  let activeReply = null;
  let activeReplyRow = null;
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
    coverElement.style.setProperty('--chat-cover-image', `url("${url}")`);
    coverElement.classList.add('has-cover');
    messagesContainer.classList.add('has-cover');
  }

  async function applyCoverPath(path, forceRefresh = false) {
    if (!path) {
      coverElement.classList.remove('has-cover');
      coverElement.style.removeProperty('--chat-cover-image');
      messagesContainer.classList.remove('has-cover');
      try {
        localStorage.removeItem(COVER_PATH_KEY);
        localStorage.removeItem(COVER_URL_KEY);
      } catch {}
      coverUrlCache.clear();
      return;
    }

    lsSet(COVER_PATH_KEY, path);
    coverElement.classList.add('has-cover');
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
        coverElement.classList.add('has-cover');
        messagesContainer.classList.add('has-cover');
      }
    }
    await refreshCoverFromServer();
    refreshBannerFromServer();
  }

  function subscribeCoverSettings() {
    if (coverChannel) supabase.removeChannel(coverChannel);
    coverChannel = supabase.channel('chat-settings-cover')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_settings', filter: 'id=eq.1'
      }, (payload) => {
        applyCoverPath(payload.new?.cover_path || null, true);
        // Banner: người kia sửa → máy này cập nhật ngay (payload.new đầy đủ cột)
        if (payload.new && ('banner_text' in payload.new || 'banner_enabled' in payload.new)) {
          applyBannerRow(payload.new, true);
        }
      })
      .subscribe();
  }

  // Clamp: tx ∈ [khungW - ảnhW*s, 0], ty tương tự (ảnh luôn phủ kín khung).
  function clampCoverCropPosition() {
    if (!coverCropBitmap) return;
    const renderedWidth = coverCropBitmap.width * coverCropScale;
    const renderedHeight = coverCropBitmap.height * coverCropScale;
    coverCropTx = Math.max(Math.min(0, coverCropFrameSize.width - renderedWidth), Math.min(0, coverCropTx));
    coverCropTy = Math.max(Math.min(0, coverCropFrameSize.height - renderedHeight), Math.min(0, coverCropTy));
  }

  function renderCoverCrop() {
    if (!coverCropBitmap || !coverCropFrameSize.width) return;
    clampCoverCropPosition();
    // Ảnh = bmp vẽ ở (tx, ty) với kích thước bmp.width*s; transform-origin 0 0.
    coverCropImage.style.left = `${coverCropFramePos.x}px`;
    coverCropImage.style.top = `${coverCropFramePos.y}px`;
    coverCropImage.style.transform = `translate(${coverCropTx}px, ${coverCropTy}px) scale(${coverCropScale})`;
    const zoom = coverCropMinScale > 0 ? coverCropScale / coverCropMinScale : 1;
    coverCropZoom.value = String(Math.max(1, Math.min(6, zoom)));
    coverCropZoomLabel.textContent = `${zoom.toFixed(1)}×`;
  }

  // Đặt khung crop (kích thước cố định trong phiên) + tính lại s/tx/ty.
  // reset=true: đặt lại về fit-center (mở ảnh mới / bấm Xoay).
  function layoutCoverCrop(reset = false) {
    if (!coverCropStage || !coverCropStage.clientWidth || !coverCropStage.clientHeight) return;
    const stageWidth = coverCropStage.clientWidth;
    const stageHeight = coverCropStage.clientHeight;
    let frameWidth;
    let frameHeight;
    if (coverCropTarget === 'avatar') {
      // Vòng tròn D = min(innerWidth - 48, 320) px, không vượt khung nhìn thấy
      const d = Math.max(120, Math.min(window.innerWidth - 48, 320, stageWidth - 8, stageHeight - 8));
      frameWidth = d;
      frameHeight = d;
    } else {
      const coverRect = coverElement.getBoundingClientRect();
      const ratio = coverRect.width / Math.max(1, coverRect.height);
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const maxHeight = Math.min(stageHeight, viewportHeight * 0.8);
      const maxWidth = Math.max(1, stageWidth - 24);
      frameHeight = Math.min(maxHeight, maxWidth / ratio);
      frameWidth = frameHeight * ratio;
    }
    const oldWidth = coverCropFrameSize.width;
    const oldHeight = coverCropFrameSize.height;
    const oldCenterX = oldWidth ? (-coverCropTx + oldWidth / 2) / coverCropScale : 0;
    const oldCenterY = oldHeight ? (-coverCropTy + oldHeight / 2) / coverCropScale : 0;
    coverCropFrameSize = { width: frameWidth, height: frameHeight };
    coverCropFramePos = {
      x: Math.round((stageWidth - frameWidth) / 2),
      y: Math.round((stageHeight - frameHeight) / 2)
    };
    coverCropFrame.style.width = `${frameWidth}px`;
    coverCropFrame.style.height = `${frameHeight}px`;
    coverCropFrame.style.left = `${coverCropFramePos.x}px`;
    coverCropFrame.style.top = `${coverCropFramePos.y}px`;
    if (!coverCropBitmap) return;
    // s tối thiểu = phủ kín khung; tối đa = 6×.
    coverCropMinScale = Math.max(frameWidth / coverCropBitmap.width, frameHeight / coverCropBitmap.height);
    coverCropMaxScale = coverCropMinScale * 6;
    if (reset || !oldWidth || !oldHeight) {
      coverCropScale = coverCropMinScale;
      coverCropTx = (frameWidth - coverCropBitmap.width * coverCropScale) / 2;
      coverCropTy = (frameHeight - coverCropBitmap.height * coverCropScale) / 2;
    } else {
      // Giữ vùng đang xem ở giữa khung sau khi resize/orientation.
      coverCropScale = Math.max(coverCropMinScale, Math.min(coverCropMaxScale, coverCropScale));
      coverCropTx = frameWidth / 2 - oldCenterX * coverCropScale;
      coverCropTy = frameHeight / 2 - oldCenterY * coverCropScale;
    }
    renderCoverCrop();
  }

  async function openCoverCrop(file, target = 'cover') {
    try {
      if (!file) return;
      if (!coverCropOverlay || !coverCropStage || !coverCropImage || !coverCropFrame) {
        throw new Error('Không tìm thấy màn hình cắt ảnh.');
      }
      closeCoverCrop();
      coverCropTarget = target === 'avatar' ? 'avatar' : 'cover';
      coverCropRotation = 0;
      coverCropBitmap = await decodeOrientedBitmap(file);
      // Xem trước vẽ chính bmp lên canvas (cùng nguồn với xuất ảnh → không bao giờ lệch).
      coverCropImage.width = coverCropBitmap.width;
      coverCropImage.height = coverCropBitmap.height;
      coverCropImage.getContext('2d').drawImage(coverCropBitmap, 0, 0);
      coverCropFrame.classList.toggle('is-round', coverCropTarget === 'avatar');
      coverCropOverlay.classList.add('open');
      coverCropOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('cover-crop-open');
      // Đảm bảo nút trạng thái sạch khi mở lại (lần trước lưu xong thì overlay đóng khi còn disable).
      if (coverCropDone) { coverCropDone.disabled = false; coverCropDone.textContent = 'Xong'; }
      if (coverCropCancel) coverCropCancel.disabled = false;
      if (coverCropRotate) coverCropRotate.disabled = false;
      if (coverCropZoom) coverCropZoom.disabled = false;
      layoutCoverCrop(true);
    } catch (error) {
      closeCoverCrop();
      console.error(error?.message || String(error));
      showCoverToast('Không mở được ảnh: ' + (error?.message || String(error)));
    }
  }

  function closeCoverCrop() {
    if (coverCropOverlay) {
      coverCropOverlay.classList.remove('open');
      coverCropOverlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('cover-crop-open');
    coverCropPointers.clear();
    coverCropGesture = null;
    if (coverCropImage) { coverCropImage.width = 0; coverCropImage.height = 0; }
    if (coverCropBitmap) coverCropBitmap.close?.();
    coverCropBitmap = null;
    coverCropFrameSize = { width: 0, height: 0 };
    coverCropFramePos = { x: 0, y: 0 };
    coverCropScale = 1;
    coverCropMinScale = 1;
    coverCropMaxScale = 1;
    coverCropTx = 0;
    coverCropTy = 0;
  }

  function coverCropPoint(event) {
    const rect = coverCropStage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function coverCropDistance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  // Bắt đầu thao tác: neo theo điểm giữa hai ngón hoặc theo ngón đang kéo.
  function startCoverCropGesture() {
    const points = [...coverCropPointers.values()];
    if (points.length >= 2) {
      coverCropGesture = {
        type: 'pinch',
        distance: Math.max(1, coverCropDistance(points[0], points[1])),
        midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        scale: coverCropScale,
        tx: coverCropTx,
        ty: coverCropTy
      };
    } else if (points.length === 1) {
      coverCropGesture = {
        type: 'drag', point: points[0], tx: coverCropTx, ty: coverCropTy
      };
    } else coverCropGesture = null;
  }

  // Zoom 2 ngón: giữ nguyên điểm dưới tâm tiếp xúc (tx' = cx - (cx - tx)*(s'/s)).
  function moveCoverCropPointer(event) {
    if (!coverCropPointers.has(event.pointerId)) return;
    coverCropPointers.set(event.pointerId, coverCropPoint(event));
    const points = [...coverCropPointers.values()];
    if (points.length >= 2 && coverCropGesture?.type === 'pinch') {
      const gesture = coverCropGesture;
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = coverCropDistance(points[0], points[1]);
      const anchorX = gesture.midpoint.x - coverCropFramePos.x;
      const anchorY = gesture.midpoint.y - coverCropFramePos.y;
      const nextScale = Math.max(coverCropMinScale, Math.min(coverCropMaxScale,
        gesture.scale * distance / gesture.distance));
      const factor = nextScale / gesture.scale;
      coverCropScale = nextScale;
      coverCropTx = anchorX - (anchorX - gesture.tx) * factor + (midpoint.x - gesture.midpoint.x);
      coverCropTy = anchorY - (anchorY - gesture.ty) * factor + (midpoint.y - gesture.midpoint.y);
    } else if (points.length === 1 && coverCropGesture?.type === 'drag') {
      const gesture = coverCropGesture;
      coverCropTx = gesture.tx + (points[0].x - gesture.point.x);
      coverCropTy = gesture.ty + (points[0].y - gesture.point.y);
    }
    renderCoverCrop();
  }

  // Zoom bằng thanh trượt: neo giữa khung (cx = khungW/2, cy = khungH/2).
  function zoomCoverCropTo(nextScale, anchorX, anchorY) {
    if (!coverCropBitmap || !coverCropScale) return;
    const scale = Math.max(coverCropMinScale, Math.min(coverCropMaxScale, nextScale));
    const factor = scale / coverCropScale;
    coverCropScale = scale;
    coverCropTx = anchorX - (anchorX - coverCropTx) * factor;
    coverCropTy = anchorY - (anchorY - coverCropTy) * factor;
    renderCoverCrop();
  }

  async function exportCoverCrop() {
    if (!coverCropBitmap || !coverCropFrameSize.width || !coverCropFrameSize.height) {
      throw new Error('Ảnh chưa sẵn sàng để cắt.');
    }
    const ratio = coverCropFrameSize.width / coverCropFrameSize.height;
    const maxSide = coverCropTarget === 'avatar' ? 512 : 1280;
    const canvas = document.createElement('canvas');
    canvas.width = ratio >= 1 ? maxSide : Math.max(1, Math.round(maxSide * ratio));
    canvas.height = ratio >= 1 ? Math.max(1, Math.round(maxSide / ratio)) : maxSide;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không tạo được canvas.');
    // Vùng cắt theo toạ độ ảnh gốc: sx = -tx/s, sy = -ty/s, sw = khungW/s.
    const sx = -coverCropTx / coverCropScale;
    const sy = -coverCropTy / coverCropScale;
    const sw = coverCropFrameSize.width / coverCropScale;
    const sh = coverCropFrameSize.height / coverCropScale;
    context.imageSmoothingQuality = 'high';
    context.drawImage(coverCropBitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas không tạo được ảnh JPEG.'));
    }, 'image/jpeg', coverCropTarget === 'avatar' ? 0.9 : 0.85));
  }

  async function finishCoverCrop() {
    if (!coverCropBitmap || coverCropDone.disabled) return;
    coverCropDone.disabled = true;
    coverCropCancel.disabled = true;
    coverCropRotate.disabled = true;
    coverCropZoom.disabled = true;
    coverCropDone.textContent = 'Đang lưu…';
    try {
      const blob = await exportCoverCrop();
      const isAvatar = coverCropTarget === 'avatar';
      const ok = isAvatar ? await uploadAvatar(blob) : await uploadCover(blob);
      if (ok) closeCoverCrop();
    } catch (error) {
      console.error(error?.message || String(error));
      showCoverToast((coverCropTarget === 'avatar' ? 'Đổi ảnh hồ sơ thất bại: ' : 'Đổi ảnh bìa thất bại: ') + (error?.message || String(error)));
    } finally {
      if (coverCropOverlay.classList.contains('open')) {
        coverCropDone.disabled = false;
        coverCropCancel.disabled = false;
        coverCropRotate.disabled = false;
        coverCropZoom.disabled = false;
        coverCropDone.textContent = 'Xong';
      }
    }
  }

  async function uploadCover(blob) {
    let previewUrl = null;
    const previousCover = coverElement.style.getPropertyValue('--chat-cover-image');
    const previouslyHadCover = coverElement.classList.contains('has-cover');
    try {
      if (!currentUser || !blob) throw new Error('Chưa đăng nhập hoặc ảnh chưa sẵn sàng.');
      previewUrl = URL.createObjectURL(blob);
      applyCoverUrl(previewUrl);
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
      if (coverUrlCache.has(path)) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      coverMenu.classList.remove('open');
      return true;
    } catch (error) {
      console.error(error?.message || String(error));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (previouslyHadCover) {
        coverElement.style.setProperty('--chat-cover-image', previousCover);
        coverElement.classList.add('has-cover');
        messagesContainer.classList.add('has-cover');
      } else {
        coverElement.style.removeProperty('--chat-cover-image');
        coverElement.classList.remove('has-cover');
        messagesContainer.classList.remove('has-cover');
      }
      showCoverToast('Đổi ảnh bìa thất bại: ' + (error?.message || String(error)));
      return false;
    }
  }

  function showCoverToast(message) {
    document.querySelector('.cover-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'cover-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
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
      console.error(error?.message || String(error));
      showCoverToast('Xóa ảnh bìa thất bại: ' + (error?.message || String(error)));
    }
  }

  // ─── Profiles ────────────────────────────────────────────────────────────────
  async function loadProfiles() {
    const cached = lsGet(CACHE_PROFILES_KEY);
    if (cached && Array.isArray(cached)) {
      cached.forEach((p) => profilesMap.set(p.id, p));
    }
    // PHẢI có avatar_path: thiếu cột này → profilesMap không có avatar_path → mọi avatar chỉ hiện chữ cái
    const { data, error } = await supabase.from('profiles')
      .select('id, name, avatar_path, push_subscription, last_push_status, last_push_at');
    if (!error && data) {
      data.forEach((p) => profilesMap.set(p.id, { ...(profilesMap.get(p.id) || {}), ...p }));
      lsSet(CACHE_PROFILES_KEY, data);
      updatePeerPushNotice(data);
      renderHeaderPeer(); // có dữ liệu người kia → hiện tên/avatar ở header
      refreshAvatars();   // vẽ lại mọi ô avatar [data-uid] đang chờ
    }
  }

  // Cảnh báo người gửi: người kia không có subscription HOẶC lần push gần nhất không 'ok'.
  function updatePeerPushNotice(profiles) {
    if (!peerPushNotice || !currentUser) return;
    const list = Array.isArray(profiles) && profiles.length ? profiles : [...profilesMap.values()];
    const peer = list.find((profile) => profile.id && profile.id !== currentUser.id);
    if (!peer) { peerPushNotice.style.display = 'none'; return; }
    const noSubscription = peer.push_subscription === null || peer.push_subscription === undefined;
    const lastPushNotOk = peer.last_push_status !== 'ok';
    peerPushNotice.style.display = (noSubscription || lastPushNotOk) ? 'block' : 'none';
  }

  let peerStatusTimer = null;
  async function refreshPeerPushStatus() {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_path, push_subscription, last_push_status, last_push_at')
        .neq('id', currentUser.id)
        .limit(1);
      if (error || !data || !data.length) return;
      profilesMap.set(data[0].id, { ...(profilesMap.get(data[0].id) || {}), ...data[0] });
      updatePeerPushNotice([...profilesMap.values()]);
    } catch (err) {
      console.error('refreshPeerPushStatus error:', err);
    }
  }

  const remindSelect = document.getElementById('remind-select');
  const remindIcon = document.getElementById('remind-icon');
  const remindBadge = document.getElementById('remind-badge');
  const remindModes = ['none', '1', '2', 'loop'];
  const remindLabels = { none: 'Không nhắc', '1': 'Nhắc 1 lần', '2': 'Nhắc 2 lần', loop: 'Nhắc liên tục' };
  const remindIcons = { none: '🔕', '1': '🔔', '2': '🔔', loop: '🔁' };
  const remindStorageKey = 'dinhichat_remind_mode';
  if (remindSelect) {
    try {
      const savedMode = localStorage.getItem(remindStorageKey);
      remindSelect.value = remindModes.includes(savedMode) ? savedMode : 'none';
    } catch { remindSelect.value = 'none'; }
  }

  function renderRemindMode() {
    if (!remindSelect) return;
    const mode = remindModes.includes(remindSelect.value) ? remindSelect.value : 'none';
    remindSelect.value = mode;
    remindSelect.setAttribute('aria-label', remindLabels[mode]);
    remindSelect.title = remindLabels[mode];
    if (remindIcon) remindIcon.textContent = remindIcons[mode];
    if (remindBadge) {
      remindBadge.textContent = mode === '2' ? '2' : '';
      remindBadge.hidden = mode !== '2';
    }
    // Chấm nhỏ trên nút ➕ khi nhắc đang bật.
    document.getElementById('btn-attach')?.classList.toggle('has-remind', mode !== 'none');
  }

  function showRemindToast(mode) {
    document.querySelector('.remind-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'remind-toast';
    toast.textContent = remindLabels[mode];
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1000);
  }

  if (remindSelect) {
    renderRemindMode();
    remindSelect.addEventListener('click', () => {
      const currentIndex = remindModes.indexOf(remindSelect.value);
      const mode = remindModes[(currentIndex + 1) % remindModes.length];
      remindSelect.value = mode;
      renderRemindMode();
      try { localStorage.setItem(remindStorageKey, mode); } catch {}
      showRemindToast(mode);
    });
  }

  // Mirror textarea: đo số dòng ô nhập thật mà không ép layout ô nhập.
  const inputMirror = document.createElement('textarea');
  inputMirror.rows = 1;
  inputMirror.setAttribute('aria-hidden', 'true');
  inputMirror.setAttribute('readonly', '');
  inputMirror.tabIndex = -1;
  inputMirror.autocomplete = 'off';
  inputMirror.style.cssText = 'position:absolute;top:0;left:-9999px;visibility:hidden;pointer-events:none;resize:none;overflow:hidden;box-sizing:border-box;white-space:pre-wrap;word-wrap:break-word;';
  document.body.appendChild(inputMirror);
  let lastAppliedInputHeight = 0;
  let lastAppliedInputOverflow = 'hidden';

  function updateInputMirrorMetrics() {
    const rect = messageInput.getBoundingClientRect();
    const widthPx = Math.round(rect.width);
    const cs = window.getComputedStyle(messageInput);
    inputMirror.style.width = widthPx + 'px';
    inputMirror.style.fontSize = cs.fontSize;
    inputMirror.style.fontWeight = cs.fontWeight;
    inputMirror.style.fontFamily = cs.fontFamily;
    inputMirror.style.fontStyle = cs.fontStyle;
    inputMirror.style.lineHeight = cs.lineHeight;
    inputMirror.style.letterSpacing = cs.letterSpacing;
    inputMirror.style.paddingTop = cs.paddingTop;
    inputMirror.style.paddingRight = cs.paddingRight;
    inputMirror.style.paddingBottom = cs.paddingBottom;
    inputMirror.style.paddingLeft = cs.paddingLeft;
    inputMirror.style.borderTopWidth = cs.borderTopWidth;
    inputMirror.style.borderRightWidth = cs.borderRightWidth;
    inputMirror.style.borderBottomWidth = cs.borderBottomWidth;
    inputMirror.style.borderLeftWidth = cs.borderLeftWidth;
  }
  updateInputMirrorMetrics();
  if ('ResizeObserver' in window) new ResizeObserver(updateInputMirrorMetrics).observe(messageInput);
  window.addEventListener('resize', updateInputMirrorMetrics);
  window.addEventListener('orientationchange', () => setTimeout(updateInputMirrorMetrics, 300));

  function resizeMessageInput() {
    if (messageInput.tagName !== 'TEXTAREA') return;
    inputMirror.value = messageInput.value;
    const contentHeight = inputMirror.scrollHeight;
    const nextHeight = Math.max(40, Math.min(contentHeight, 120));
    const nextOverflow = contentHeight > 120 ? 'auto' : 'hidden';
    const roundedHeight = Math.round(nextHeight);
    // Chỉ ghi height thật khi số dòng đổi; không đặt 'auto', không cuộn #list vô cớ.
    if (roundedHeight === lastAppliedInputHeight && nextOverflow === lastAppliedInputOverflow) return;
    lastAppliedInputHeight = roundedHeight;
    lastAppliedInputOverflow = nextOverflow;
    messageInput.style.height = roundedHeight + 'px';
    messageInput.style.overflowY = nextOverflow;
    scrollToBottom('input');
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
    activeReplyRow = null;
    replyBar.style.display = 'none';
    replyBarText.textContent = '';
  }

  function showReplyPendingNotice() {
    const notice = document.createElement('div');
    notice.textContent = 'Tin đang gửi, đợi chút';
    Object.assign(notice.style, {
      position: 'fixed', left: '50%', bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
      transform: 'translateX(-50%)', zIndex: '10000', maxWidth: '90vw',
      padding: '8px 12px', borderRadius: '18px', background: '#333', color: '#fff',
      fontSize: '13px', textAlign: 'center', pointerEvents: 'none'
    });
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 1800);
  }

  function startReply(message, row = null) {
    if (!message || !message.id) return;
    if (String(row?.dataset.id ?? message.id).startsWith('tmp-')) {
      showReplyPendingNotice();
      return;
    }
    activeReply = message;
    activeReplyRow = row || document.getElementById('msg-' + message.id);
    replyBarText.textContent = '↩ ' + senderName(message) + ': ' + replySnippet(message);
    replyBar.style.display = 'flex';
    keepMessageInputFocused();
  }

  function resolveReplyId() {
    if (!activeReply) return null;
    const id = activeReplyRow?.dataset.id ?? activeReply.id;
    if (id == null || (typeof id === 'string' && (!id.trim() || id.startsWith('tmp-')))) return null;
    const numericId = Number(id);
    return Number.isInteger(numericId) ? numericId : null;
  }

  function addResolvedReplyTo(payload) {
    const replyToId = resolveReplyId();
    if (Number.isInteger(Number(replyToId)) && replyToId !== null) payload.reply_to = Number(replyToId);
    return payload;
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
    const listRect = messagesContainer.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const targetTop = messagesContainer.scrollTop + rowRect.top - listRect.top -
      (messagesContainer.clientHeight - rowRect.height) / 2;
    messagesContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
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
      if (activate && !row.classList.contains('revoked')) {
        try { navigator.vibrate?.(15); } catch {}
        startReply(message, row);
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
  function showNotifyButton() {
    if (!btnNotify) return;
    btnNotify.style.display = 'inline-flex';
    if (Notification.permission === 'granted') {
      btnNotify.onclick = () => checkNotificationStatus();
    } else {
      checkNotificationStatus(); // để hàm tự gắn handler đúng (xin quyền / hướng dẫn cài đặt)
    }
  }

  // Ghi đè subscription của chính mình: gọi khi mở app / visible / pageshow / 30 phút.
  async function ensurePush() {
    if (!currentUser) return false;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      showNotifyButton(); // quyền chưa granted → hiện lại nút 🔔
      return false;
    }
    if (navigator.standalone !== true) return false;
    if (ensurePushPromise) return ensurePushPromise;
    ensurePushPromise = (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(window.CONFIG.VAPID_PUBLIC_KEY)
        });
        if (!sub) {
          showNotifyButton();
          return false;
        }
        const { error } = await supabase.from('profiles')
          .update({ push_subscription: sub.toJSON() }).eq('id', currentUser.id);
        if (error) {
          console.error('Lỗi lưu subscription:', error);
          showNotifyButton();
          return false;
        }
        btnNotify.style.display = 'none';
        return true;
      } catch (err) {
        console.error('Lỗi đăng ký push:', err);
        showNotifyButton(); // subscribe lỗi → hiện lại nút 🔔
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

  // ─── Cuộn đáy: MỘT hàm duy nhất + cờ stickBottom ───────────────────────────
  function isAtBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 80;
  }

  function updateNewMsgButton() {
    if (!newMessagesButton) return;
    if (newMsgCount > 0 && !stickBottom) {
      newMessagesButton.textContent = '↓ Tin mới (' + newMsgCount + ')';
      newMessagesButton.classList.add('visible');
    } else {
      newMessagesButton.classList.remove('visible');
    }
  }

  // reason: 'mySend' | 'jumpDown' | 'init' → LUÔN cuộn xuống đáy.
  // Mọi reason khác ('auto','sync','newMsg','image','keyboard','viewport','resize','input')
  // CHỈ cuộn khi stickBottom=true (không kéo người dùng khỏi tin đang đọc).
  function scrollToBottom(reason = 'auto') {
    const forced = reason === 'mySend' || reason === 'jumpDown' || reason === 'init';
    if (!forced && !stickBottom) return false;
    if (!forced && Date.now() < jumpLockUntil) return false;
    if (viewingOldMessages && !forced) return false;
    const apply = (delayed) => {
      if (delayed && !forced && !stickBottom) return; // người dùng vừa cuộn lên → dừng ngay
      try { messagesContainer.scrollTop = messagesContainer.scrollHeight; } catch {}
    };
    apply(false);
    requestAnimationFrame(() => apply(true));
    clearTimeout(bottomSettleTimer);
    bottomSettleTimer = setTimeout(() => apply(true), 150);
    if (forced) { newMsgCount = 0; updateNewMsgButton(); }
    return true;
  }

  // Thoát "đang xem tin cũ": nạp lại 100 tin gần nhất rồi về đáy.
  function exitOldView() {
    if (!viewingOldMessages) return;
    viewingOldMessages = false;
    Promise.resolve(syncMessages())
      .then(() => { scrollToBottom('jumpDown'); })
      .catch(() => {});
  }

  // Tải thêm tin cũ khi cuộn lên đầu: chỉ khi scrollTop < 200, chống tải trùng;
  // insertMsgSorted bù scrollTop khi chèn lên trên (mục 5).
  async function maybeLoadOlder() {
    if (loadingOlder || noMoreOlder) return;
    if (messagesContainer.scrollTop >= 200) return;
    const bounds = chronoBounds();
    if (!bounds.first) return;
    loadingOlder = true;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .lt('created_at', bounds.first)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = [...(data || [])].reverse();
      if (!rows.length) noMoreOlder = true;
      for (const m of rows) {
        if (document.getElementById('msg-' + m.id)) continue;
        if (messageIds.has(m.id)) messageIds.delete(m.id);
        await addMsg(m, false, { sorted: true });
      }
      // Không thêm được gì → không hỏi lại (chống lặp truy vấn cũ).
      if (!rows.length || chronoBounds().first === bounds.first) noMoreOlder = true;
      if (rows.length) saveMsgsToCache();
    } catch (err) {
      console.error('maybeLoadOlder error:', err);
    } finally {
      loadingOlder = false;
    }
  }

  const markUserScrolling = () => { lastUserScrollAt = Date.now(); };
  messagesContainer.addEventListener('touchmove', markUserScrolling, { passive: true });
  messagesContainer.addEventListener('wheel', markUserScrolling, { passive: true });
  messagesContainer.addEventListener('scroll', () => {
    lastUserScrollAt = Date.now();
    // NƠI DUY NHẤT được cập nhật stickBottom.
    stickBottom = isAtBottom();
    if (stickBottom) {
      if (newMsgCount) { newMsgCount = 0; updateNewMsgButton(); }
      if (viewingOldMessages && Date.now() >= jumpLockUntil) exitOldView();
    }
    if (messagesContainer.scrollTop < 200) maybeLoadOlder();
  }, { passive: true });
  let lastMessagesHeightObserved = Math.round(messagesContainer.getBoundingClientRect().height);
  if ('ResizeObserver' in window) {
    const messagesResizeObserver = new ResizeObserver((entries) => {
      const height = Math.round(entries[0]?.contentRect?.height ?? 0);
      if (height === lastMessagesHeightObserved) return;
      lastMessagesHeightObserved = height;
      scrollToBottom('resize'); // trong hàm: chỉ cuộn khi stickBottom
    });
    messagesResizeObserver.observe(messagesContainer);
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
    const festiveDay = festiveOn && !festiveReducedMotion();
    const glyphs = festiveDay ? bannerEmojiList() : null;
    const count = festiveDay ? 4 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count && activeHeartCount < 8; i++) {
      const heart = document.createElement('span');
      heart.className = 'send-heart';
      heart.textContent = festiveDay ? glyphs[Math.floor(Math.random() * glyphs.length)] : (Math.random() < .5 ? '💗' : '💕');
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
    const oldId = row.dataset.id || row.id.replace(/^msg-/, '');
    if (oldId && String(oldId).startsWith('tmp-')) messageIds.delete(oldId);
    row.id = 'msg-' + serverMessage.id;
    row.dataset.id = String(serverMessage.id);
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
    if (activeReplyRow === row) activeReply = serverMessage;
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
    scrollToBottom('mySend');
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
      row.querySelector('.send-error-reason')?.remove();
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
        console.error(error?.message || String(error));
        row.classList.remove('is-sending');
        row.classList.add('send-error');
        row.style.opacity = '1';
        row.dataset.sendStatus = 'failed';
        const errorReason = document.createElement('div');
        errorReason.className = 'send-error-reason';
        errorReason.textContent = String(error?.message || error || 'Không gửi được tin nhắn').slice(0, 140);
        Object.assign(errorReason.style, { color: '#b00020', fontSize: '12px', overflowWrap: 'anywhere', margin: '4px' });
        (row.querySelector('.message-bubble, .msg-image-wrap') || row).appendChild(errorReason);
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'retry-send';
        retryButton.textContent = 'Thử lại';
        retryButton.addEventListener('click', send);
        (row.querySelector(':scope > .msg-col') || row).appendChild(retryButton);
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
      remind_mode: remindSelect ? remindSelect.value : 'none'
    };
    addResolvedReplyTo(payload);
    animateSendButton();
    await addOptimisticMessage(payload, async () => {
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }, { onSuccess: () => {
      clearReply();
      closeStickerPanel();
    } });
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
    const bitmap = await decodeOrientedBitmap(file);
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
    const seenCol = lastSelfRow.querySelector(':scope > .msg-col') || lastSelfRow;
    seenCol.appendChild(seenEl);
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

  // ─── Thu hồi tin nhắn ────────────────────────────────────────────────────────
  let revokeTarget = null;

  function renderRevokedRow(row) {
    row.classList.add('revoked');
    row.querySelectorAll('.sticker-sender, .reply-quote').forEach((el) => el.remove());
    const contentWrap = row.querySelector('.msg-content');
    if (contentWrap) {
      contentWrap.textContent = '';
      const t = document.createElement('span');
      t.className = 'revoked-text';
      t.textContent = '🚫 Tin nhắn đã thu hồi';
      contentWrap.appendChild(t);
    }
    // khung sticker (chứa nút huy hiệu) → gỡ, chỉ giữ placeholder
    const rx = row.querySelector('.rx-sticker-frame');
    if (rx) rx.remove();
  }

  // Cập nhật hàng tin thành "đã thu hồi" (optimistic + từ realtime/DB)
  function applyMsgRevoked(m) {
    if (!m || !m.id) return;
    const row = document.getElementById('msg-' + m.id);
    if (!row) return;
    try {
      const cur = JSON.parse(row.dataset.msg || '{}');
      cur.revoked = true;
      cur.revoked_at = m.revoked_at || cur.revoked_at || null;
      cur.content = null;
      row.dataset.msg = JSON.stringify(cur);
    } catch {}
    renderRevokedRow(row);
    saveMsgsToCache();
  }

  async function revokeMessage(row, message) {
    if (!currentUser || !message || String(message.id).startsWith('tmp-')) return;
    const nowIso = new Date().toISOString();
    applyMsgRevoked({ id: message.id, revoked: true, revoked_at: nowIso, content: null });
    try {
      const { error } = await supabase.from('messages')
        .update({ revoked: true, revoked_at: nowIso, content: null })
        .eq('id', message.id)
        .eq('sender_id', currentUser.id);
      if (error) throw error;
      try { navigator.vibrate?.(15); } catch {}
    } catch (err) {
      console.error('Thu hồi lỗi:', err);
      showAppToast('Thu hồi thất bại, thử lại');
    }
  }

  function openRevokeSheet(row, message) {
    revokeTarget = { row, message };
    document.getElementById('rev-backdrop')?.classList.add('open');
    document.getElementById('rev-sheet')?.classList.add('open');
  }

  function closeRevokeSheet() {
    revokeTarget = null;
    document.getElementById('rev-backdrop')?.classList.remove('open');
    document.getElementById('rev-sheet')?.classList.remove('open');
  }

  document.getElementById('rev-cancel')?.addEventListener('click', closeRevokeSheet);
  document.getElementById('rev-backdrop')?.addEventListener('click', closeRevokeSheet);
  document.getElementById('rev-confirm')?.addEventListener('click', () => {
    if (revokeTarget) revokeMessage(revokeTarget.row, revokeTarget.message);
    closeRevokeSheet();
  });

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
          notePeerActive();
          showTyping(senderId);
        }
      })
      .on('broadcast', { event: 'stop' }, (payload) => {
        const senderId = payload.payload?.user_id;
        if (currentUser && senderId && senderId !== currentUser.id) {
          hideTyping();
        }
      })
      .on('broadcast', { event: 'ping' }, (payload) => {
        const senderId = payload.payload?.user_id;
        if (currentUser && senderId && senderId !== currentUser.id) {
          notePeerActive(payload.payload?.ts);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeTyping, 1500);
        }
      });
    // Trạng thái người kia ở header: ping 60s + đếm lại mỗi 30s
    loadPeerActive();
    clearInterval(peerPingTimer);
    peerPingTimer = setInterval(sendPeerPing, 60000);
    clearInterval(peerStatusTicker);
    peerStatusTicker = setInterval(() => {
      if (document.visibilityState === 'visible') renderPeerStatus();
    }, 30000);
    sendPeerPing();
    renderPeerStatus();
  }

  // ─── Trạng thái người kia ở header (Trực tuyến / Hoạt động X phút trước) ─────
  const PEER_ACTIVE_KEY = 'dinhichat_peer_active_v1';

  function loadPeerActive() {
    try { peerLastActive = Number(localStorage.getItem(PEER_ACTIVE_KEY)) || 0; } catch { peerLastActive = 0; }
  }

  function notePeerActive(ts) {
    const t = Number(ts) || Date.now();
    if (t > peerLastActive) {
      peerLastActive = t;
      try { localStorage.setItem(PEER_ACTIVE_KEY, String(t)); } catch {}
    }
    renderPeerStatus();
  }

  function renderPeerStatus() {
    if (!userStatusEl) return;
    const mins = peerLastActive ? Math.max(0, Math.floor((Date.now() - peerLastActive) / 60000)) : -1;
    let text;
    if (mins >= 0 && mins < 3) text = 'Trực tuyến';
    else if (mins >= 60) text = `Hoạt động ${Math.floor(mins / 60)} giờ trước`;
    else if (mins >= 3) text = `Hoạt động ${mins} phút trước`;
    else text = 'Chưa hoạt động';
    userStatusEl.textContent = text;
    userStatusEl.classList.toggle('online', text === 'Trực tuyến');
  }

  function sendPeerPing() {
    if (!currentUser || document.visibilityState !== 'visible' || !typingChannel) return;
    typingChannel.send({
      type: 'broadcast',
      event: 'ping',
      payload: { user_id: currentUser.id, ts: Date.now() }
    });
  }

  function showTyping(senderId) {
    if (!typingIndicator) return;
    const name = profilesMap.get(senderId)?.name || 'Iu dấu';
    // textContent cho tên (an toàn XSS), 3 chấm nhảy bằng DOM riêng.
    typingIndicator.textContent = '💕 ' + name + ' đang nhập ';
    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
    typingIndicator.appendChild(dots);
    typingIndicator.classList.add('visible');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(hideTyping, 4000);
  }

  function hideTyping() {
    clearTimeout(typingTimer);
    if (!typingIndicator) return;
    typingIndicator.textContent = '';
    typingIndicator.classList.remove('visible');
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

  // ─── Avatar nhỏ cạnh tin + gộp nhóm 2 phút ─────────────────────────────────
  const MSG_GROUP_MS = 2 * 60 * 1000;

  function msgRowData(row) {
    try { return JSON.parse(row.dataset.msg || '{}'); } catch { return {}; }
  }

  // Avatar chỉ hiện ở tin CUỐI của nhóm (cùng người, cách nhau ≤2 phút);
  // các tin còn lại giữ chỗ 28px bằng visibility:hidden để bong bóng thẳng hàng.
  function refreshMsgAvatar(row) {
    if (!row || !row.classList || !row.classList.contains('message-row')) return;
    const slot = row.querySelector('.msg-avatar');
    if (!slot) return;
    const next = row.nextElementSibling;
    let show = true;
    if (next && next.classList && next.classList.contains('message-row') && !next.dataset.temp) {
      const a = msgRowData(row);
      const b = msgRowData(next);
      const ta = Date.parse(a.created_at || '') || 0;
      const tb = Date.parse(b.created_at || '') || 0;
      if (a.sender_id && a.sender_id === b.sender_id && ta && tb && Math.abs(tb - ta) <= MSG_GROUP_MS) show = false;
    }
    slot.style.visibility = show ? '' : 'hidden';
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
    row.dataset.id = String(message.id);
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

    const canReact = !isSelf && !String(message.id).startsWith('tmp-');

    if (message.revoked) {
      // Đã thu hồi: chỉ còn placeholder, không tải ảnh/sticker
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble revoked-bubble';
      const t = document.createElement('span');
      t.className = 'revoked-text';
      t.textContent = '🚫 Tin nhắn đã thu hồi';
      bubble.appendChild(t);
      row.appendChild(bubble);
    } else if (message.is_sticker) {
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
      if (canReact) {
        const frame = document.createElement('span');
        frame.className = 'rx-sticker-frame';
        frame.appendChild(img);
        frame.appendChild(createRxTriggerBtn(message.id, ''));
        row.appendChild(frame);
      } else {
        row.appendChild(img);
      }
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
            if (scroll) scrollToBottom('image');
          };
        }
      });
      img.addEventListener('click', () => {
        imgOverlayImg.src = img.src;
        imgOverlay.classList.add('open');
      });
      wrap.appendChild(img);
      let caption = null;
      if (message.content) {
        caption = document.createElement('div');
        caption.className = 'message-bubble';
        caption.style.marginTop = '4px';
        caption.textContent = message.content;
      }
      if (canReact) {
        row.appendChild(wrap);
        if (caption) {
          caption.appendChild(createRxTriggerBtn(message.id, message.content || ''));
          row.appendChild(caption);
        } else {
          wrap.appendChild(createRxTriggerBtn(message.id, message.content || ''));
        }
      } else {
        row.appendChild(wrap);
        if (caption) row.appendChild(caption);
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

      if (canReact) {
        bubble.appendChild(createRxTriggerBtn(message.id, message.content || ''));
      }
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

    // Cấu trúc hàng tin: .message-row > .msg-col > [tên sticker] + .msg-bubble-row [avatar28 + bong bóng] + giờ/đã xem
    const colTop = [];    // phía trên bong bóng (quote sticker, tên sticker)
    const middle = [];    // vào .msg-content (bong bóng / ảnh / sticker / caption)
    const colBottom = []; // giờ
    while (row.firstChild) {
      const el = row.removeChild(row.firstChild);
      if (!el.classList) continue;
      if (el.classList.contains('message-time')) colBottom.push(el);
      else if (el.classList.contains('sticker-sender') || el.classList.contains('reply-quote')) colTop.push(el);
      else middle.push(el);
    }
    const msgCol = document.createElement('div');
    msgCol.className = 'msg-col';
    colTop.forEach((el) => msgCol.appendChild(el));
    const bubbleRow = document.createElement('div');
    bubbleRow.className = 'msg-bubble-row';
    const contentWrap = document.createElement('div');
    contentWrap.className = 'msg-content';
    middle.forEach((el) => contentWrap.appendChild(el));
    const avatarSlot = document.createElement('span');
    avatarSlot.className = 'msg-avatar avatar-circle';
    avatarSlot.setAttribute('aria-hidden', 'true');
    renderAvatar(avatarSlot,
      (message.sender_id && profilesMap.get(message.sender_id)) || { id: message.sender_id, name: senderName(message) }, 28);
    // avatar cùng hàng với bong bóng, căn đáy bong bóng: người kia bên trái, mình bên phải
    if (isSelf) { bubbleRow.appendChild(contentWrap); bubbleRow.appendChild(avatarSlot); }
    else { bubbleRow.appendChild(avatarSlot); bubbleRow.appendChild(contentWrap); }
    msgCol.appendChild(bubbleRow);
    colBottom.forEach((el) => msgCol.appendChild(el));
    row.appendChild(msgCol);

    if (options.sorted && message.created_at) insertMsgSorted(row, message.created_at);
    else messagesContainer.appendChild(row);
    refreshMsgAvatar(row);
    refreshMsgAvatar(row.previousElementSibling);
    enableSwipeReply(row, message);
    setupRowGesture(row, message);
    if (canReact) renderReactionBadges(row);
    if (options.animate) animateMessage(row, isSelf);
    renderSeen();
    if (scroll) scrollToBottom('addMsg');
    return row;
  }

  // ─── Reactions ───────────────────────────────────────────────────────────────
  function addReactionToStore(messageId, userId, emoji) {
    const key = String(messageId);
    let m = reactions.get(key);
    if (!m) { m = new Map(); reactions.set(key, m); }
    m.set(userId, emoji);
  }

  function removeReactionFromStore(messageId, userId) {
    const m = reactions.get(String(messageId));
    if (m) m.delete(userId);
  }

  function saveReactionsToCache() {
    try {
      const arr = [];
      for (const [mid, m] of reactions) for (const [uid, emoji] of m) arr.push({ message_id: mid, user_id: uid, emoji });
      localStorage.setItem(CACHE_REACTIONS_KEY, JSON.stringify(arr.slice(-300)));
    } catch {}
  }

  function loadReactionsFromCache() {
    try {
      const arr = JSON.parse(localStorage.getItem(CACHE_REACTIONS_KEY) || '[]');
      if (!Array.isArray(arr)) return;
      for (const r of arr) {
        if (r && r.message_id && r.user_id && r.emoji) addReactionToStore(r.message_id, r.user_id, r.emoji);
      }
    } catch {}
  }

  function showAppToast(text, duration = 2000) {
    try {
      const toast = document.createElement('div');
      toast.className = 'app-toast';
      toast.textContent = text;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    } catch {}
  }

  function renderReactionBadges(row, popEmoji = null) {
    if (!row) return;
    row.querySelectorAll('.reaction-badge').forEach((b) => b.remove());
    const id = row.dataset.id || row.id.replace(/^msg-/, '');
    const m = reactions.get(String(id));
    row.classList.remove('has-reaction');
    const trigger = row.querySelector('.rx-trigger-btn');
    if (!m || !m.size) {
      if (trigger) trigger.style.display = '';
      return;
    }
    // Đã có cảm xúc: ẩn nút, hiện huy hiệu đúng chỗ đó; chạm huy hiệu mở lại thanh.
    if (trigger) trigger.style.display = 'none';
    // Huy hiệu gắn vào bong bóng (góc dưới phải), tối đa 2 emoji trong 1 viên thuốc.
    const anchor = row.querySelector('.message-bubble, .w .b, .msg-image-wrap, .rx-sticker-frame');
    if (!anchor) return;
    const emojis = [...m.values()].slice(0, 2);
    const badge = document.createElement('span');
    badge.className = 'reaction-badge' + (emojis.includes(popEmoji) ? ' pop' : '');
    for (const emoji of emojis) {
      const span = document.createElement('span');
      span.className = 'reaction-emoji';
      span.textContent = emoji;
      badge.appendChild(span);
    }
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const msg = messageCache.get(String(id));
      if (!msg || !currentUser || msg.sender_id === currentUser.id) return;
      openReactionBar(id, badge.getBoundingClientRect(), msg.content || '');
    });
    anchor.appendChild(badge);
    if (emojis.includes(popEmoji) && popEmoji === '❤️') flyHearts(row);
    row.classList.add('has-reaction');
  }

  function flyHearts(row) {
    if (!row || document.hidden) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const rowRect = row.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart-fly';
      heart.textContent = '💗';
      heart.style.left = `${12 + Math.round(Math.random() * Math.max(20, rowRect.width - 30))}px`;
      heart.style.top = `${Math.round(rowRect.height * 0.4)}px`;
      heart.style.animationDelay = `${i * 40}ms`;
      row.appendChild(heart);
      setTimeout(() => heart.remove(), 700 + i * 40);
    }
  }

  // ─── Nút thả cảm xúc kiểu Zalo: con của bong bóng, góc dưới-phải ───
  function createRxTriggerBtn(messageId, content) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rx-trigger-btn';
    btn.textContent = '🤍';
    btn.setAttribute('aria-label', 'Thả cảm xúc');
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openReactionBar(messageId, btn.getBoundingClientRect(), content);
    });
    return btn;
  }

  // ─── Thanh cảm xúc: #rxBackdrop và #rxBar gắn 1 lần vào #app ───
  const rxBackdrop = document.createElement('div');
  rxBackdrop.id = 'rxBackdrop';

  const rxBar = document.createElement('div');
  rxBar.id = 'rxBar';
  rxBar.setAttribute('role', 'toolbar');
  rxBar.setAttribute('aria-label', 'Thả cảm xúc');

  REACTION_EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rx-bar-btn';
    btn.textContent = emoji;
    rxBar.appendChild(btn);
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'rx-bar-btn rx-copy';
  copyBtn.textContent = '📋';
  copyBtn.setAttribute('aria-label', 'Sao chép nội dung tin');
  copyBtn.style.display = 'none';
  rxBar.appendChild(copyBtn);

  const appRoot = document.getElementById('app');
  appRoot?.appendChild(rxBackdrop);
  appRoot?.appendChild(rxBar);

  let rxMessageId = null;
  let rxContent = null;

  function openReactionBar(messageId, btnRect, content) {
    if (!currentUser || !messageId) return;
    if (String(messageId).startsWith('tmp-')) return;
    rxMessageId = String(messageId);
    rxContent = content || messageCache.get(rxMessageId)?.content || null;
    copyBtn.style.display = rxContent ? '' : 'none';

    rxBackdrop.classList.add('open');
    rxBar.classList.add('open');

    const barRect = rxBar.getBoundingClientRect();
    const barWidth = barRect.width || 310;
    const barHeight = barRect.height || 52;

    const header = document.querySelector('.chat-header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 50;
    const footer = document.querySelector('.chat-input-bar');
    const footerTop = footer ? footer.getBoundingClientRect().top : (window.innerHeight - 60);

    let left = btnRect.left + (btnRect.width / 2) - (barWidth / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - barWidth - 8));

    let top = btnRect.top - barHeight - 8;
    if (top < headerBottom + 6) {
      top = btnRect.bottom + 8;
    }
    top = Math.max(headerBottom + 6, Math.min(top, footerTop - barHeight - 6));

    rxBar.style.left = `${Math.round(left)}px`;
    rxBar.style.top = `${Math.round(top)}px`;
  }

  function closeReactionBar() {
    if (rxMessageId === null) return;
    rxBar.classList.remove('open');
    rxBackdrop.classList.remove('open');
    rxMessageId = null;
    rxContent = null;
  }

  // Chặn pointerdown/mousedown trong #rxBar để ô nhập không mất focus/caret
  rxBar.addEventListener('pointerdown', (event) => event.preventDefault());
  rxBar.addEventListener('mousedown', (event) => event.preventDefault());

  // Đóng khi chạm ra ngoài vào #rxBackdrop
  rxBackdrop.addEventListener('click', (event) => {
    event.preventDefault();
    closeReactionBar();
  });

  // Chọn cảm xúc / sao chép bằng sự kiện 'click' duy nhất
  rxBar.addEventListener('click', (event) => {
    const btn = event.target.closest?.('.rx-bar-btn');
    if (!btn || !rxMessageId) return;
    event.preventDefault();
    if (btn === copyBtn) {
      const done = () => showAppToast('Đã sao chép');
      const fail = () => showAppToast('Sao chép thất bại');
      try {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(rxContent || '').then(done, fail);
        else fail();
      } catch { fail(); }
    } else {
      pickReaction(rxMessageId, btn.textContent.trim());
    }
    closeReactionBar();
  });

  // Tin gốc bị gỡ khỏi DOM → đóng thanh
  new MutationObserver(() => {
    if (rxMessageId !== null && !document.getElementById('msg-' + rxMessageId)) {
      closeReactionBar();
    }
  }).observe(messagesContainer, { childList: true });

  async function pickReaction(messageId, emoji) {
    if (!currentUser || String(messageId).startsWith('tmp-')) return;
    const key = String(messageId);
    const row = document.getElementById('msg-' + messageId);
    const current = reactions.get(key)?.get(currentUser.id);
    const willDelete = current === emoji;
    // Optimistic: cập nhật UI ngay.
    if (willDelete) removeReactionFromStore(messageId, currentUser.id);
    else addReactionToStore(messageId, currentUser.id, emoji);
    renderReactionBadges(row, emoji);
    saveReactionsToCache();
    closeReactionBar();
    try {
      if (willDelete) {
        await supabase.from('reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUser.id);
      } else {
        const { error } = await supabase.from('reactions')
          .upsert({ message_id: messageId, user_id: currentUser.id, emoji }, { onConflict: 'message_id,user_id' });
        if (error) throw error;
      }
    } catch (err) {
      console.error('pickReaction error:', err);
      // Hoàn tác optimistic.
      if (willDelete) addReactionToStore(messageId, currentUser.id, current);
      else removeReactionFromStore(messageId, currentUser.id);
      renderReactionBadges(row);
      saveReactionsToCache();
      showAppToast('Thả cảm xúc thất bại');
    }
  }

  // Chạm đúp trên tin người khác → thả nhanh ❤️
  let lastTapRow = null;
  let lastTapAt = 0;
  let tapStartPos = null;

  function setupRowGesture(row, message) {
    let pressTimer = null;
    const canRevoke = () => currentUser && message.sender_id === currentUser.id &&
      !message.revoked && !row.classList.contains('revoked') &&
      !String(message.id).startsWith('tmp-');
    row.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest?.('a, button, img, .reply-quote, .reaction-badge, #rxBar, .rx-trigger-btn')) return;
      tapStartPos = { x: event.clientX, y: event.clientY };
      // Giữ lâu 500ms trên tin của mình → menu thu hồi
      clearTimeout(pressTimer);
      if (canRevoke()) {
        pressTimer = setTimeout(() => {
          if (!tapStartPos) return;
          tapStartPos = null;
          try { navigator.vibrate?.(20); } catch {}
          openRevokeSheet(row, message);
        }, 500);
      }
    }, { passive: true });

    row.addEventListener('pointermove', (event) => {
      if (!tapStartPos) return;
      if (Math.hypot(event.clientX - tapStartPos.x, event.clientY - tapStartPos.y) > 10) {
        tapStartPos = null;
        clearTimeout(pressTimer);
      }
    }, { passive: true });

    row.addEventListener('pointerup', () => {
      clearTimeout(pressTimer);
      if (!tapStartPos) return;
      tapStartPos = null;
      if (String(message.id).startsWith('tmp-') || !currentUser || message.sender_id === currentUser.id) return;
      if (row.classList.contains('revoked')) return;
      const now = Date.now();
      if (lastTapRow === row && now - lastTapAt < 300) {
        lastTapRow = null;
        lastTapAt = 0;
        pickReaction(message.id, '❤️');
      } else {
        lastTapRow = row;
        lastTapAt = now;
      }
    });

    row.addEventListener('pointercancel', () => {
      tapStartPos = null;
      clearTimeout(pressTimer);
    }, { passive: true });
  }

  async function loadReactionsForMessages() {
    if (!currentUser) return;
    const ids = [...messageCache.keys()].filter((id) => !String(id).startsWith('tmp-')).map(String);
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', ids)
      .limit(500);
    if (error) { console.error('loadReactions error:', error); return; }
    if (data) for (const r of data) addReactionToStore(r.message_id, r.user_id, r.emoji);
    document.querySelectorAll('.message-row[data-id]').forEach((row) => renderReactionBadges(row));
    saveReactionsToCache();
  }

  function handleReactionsChange(payload) {
    if (!payload.new || !currentUser) return;
    const r = payload.new;
    if (r.user_id === currentUser.id) return; // thay đổi của mình: đã optimistic
    addReactionToStore(r.message_id, r.user_id, r.emoji);
    const row = document.getElementById('msg-' + r.message_id);
    if (row) renderReactionBadges(row, r.emoji);
    saveReactionsToCache();
    const msg = messageCache.get(r.message_id);
    if (msg && msg.sender_id === currentUser.id) {
      const name = profilesMap.get(r.user_id)?.name || 'Ai đó';
      showAppToast(`${name} đã thả ${r.emoji} vào tin của bạn`);
    }
  }

  function handleReactionsDelete(payload) {
    const r = payload.old;
    if (!r || !currentUser) return;
    if (r.user_id === currentUser.id) return; // thay đổi của mình
    removeReactionFromStore(r.message_id, r.user_id);
    const row = document.getElementById('msg-' + r.message_id);
    if (row) renderReactionBadges(row);
    saveReactionsToCache();
  }

  let reactionsChannel = null;
  function subscribeReactions() {
    if (reactionsChannel) supabase.removeChannel(reactionsChannel);
    reactionsChannel = supabase
      .channel('public:reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, handleReactionsChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reactions' }, handleReactionsChange)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, handleReactionsDelete)
      .subscribe();
  }

  // ─── Sync 50 latest messages ─────────────────────────────────────────────────
  async function syncMessages() {
    if (!currentUser) return;
    // Không sync khi người dùng đang cuộn: hoãn 500ms/lần, tối đa 4 lần.
    for (let i = 0; i < 4 && Date.now() - lastUserScrollAt < 300; i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (Date.now() - lastUserScrollAt < 300) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) { console.error('syncMessages error:', error); return; }
    if (data && data.length > 0) {
      const prevNewest = chronoBounds().last; // null = lần tải đầu khi mở app
      const sorted = data.reverse();
      let addedNew = 0;
      for (const msg of sorted) {
        if (document.getElementById('msg-' + msg.id)) continue; // chỉ addMsg tin còn thiếu
        if (messageIds.has(msg.id)) messageIds.delete(msg.id);   // id có nhưng thiếu DOM → vẽ lại
        await addMsg(msg, false, { sorted: true });
        if (!prevNewest || msg.created_at > prevNewest) addedNew++;
      }
      if (prevNewest === null) scrollToBottom('init');          // lần tải đầu khi mở app
      else if (addedNew && stickBottom) scrollToBottom('sync'); // ở đáy thì mới theo dõi
      if (addedNew && !stickBottom) { newMsgCount += addedNew; updateNewMsgButton(); }
      if (addedNew || prevNewest === null) { saveMsgsToCache(); renderSeen(); }
      // KHÔNG đổi scrollTop ở đây (trừ 2 nhánh cuộn hợp lệ ở trên).
      await markRead();
      await loadReactionsForMessages();
    }
  }

  // Nhận tin mới (realtime INSERT) — MỘT nơi quyết định cuộn hay hiện nút (N).
  async function handleIncomingMessage(msg) {
    if (!msg) return;
    const alreadyRendered = !!document.getElementById('msg-' + msg.id);
    await addMsg(msg, false, { animate: !alreadyRendered, sorted: true });
    if (!alreadyRendered) {
      const isMine = !!(currentUser && msg.sender_id === currentUser.id);
      if (isMine) scrollToBottom('mySend');                 // mình gửi → luôn xuống
      else if (stickBottom) scrollToBottom('newMsg');        // đang ở đáy → tự xuống
      else { newMsgCount++; updateNewMsgButton(); }          // đang đọc cũ → hiện nút (N)
    }
    saveMsgsToCache();
    scheduleStreakRefresh();
    if (currentUser && msg.sender_id !== currentUser.id) {
      hideTyping();
      markRead();
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
            if (currentUser && payload.new.sender_id && payload.new.sender_id !== currentUser.id) notePeerActive();
            await handleIncomingMessage(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new) {
            if (payload.new.revoked) applyMsgRevoked(payload.new);
            else updateMsgReadAt(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          subscribeReactions();
          syncMessages();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeRoom, 1500);
        }
      });
  }

  // ─── Load from cache then sync ───────────────────────────────────────────────
  async function loadFromCacheThenSync() {
    // Vẽ cảm xúc từ cache trước (nhanh)
    loadReactionsFromCache();
    document.querySelectorAll('.message-row[data-id]').forEach((row) => renderReactionBadges(row));
    // Draw from cache immediately
    const cached = lsGet(CACHE_MSGS_KEY);
    if (cached && cached.length > 0) {
      for (const msg of cached) await addMsg(msg, false);
      scrollToBottom('init');
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

  // ─── Ảnh đúng hướng: tự đọc EXIF + tự xoay/lật (Safari bỏ sót kiểu lật ngang → ảnh camera trước bị lật) ──
  function readExifOrientation(buf) {
    try {
      const v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 1; // không phải JPEG
      let off = 2;
      while (off + 4 <= v.byteLength) {
        if (v.getUint8(off) !== 0xFF) { off++; continue; }
        const marker = v.getUint8(off + 1);
        if (marker === 0xDA || marker === 0xD9) break; // tới phần dữ liệu ảnh
        if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; continue; }
        const size = v.getUint16(off + 2);
        if (size < 2) break;
        if (marker === 0xE1 && off + 10 <= v.byteLength &&
            v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0) {
          const tiff = off + 10;
          const little = v.getUint16(tiff) === 0x4949; // II/MM
          const ifd = tiff + v.getUint32(tiff + 4, little);
          if (ifd + 2 <= v.byteLength) {
            const count = v.getUint16(ifd, little);
            for (let i = 0; i < count; i++) {
              const entry = ifd + 2 + i * 12;
              if (entry + 12 > v.byteLength) break;
              if (v.getUint16(entry, little) === 0x0112) { // Orientation
                const o = v.getUint16(entry + 8, little);
                return o >= 1 && o <= 8 ? o : 1;
              }
            }
          }
          return 1;
        }
        off += 2 + size;
      }
    } catch {}
    return 1;
  }

  // 8 phép EXIF (src → vị trí đích: 0 TL, 1 TR, 2 BL, 3 BR) — chuẩn ISO 12234
  const EXIF_MAP = {
    1: [0, 1, 2, 3], 2: [1, 0, 3, 2], 3: [3, 2, 1, 0], 4: [2, 3, 0, 1],
    5: [0, 2, 1, 3], 6: [1, 3, 0, 2], 7: [3, 1, 2, 0], 8: [2, 0, 3, 1]
  };

  // Chèn APP1 Exif (IFD0 Orientation = n) ngay sau SOI của JPEG
  function jpegWithExif(bytes, n) {
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2A, 0, 8, 0, 0, 0, 1, 0,
      0x12, 0x01, 3, 0, 1, 0, 0, 0, n, 0, 0, 0, 0, 0, 0, 0];
    const size = payload.length + 2;
    const app1 = [0xFF, 0xE1, size >> 8, size & 255].concat(payload);
    const out = new Uint8Array(2 + app1.length + bytes.length - 2);
    out[0] = 0xFF; out[1] = 0xD8;
    out.set(app1, 2);
    out.set(bytes.slice(2), 2 + app1.length);
    return new Blob([out], { type: 'image/jpeg' });
  }

  // Dò 1 lần cho mỗi kiểu EXIF: ảnh mẫu 4 góc gắn EXIF n, xem trình duyệt này xoay/lật thế nào
  let exifProbeJpeg = null;
  const exifProbeCache = {};
  async function exifProbeObserved(n) {
    if (exifProbeCache[n]) return exifProbeCache[n];
    if (!exifProbeJpeg) {
      const w = 60, h = 40;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      c.fillStyle = '#ff0000'; c.fillRect(0, 0, w, h / 2);
      c.fillStyle = '#0000ff'; c.fillRect(0, h / 2, w, h / 2);
      c.fillStyle = '#00ff00'; c.fillRect(w / 2, 0, w / 2, h / 2);
      c.fillStyle = '#ffff00'; c.fillRect(w / 2, h / 2, w / 2, h / 2);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 1));
      exifProbeJpeg = { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
    }
    const p = exifProbeJpeg;
    const bmp = await createImageBitmap(jpegWithExif(p.bytes, n), { imageOrientation: 'from-image' });
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const c = cv.getContext('2d');
    c.drawImage(bmp, 0, 0);
    const pal = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]]; // src: TL TR BL BR
    const pos = [0, 0, 0, 0]; // pos[src] = vị trí thấy src trong ảnh quan sát được
    [[2, 2], [bmp.width - 3, 2], [2, bmp.height - 3], [bmp.width - 3, bmp.height - 3]].forEach(([x, y], pi) => {
      const d = c.getImageData(x, y, 1, 1).data;
      let best = 0, bd = 1e9;
      pal.forEach((col, k) => {
        const dd = (d[0] - col[0]) ** 2 + (d[1] - col[1]) ** 2 + (d[2] - col[2]) ** 2;
        if (dd < bd) { bd = dd; best = k; }
      });
      pos[best] = pi;
    });
    const res = { pos, swapped: bmp.width !== p.w }; // đo TRƯỚC khi đóng bmp (đóng xong width = 0)
    bmp.close?.();
    if (new Set(pos).size !== 4) throw new Error('dò EXIF không đáng tin');
    exifProbeCache[n] = res;
    return res;
  }

  // Bitmap đúng hướng: trình duyệt đã áp EXIF (đủ hay thiếu lật tùy trình duyệt) → dò cách nó làm,
  // tự bù phần còn thiếu (Safari bỏ lật ngang/dọc → ảnh camera trước bị lật trong app).
  async function decodeOrientedBitmap(file) {
    let orient = 1;
    try { orient = readExifOrientation(await file.slice(0, 131072).arrayBuffer()); } catch {}
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { bmp = await createImageBitmap(file); }
    if (orient === 1 || !EXIF_MAP[orient]) return bmp;
    let obs;
    try { obs = await exifProbeObserved(orient); } catch { return bmp; } // không dò được → giữ nguyên như cũ
    const D = EXIF_MAP[orient];
    const O = obs.pos;
    const inv = [0, 0, 0, 0];
    O.forEach((pos, src) => { inv[pos] = src; });
    const C = inv.map((src) => D[src]); // phép cần bù: C = D ∘ O⁻¹
    if (C[0] === 0 && C[1] === 1 && C[2] === 2 && C[3] === 3) return bmp; // trình duyệt đã làm đúng
    const w = bmp.width, h = bmp.height;
    const swapC = (orient >= 5) !== obs.swapped;
    const dw = swapC ? h : w, dh = swapC ? w : h;
    const coords = [[0, 0], [dw, 0], [0, dh], [dw, dh]];
    const dst = C.map((label) => coords[label]);
    const [x0, y0] = dst[0], [x1, y1] = dst[1], [x2, y2] = dst[2];
    const canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext('2d');
    ctx.setTransform((x1 - x0) / w, (y1 - y0) / w, (x2 - x0) / h, (y2 - y0) / h, x0, y0);
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    try { return await createImageBitmap(canvas); } catch { return canvas; }
  }

  // ─── Image resize ─────────────────────────────────────────────────────────────
  async function resizeImage(file) {
    const bitmap = await decodeOrientedBitmap(file);
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
      remind_mode: remindSelect ? remindSelect.value : 'none'
    };
    if (replyToId !== null && Number.isInteger(Number(replyToId))) payload.reply_to = Number(replyToId);
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
      restoreText: captionText || ''
    });
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
    const replyToId = resolveReplyId();
    for (let i = 0; i < files.length; i++) {
      uploadAndSendImage(files[i], i === 0 ? caption : '', replyToId);
    }
    if (replyToId) clearReply();
  }

  // ─── Bảng chức năng (nút ➕) ─────────────────────────────────────────────────
  function closeFuncPanel() {
    attachMenu?.classList.remove('open');
    btnAttach?.classList.remove('opened');
    btnAttach?.setAttribute('aria-expanded', 'false');
  }
  if (btnAttach && attachMenu) {
    // pointerdown preventDefault: bấm ➕ không làm mất focus/caret ô nhập.
    btnAttach.addEventListener('pointerdown', (e) => e.preventDefault());
    btnAttach.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !attachMenu.classList.contains('open');
      attachMenu.classList.toggle('open', open);
      btnAttach.classList.toggle('opened', open);
      btnAttach.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', closeFuncPanel);
    attachMenu.addEventListener('click', (e) => e.stopPropagation());
  }
  if (btnSticker && stickerPanel && stickerGrid && fileSticker) {
    btnSticker.addEventListener('click', async (event) => {
      event.stopPropagation();
      closeFuncPanel();
      const open = !stickerPanel.classList.contains('open');
      if (open) closePinkKeyboard();
      stickerPanel.classList.toggle('open', open);
      stickerPanel.setAttribute('aria-hidden', String(!open));
      if (open) await loadStickers();
    });
    stickerPanel.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', (event) => {
      if (!stickerPanel.contains(event.target) && event.target !== btnSticker) {
        closeStickerPanel();
        if (event.target === messageInput && !nativeKeyboardMode) openPinkKeyboard();
      }
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
    btnCamera.addEventListener('click', () => { closeFuncPanel(); fileCamera.value = ''; fileCamera.click(); });
    fileCamera.addEventListener('change', () => handleFiles(fileCamera.files));
  }
  if (btnGallery && fileGallery) {
    btnGallery.addEventListener('click', () => { closeFuncPanel(); fileGallery.value = ''; fileGallery.click(); });
    fileGallery.addEventListener('change', () => handleFiles(fileGallery.files));
  }

  // ─── Tìm kiếm tin nhắn ──────────────────────────────────────────────────────
  const SEARCH_HISTORY_KEY = 'dinhichat_search_history_v1';
  const SEARCH_PAGE = 30;
  const searchScreen = document.getElementById('search-screen');
  const searchInput = document.getElementById('search-input');
  const searchBack = document.getElementById('search-back');
  const searchClear = document.getElementById('search-clear');
  const searchStatus = document.getElementById('search-status');
  const searchHistoryEl = document.getElementById('search-history');
  const searchResultsEl = document.getElementById('search-results');
  const btnSearch = document.getElementById('btn-search');
  let searchWasPink = false;
  let searchDebounce = null;
  let searchRequestId = 0;
  let searchLoadingMore = false;
  let searchHasMore = false;
  let searchLastBefore = null;
  let searchCache = new Map();

  function unaccentLower(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  // Dựng đoạn text với <mark> cho từ khóa (so khớp không dấu), an toàn XSS.
  function highlightSearchText(text, q) {
    const frag = document.createDocumentFragment();
    const nq = unaccentLower(q);
    if (!nq || !text) { frag.textContent = text || ''; return frag; }
    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const u = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
      const rep = u || text[i];
      for (let k = 0; k < rep.length; k++) map.push(i);
      norm += rep;
    }
    const ln = norm.toLowerCase();
    let pos = 0;
    let idx = ln.indexOf(nq);
    while (idx !== -1) {
      const start = map[idx];
      const end = map[idx + nq.length - 1] + 1;
      if (start > pos) frag.appendChild(document.createTextNode(text.slice(pos, start)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(start, end);
      frag.appendChild(mark);
      pos = end;
      idx = ln.indexOf(nq, idx + nq.length);
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  function fmtSearchTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    } catch { return ''; }
  }

  function getSearchHistory() {
    try {
      const h = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
      return Array.isArray(h) ? h.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  }

  function saveSearchHistory(q) {
    try {
      const h = [q, ...getSearchHistory().filter((x) => x !== q)].slice(0, 5);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
    } catch {}
  }

  function renderSearchHistory() {
    if (!searchHistoryEl || !searchInput) return;
    searchHistoryEl.textContent = '';
    if (searchInput.value.trim()) return;
    const h = getSearchHistory();
    if (!h.length) return;
    for (const q of h) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'search-chip';
      chip.textContent = q;
      chip.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = q;
        runSearch(q);
      });
      searchHistoryEl.appendChild(chip);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'search-history-clear';
    clear.textContent = 'Xóa lịch sử';
    clear.addEventListener('click', () => {
      try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch {}
      renderSearchHistory();
    });
    searchHistoryEl.appendChild(clear);
  }

  function setSearchStatus(text) {
    if (searchStatus) searchStatus.textContent = text;
  }

  function appendSearchResults(rows, q) {
    if (!searchResultsEl) return;
    for (const m of rows) {
      searchCache.set(m.id, m);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-row';
      const av = document.createElement('span');
      av.className = 'search-avatar avatar-circle';
      av.setAttribute('aria-hidden', 'true');
      const nm = senderName(m);
      av.textContent = nm.substring(0, 2).toUpperCase();
      renderAvatar(av, profilesMap.get(m.user_id) || { id: m.user_id, name: nm });
      const body = document.createElement('span');
      body.className = 'search-row-body';
      const head = document.createElement('span');
      head.className = 'search-row-head';
      const nameEl = document.createElement('span');
      nameEl.className = 'search-row-name';
      nameEl.textContent = nm;
      const timeEl = document.createElement('span');
      timeEl.className = 'search-row-time';
      timeEl.textContent = fmtSearchTime(m.created_at);
      head.appendChild(nameEl);
      head.appendChild(timeEl);
      const textEl = document.createElement('span');
      textEl.className = 'search-row-text';
      textEl.appendChild(highlightSearchText(m.content || '', q));
      body.appendChild(head);
      body.appendChild(textEl);
      btn.appendChild(av);
      btn.appendChild(body);
      btn.addEventListener('click', () => jumpToMessage(m.id, m.created_at));
      searchResultsEl.appendChild(btn);
    }
    const count = searchResultsEl.childElementCount;
    setSearchStatus(count ? (count + (searchHasMore ? '+ kết quả' : ' kết quả')) : 'Không thấy kết quả');
  }

  async function runSearch(q, before = null) {
    if (!searchResultsEl || !currentUser) return;
    const query = (q || '').trim();
    if (query.length < 2) {
      if (!before) {
        searchResultsEl.textContent = '';
        setSearchStatus('');
        renderSearchHistory();
      }
      return;
    }
    const myId = ++searchRequestId;
    if (!before) {
      searchLoadingMore = false;
      searchHasMore = false;
      searchLastBefore = null;
      searchResultsEl.textContent = '';
      setSearchStatus('Đang tìm…');
      saveSearchHistory(query);
      renderSearchHistory();
    } else {
      if (searchLoadingMore) return;
      searchLoadingMore = true;
    }
    try {
      const { data, error } = await supabase.rpc('search_messages', {
        q: query,
        lim: SEARCH_PAGE,
        before: before
      });
      if (myId !== searchRequestId) return;
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      searchHasMore = rows.length >= SEARCH_PAGE;
      if (rows.length) searchLastBefore = rows[rows.length - 1].created_at;
      appendSearchResults(rows, query);
    } catch (err) {
      if (myId !== searchRequestId) return;
      console.error('runSearch error:', err);
      setSearchStatus('Tìm thất bại');
    } finally {
      if (myId === searchRequestId) searchLoadingMore = false;
    }
  }

  // Chèn bong bóng vào đúng thứ tự thời gian; nếu chèn phía trên khung nhìn
  // đang thấy thì bù scrollTop để giữ nguyên vị trí cuộn.
  function insertMsgSorted(row, createdAt) {
    const list = messagesContainer;
    const prevH = list.scrollHeight;
    const prevTop = list.scrollTop;
    let before = null;
    for (const r of list.querySelectorAll('.message-row[data-id]')) {
      if (r === row) continue;
      if (String(r.dataset.id || '').startsWith('tmp-')) continue;
      let t = null;
      try { t = JSON.parse(r.dataset.msg || '{}').created_at; } catch {}
      if (t && t > createdAt) { before = r; break; }
    }
    if (before) list.insertBefore(row, before);
    else list.appendChild(row);
    refreshMsgAvatar(row);
    refreshMsgAvatar(row.previousElementSibling);
    if (before && before.offsetTop <= prevTop) {
      list.scrollTop = prevTop + (list.scrollHeight - prevH);
    }
    return before;
  }

  function findMsgRow(id) {
    const key = String(id);
    for (const r of messagesContainer.querySelectorAll('.message-row[data-id]')) {
      if (r.dataset.id === key) return r;
    }
    return null;
  }

  function chronoBounds() {
    let first = null;
    let last = null;
    for (const r of messagesContainer.querySelectorAll('.message-row[data-id]')) {
      if (String(r.dataset.id || '').startsWith('tmp-')) continue;
      let t = null;
      try { t = JSON.parse(r.dataset.msg || '{}').created_at; } catch {}
      if (!t) continue;
      if (!first || t < first) first = t;
      if (!last || t > last) last = t;
    }
    return { first, last };
  }

  function failJump(key, detail) {
    try { console.error('jumpToMessage: không mở được tin này', { id: key, detail }); } catch {}
    showAppToast('Không mở được tin này');
  }

  async function jumpToMessage(id, createdAt) {
    const key = String(id);
    closeSearch();
    // Chờ màn tìm kiếm đóng hẳn (display:none) trước khi đo/cuộn; tab ẩn rAF không chạy nên có timeout.
    try {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        try { requestAnimationFrame(() => requestAnimationFrame(finish)); } catch { finish(); }
        setTimeout(finish, 400);
      });
    } catch {}

    let row = findMsgRow(key);
    if (!row) {
      let mark = createdAt || null;
      if (!mark) {
        try {
          const t = searchCache.get(id) || await getMessageById(key);
          mark = t && t.created_at;
        } catch (err) { failJump(key, { stage: 'get-target', err }); return; }
      }
      if (!mark) { failJump(key, { stage: 'no-created-at' }); return; }
      try {
        const before = chronoBounds();
        const [olderRes, newerRes] = await Promise.all([
          supabase.from('messages').select('*').lte('created_at', mark).order('created_at', { ascending: false }).limit(SEARCH_PAGE),
          supabase.from('messages').select('*').gt('created_at', mark).order('created_at', { ascending: true }).limit(SEARCH_PAGE)
        ]);
        if (olderRes.error) throw { query: 'older', error: olderRes.error };
        if (newerRes.error) throw { query: 'newer', error: newerRes.error };
        const older = [...(olderRes.data || [])].reverse();
        const newer = [...(newerRes.data || [])];
        const target = searchCache.get(id) || messageCache.get(id) || null;
        const all = [...older, ...newer];
        if (target && !all.some((m) => String(m.id) === key)) all.push(target);
        all.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
        // Khoảng trống: đoạn tải không nối liền tin đang hiện → cờ "đang xem tin cũ".
        const oldest = all.length ? all[0].created_at : null;
        const newest = all.length ? all[all.length - 1].created_at : null;
        let gap = false;
        if (!before.first || !before.last) gap = true;
        else if (newest && newest < before.first) gap = true;
        else if (oldest && oldest > before.last) gap = true;
        for (const m of all) {
          if (String(m.id).startsWith('tmp-')) continue;
          if (findMsgRow(m.id)) continue;
          if (messageIds.has(m.id)) messageIds.delete(m.id);
          try {
            await addMsg(m, false, { sorted: true });
          } catch (err) {
            messageIds.delete(m.id);
            console.error('jumpToMessage: lỗi vẽ tin', m.id, err);
          }
        }
        saveMsgsToCache();
        if (gap) viewingOldMessages = true;
      } catch (err) {
        failJump(key, { stage: 'fetch-segment', mark, error: err });
        return;
      }
      row = findMsgRow(key);
    }
    if (!row) { failJump(key, { stage: 'row-missing' }); return; }

    jumpLockUntil = Date.now() + 800;
    const centerRow = () => {
      if (!row || !row.isConnected) return;
      try {
        const listRect = messagesContainer.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const targetTop = messagesContainer.scrollTop + (rowRect.top - listRect.top) -
          (messagesContainer.clientHeight - rowRect.height) / 2;
        messagesContainer.scrollTop = Math.max(0, targetTop);
      } catch {}
    };
    centerRow();
    setTimeout(centerRow, 300); // ảnh tải xong làm lệch thì cuộn lại 1 lần
    row.classList.add('msg-highlight');
    setTimeout(() => row.classList.remove('msg-highlight'), 1500);
    // Nếu không có khoảng hở / nội dung vừa khít màn hình thì về lại bình thường.
    setTimeout(() => { if (viewingOldMessages && isAtBottom()) exitOldView(); }, 900);
  }

  function openSearch() {
    if (!searchScreen) return;
    closeFuncPanel();
    closeStickerPanel();
    searchWasPink = pinkKeyboardOpen;
    if (searchWasPink) closePinkKeyboard();
    if (messageInput) messageInput.blur();
    searchScreen.classList.add('open');
    if (searchInput) {
      searchInput.value = '';
      if (searchResultsEl) searchResultsEl.textContent = '';
      setSearchStatus('');
      renderSearchHistory();
      try { searchInput.focus({ preventScroll: true }); } catch { searchInput.focus(); }
    }
  }

  function closeSearch() {
    if (!searchScreen || !searchScreen.classList.contains('open')) return;
    searchScreen.classList.remove('open');
    clearTimeout(searchDebounce);
    searchRequestId++;
    if (searchInput) searchInput.blur();
    if (searchWasPink) {
      searchWasPink = false;
      try { usePinkKeyboard(); } catch {}
    }
  }

  btnSearch?.addEventListener('click', () => { closeFuncPanel(); openSearch(); });
  searchBack?.addEventListener('click', closeSearch);
  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchRequestId++;
    if (searchResultsEl) searchResultsEl.textContent = '';
    setSearchStatus('');
    renderSearchHistory();
    try { searchInput.focus({ preventScroll: true }); } catch { searchInput.focus(); }
  });
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value;
    searchDebounce = setTimeout(() => runSearch(q), 300);
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchDebounce);
      runSearch(searchInput.value);
    }
  });
  searchResultsEl?.addEventListener('scroll', () => {
    if (!searchHasMore || searchLoadingMore || !searchLastBefore || !searchInput) return;
    const el = searchResultsEl;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      runSearch(searchInput.value, searchLastBefore);
    }
  }, { passive: true });

  // ─── Hồ sơ (profile) ────────────────────────────────────────────────────────
  const PROFILE_LONG_MAX = 500;
  const PROFILE_SHORT_MAX = 60;
  const PROFILE_DRAFT_KEY = 'dinhichat_profile_draft_v1';
  const profileScreen = document.getElementById('profile-screen');
  const profileBack = document.getElementById('profile-back');
  const profileSave = document.getElementById('profile-save');
  const profileTabMe = document.getElementById('profile-tab-me');
  const profileTabPeer = document.getElementById('profile-tab-peer');
  const profileScroll = document.getElementById('profile-scroll');
  const profileAvatarBtn = document.getElementById('profile-avatar-btn');
  const profileAvatarEl = document.getElementById('profile-avatar');
  const profileAvatarHint = document.getElementById('profile-avatar-hint');
  const profileNameEl = document.getElementById('profile-name');
  const profileBirthdayEl = document.getElementById('profile-birthday');
  const profileFieldsEl = document.getElementById('profile-fields');
  const profileViewEl = document.getElementById('profile-view');
  const profileAvatarFile = document.getElementById('profile-avatar-file');
  const headerUserInfo = document.querySelector('.header-user-info');
  const userStatusEl = document.getElementById('user-status');
  const btnProfile = document.getElementById('btn-profile');

  // Nhóm ô nhập theo thẻ (hồ sơ của mình)
  const PROFILE_GROUPS = [
    { title: 'Cơ bản', fields: [
      { key: 'name', label: 'Biệt danh', type: 'text', placeholder: 'Tên gọi thân thương' },
      { key: 'birthday', label: 'Ngày sinh', type: 'date' },
      { key: 'blood_type', label: 'Nhóm máu', type: 'select', options: ['A', 'B', 'AB', 'O', 'Không rõ'], placeholder: 'Chọn nhóm máu' }
    ]},
    { title: 'Số đo', fields: [
      { key: 'height_cm', label: 'Chiều cao (cm)', type: 'number', min: 50, max: 250, placeholder: 'vd 160 hoặc 160,5' },
      { key: 'weight_kg', label: 'Cân nặng (kg)', type: 'number', min: 20, max: 300, placeholder: 'vd 50' },
      { key: 'shoe_size', label: 'Size giày', type: 'number', min: 20, max: 55, placeholder: 'vd 38' },
      { key: 'clothes_size', label: 'Size áo/quần', type: 'text', placeholder: 'vd M / 28' }
    ]},
    { title: 'Sở thích', fields: [
      { key: 'fav_color', label: 'Màu yêu thích', type: 'text', placeholder: 'vd Hồng nhạt' },
      { key: 'fav_food', label: 'Món yêu thích', type: 'text', placeholder: 'vd Trà sữa trân châu', copy: true },
      { key: 'hobbies', label: 'Sở thích', type: 'textarea', placeholder: 'Nấu ăn, đi dạo, nghe nhạc...' },
      { key: 'likes', label: 'Điều thích', type: 'textarea', placeholder: 'Những điều làm mình vui' }
    ]},
    { title: 'Điều không thích', fields: [
      { key: 'dislikes', label: 'Điều không thích', type: 'textarea', placeholder: 'Những điều làm mình khó chịu' },
      { key: 'allergies', label: 'Dị ứng / lưu ý sức khỏe', type: 'textarea', placeholder: 'vd Dị ứng tôm cua', copy: true }
    ]},
    { title: 'Ghi chú khác', fields: [
      { key: 'note', label: 'Ghi chú khác', type: 'textarea', placeholder: 'Gì cũng được, mình ghi vào đây' }
    ]}
  ];
  const COPY_KEYS = new Set(['shoe_size', 'clothes_size', 'fav_food', 'allergies']);
  const profileInputs = new Map();   // key -> element nhập
  const profileErrors = new Map();   // key -> ô lỗi

  let profileOpen = false;
  let profileWho = 'me';
  let profileWasPink = false;
  let profileDirty = false;
  let profileSaving = false;
  let profileFormReady = false;
  let profileDraftTimer = null;
  let profilePeerId = null;
  let profilesChannel = null;

  function todayVN() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  // { left: ngày còn lại tới sinh nhật (giờ VN), age: tuổi đã tròn }
  function birthdayInfo(birthday) {
    if (!birthday) return null;
    const b = String(birthday).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
    const parts = b.split('-').map(Number);
    const today = todayVN().split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2] || !today[0]) return null;
    const [by, bm, bd] = parts;
    const [ty, tm, td] = today;
    const todayUtc = Date.UTC(ty, tm - 1, td);
    let nextUtc = Date.UTC(ty, bm - 1, bd);
    if (nextUtc < todayUtc) nextUtc = Date.UTC(ty + 1, bm - 1, bd);
    const left = Math.round((nextUtc - todayUtc) / 86400000);
    let age = ty - by;
    if (todayUtc < Date.UTC(by, bm - 1, bd)) age -= 1;
    return { left, age };
  }

  function formatNgaySinh(birthday) {
    const b = String(birthday).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return '';
    const [y, m, d] = b.split('-');
    return `${d}/${m}/${y}`;
  }

  function setAvatarFallback(el, name) {
    delete el.dataset.path;
    el.textContent = String(name || 'DN').substring(0, 2).toUpperCase() || '·';
    el.style.backgroundImage = '';
  }

  // Hàm DUY NHẤT vẽ avatar cho mọi nơi (header, hồ sơ 96px, kết quả tìm kiếm, ô tin nhắn...):
  // kích thước cứng inline (nếu có size), hiện NGAY chữ cái đầu làm fallback,
  // Signed URL (có cache) vẽ nền sau; lỗi tải thì giữ chữ cái, không để ô trống.
  function renderAvatar(el, profile, size) {
    if (!el) return;
    const id = profile && profile.id;
    if (size) {
      const px = `${size}px`;
      el.style.width = px;
      el.style.height = px;
      el.style.minWidth = px;
      el.style.minHeight = px;
      el.style.flex = `0 0 ${px}`;
    }
    el.style.flexShrink = '0';
    el.style.borderRadius = '50%';
    el.style.overflow = 'hidden';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.fontWeight = '700';
    el.style.backgroundColor = '#f8bbd0';
    el.style.color = '#e91e63';
    if (!id) { el.dataset.uid = ''; setAvatarFallback(el, '·'); return; }
    el.dataset.uid = String(id);
    const p = profilesMap.get(id) || profile;
    if (!p || !p.avatar_path) { setAvatarFallback(el, (p && p.name) || '·'); return; }
    const path = p.avatar_path;
    if (el.dataset.path === path && el.style.backgroundImage) return; // đã vẽ đúng ảnh này
    setAvatarFallback(el, p.name); // chữ cái hiện NGAY, Signed URL thay sau
    el.dataset.path = path;
    getSignedUrl(path).then((url) => {
      if (!url) return; // lỗi tải → giữ chữ cái đầu
      if (!el.isConnected || el.dataset.uid !== String(id) || el.dataset.path !== path) return;
      el.textContent = '';
      el.style.backgroundImage = `url("${url}")`;
    });
  }

  // Vẽ lại toàn bộ avatar [data-uid] theo profilesMap hiện tại
  // (gọi sau loadProfiles, realtime profiles UPDATE và khi đổi avatar).
  function refreshAvatars() {
    document.querySelectorAll('[data-uid]').forEach((el) => {
      const uid = el.dataset.uid;
      if (!uid) return;
      const p = profilesMap.get(uid);
      if (!p) return;
      delete el.dataset.path; // buộc vẽ lại theo path hiện tại
      renderAvatar(el, p);
    });
  }

  // Header hiển thị NGƯỜI KIA (avatar + biệt danh + trạng thái); hồ sơ mình qua tab "Của tôi"/panel ➕
  function applyProfileIdentity() {
    renderHeaderPeer();
  }

  function renderHeaderPeer() {
    const peer = getPeerProfile();
    if (userAvatar) renderAvatar(userAvatar, peer);
    if (chatTitle) chatTitle.textContent = (typeof festiveOn !== 'undefined' && festiveOn && bannerHeaderTitle())
      || (peer && peer.name) || 'Iu dấu';
    renderPeerStatus();
  }

  function getPeerProfile() {
    if (profilePeerId && profilesMap.get(profilePeerId)) return profilesMap.get(profilePeerId);
    for (const p of profilesMap.values()) if (!currentUser || p.id !== currentUser.id) return p;
    return null;
  }

  async function fetchPeerProfile() {
    if (!currentUser) return null;
    try {
      const { data, error } = await supabase.from('profiles').select('*').neq('id', currentUser.id).limit(1);
      if (error) throw error;
      if (data && data.length) {
        profilePeerId = data[0].id;
        profilesMap.set(data[0].id, { ...(profilesMap.get(data[0].id) || {}), ...data[0] });
        try { lsSet(CACHE_PROFILES_KEY, [...profilesMap.values()]); } catch {}
        return data[0];
      }
    } catch (err) {
      console.error('fetchPeerProfile error:', err);
    }
    return getPeerProfile();
  }

  function updateTextareaCount(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    const counter = el.closest('.pf')?.querySelector('.pf-count');
    if (counter) counter.textContent = `${el.value.length}/${PROFILE_LONG_MAX}`;
  }

  function buildProfileForm() {
    if (!profileFieldsEl || profileFieldsEl.childElementCount) return;
    for (const group of PROFILE_GROUPS) {
      const card = document.createElement('div');
      card.className = 'profile-group';
      const title = document.createElement('div');
      title.className = 'profile-group-title';
      title.textContent = group.title;
      card.appendChild(title);
      for (const field of group.fields) {
        const wrap = document.createElement('div');
        wrap.className = 'pf';
        const label = document.createElement('label');
        label.className = 'pf-label';
        label.setAttribute('for', 'pf-' + field.key);
        label.textContent = field.label;
        wrap.appendChild(label);

        const control = document.createElement('div');
        control.className = 'pf-control';
        let input;
        if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 3;
          input.maxLength = PROFILE_LONG_MAX;
          const counter = document.createElement('div');
          counter.className = 'pf-count';
          control.appendChild(input);
          wrap.appendChild(control);
          wrap.appendChild(counter);
        } else if (field.type === 'select') {
          input = document.createElement('select');
          const blank = document.createElement('option');
          blank.value = '';
          blank.textContent = field.placeholder || 'Chọn';
          input.appendChild(blank);
          for (const opt of (field.options || [])) {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            input.appendChild(o);
          }
          control.appendChild(input);
          wrap.appendChild(control);
        } else {
          input = document.createElement('input');
          input.type = 'text';
          if (field.type === 'number') input.inputMode = 'decimal'; // bàn phím số iOS
          if (field.placeholder) input.placeholder = field.placeholder;
          control.appendChild(input);
          wrap.appendChild(control);
        }
        input.className = field.type === 'textarea' ? 'pf-textarea'
          : field.type === 'select' ? 'pf-select' : 'pf-input';
        input.id = 'pf-' + field.key;
        input.dataset.key = field.key;
        if (field.max && field.type !== 'number') input.maxLength = field.max;

        const err = document.createElement('div');
        err.className = 'pf-error';
        wrap.appendChild(err);

        input.addEventListener('input', () => {
          const e = profileErrors.get(field.key);
          if (e) e.textContent = '';
          if (input.tagName === 'TEXTAREA') updateTextareaCount(input);
          profileDirty = true;
          scheduleProfileDraft();
        });
        input.addEventListener('change', () => { profileDirty = true; scheduleProfileDraft(); });
        // Ô đang nhập tự cuộn vào giữa vùng nhìn thấy
        input.addEventListener('focus', () => {
          setTimeout(() => { try { input.scrollIntoView({ block: 'center' }); } catch {} }, 250);
        });

        profileInputs.set(field.key, input);
        profileErrors.set(field.key, err);
        card.appendChild(wrap);
      }
      profileFieldsEl.appendChild(card);
    }
  }

  function collectFormValues() {
    const out = {};
    for (const [key, el] of profileInputs) out[key] = el.value;
    return out;
  }

  function scheduleProfileDraft() {
    clearTimeout(profileDraftTimer);
    profileDraftTimer = setTimeout(() => {
      if (!profileDirty) return;
      lsSet(PROFILE_DRAFT_KEY, { at: Date.now(), values: collectFormValues() });
    }, 500);
  }

  function clearProfileDraft() {
    clearTimeout(profileDraftTimer);
    try { localStorage.removeItem(PROFILE_DRAFT_KEY); } catch {}
  }

  function populateProfileForm() {
    buildProfileForm();
    const draft = lsGet(PROFILE_DRAFT_KEY);
    const source = { ...(currentProfile || {}), ...((draft && draft.values) || {}) };
    for (const [key, el] of profileInputs) {
      const value = source[key];
      el.value = value == null ? '' : String(value);
      const err = profileErrors.get(key);
      if (err) err.textContent = '';
      updateTextareaCount(el);
    }
    profileDirty = !!(draft && draft.values);
  }

  function renderProfileHero() {
    if (!profileScreen) return;
    const isMe = profileWho === 'me';
    const peer = getPeerProfile();
    const p = isMe ? currentProfile : peer;
    if (profileTabPeer) profileTabPeer.textContent = (peer && peer.name) || 'Iu dấu';
    if (profileAvatarBtn) profileAvatarBtn.disabled = !isMe;
    if (profileAvatarHint) profileAvatarHint.hidden = !isMe;
    profileNameEl.textContent = (p && p.name) || (isMe ? 'Bạn' : 'Iu dấu');
    renderAvatar(profileAvatarEl, p, 96);
    const bits = [];
    const info = birthdayInfo(p && p.birthday);
    if (p && p.birthday && formatNgaySinh(p.birthday)) bits.push('🎂 ' + formatNgaySinh(p.birthday));
    if (info) {
      bits.push(info.left === 0 ? 'Hôm nay sinh nhật 🎉' : `còn ${info.left} ngày tới sinh nhật`);
      bits.push(`${info.age} tuổi`);
    }
    profileBirthdayEl.textContent = bits.join(' · ')
      || (isMe ? 'Chưa cập nhật ngày sinh' : 'Chưa cập nhật');
  }

  function renderProfileView() {
    if (!profileViewEl) return;
    profileViewEl.textContent = '';
    const peer = getPeerProfile();
    if (!peer) {
      const empty = document.createElement('div');
      empty.className = 'profile-empty';
      empty.textContent = 'Chưa cập nhật';
      profileViewEl.appendChild(empty);
      return;
    }
    for (const group of PROFILE_GROUPS) {
      const card = document.createElement('div');
      card.className = 'profile-group';
      const title = document.createElement('div');
      title.className = 'profile-group-title';
      title.textContent = group.title;
      card.appendChild(title);
      for (const field of group.fields) {
        let value = peer[field.key];
        if (field.key === 'birthday') value = formatNgaySinh(value);
        value = value == null || value === '' ? '' : String(value);
        const row = document.createElement('div');
        row.className = 'pv-item';
        const lab = document.createElement('div');
        lab.className = 'pv-label';
        lab.textContent = field.label;
        const val = document.createElement('div');
        val.className = 'pv-value' + (value ? '' : ' empty');
        val.textContent = value || 'Chưa cập nhật';
        row.appendChild(lab);
        row.appendChild(val);
        if (COPY_KEYS.has(field.key) && value) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'profile-copy';
          btn.textContent = 'Sao chép';
          btn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(value);
              showAppToast('Đã sao chép');
            } catch {
              try {
                const ta = document.createElement('textarea');
                ta.value = value;
                ta.style.position = 'fixed';
                ta.style.left = '-10000px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                showAppToast('Đã sao chép');
              } catch { showAppToast('Không sao chép được'); }
            }
          });
          row.appendChild(btn);
        }
        card.appendChild(row);
      }
      profileViewEl.appendChild(card);
    }
  }

  function switchProfileTab(who) {
    profileWho = who === 'peer' ? 'peer' : 'me';
    const isMe = profileWho === 'me';
    if (profileTabMe) {
      profileTabMe.classList.toggle('active', isMe);
      profileTabMe.setAttribute('aria-selected', String(isMe));
    }
    if (profileTabPeer) {
      profileTabPeer.classList.toggle('active', !isMe);
      profileTabPeer.setAttribute('aria-selected', String(!isMe));
    }
    if (profileSave) profileSave.hidden = !isMe;
    if (profileFieldsEl) profileFieldsEl.hidden = !isMe;
    if (profileViewEl) profileViewEl.hidden = isMe;
    if (isMe) {
      if (!profileFormReady) { populateProfileForm(); profileFormReady = true; }
      if (profileSave) profileSave.hidden = false;
    } else {
      renderProfileView();
    }
    renderProfileHero();
    if (profileScroll) profileScroll.scrollTop = 0;
  }

  async function openProfile(who = 'me') {
    if (!profileScreen || !currentUser || profileOpen) return;
    closeFuncPanel();
    closeStickerPanel();
    profileWasPink = pinkKeyboardOpen;
    if (profileWasPink) closePinkKeyboard();
    resetToNativeKeyboard();          // hồ sơ dùng bàn phím iOS, KHÔNG dùng #kb hồng
    if (messageInput) messageInput.blur();
    profileOpen = true;
    profileScreen.classList.add('open');
    profileScreen.setAttribute('aria-hidden', 'false');
    if (who === 'peer') await fetchPeerProfile();
    if (who === 'me') { populateProfileForm(); profileFormReady = true; }
    switchProfileTab(who);
    if (profileScroll) profileScroll.scrollTop = 0;
  }

  function closeProfile(force = false) {
    if (!profileOpen || !profileScreen) return;
    if (!force && profileWho === 'me' && profileDirty) {
      if (!window.confirm('Bỏ thay đổi?')) return;
      clearProfileDraft();
      profileDirty = false;
      profileFormReady = false;
    }
    profileOpen = false;
    profileScreen.classList.remove('open');
    profileScreen.setAttribute('aria-hidden', 'true');
    clearTimeout(profileDraftTimer);
    const active = document.activeElement;
    if (active && profileScreen.contains(active) && active.blur) active.blur();
    if (profileWasPink) {
      profileWasPink = false;
      try { usePinkKeyboard(); } catch {}
    }
  }

  async function saveProfile() {
    if (profileSaving || profileWho !== 'me' || !currentUser || !profileInputs.size) return;
    const payload = {};
    let firstBad = null;
    for (const group of PROFILE_GROUPS) {
      for (const field of group.fields) {
        const el = profileInputs.get(field.key);
        const err = profileErrors.get(field.key);
        if (!el) continue;
        if (err) err.textContent = '';
        const raw = (el.value || '').trim();
        let value = null;
        if (raw) {
          if (field.type === 'number') {
            const norm = raw.replace(/\s/g, '').replace(',', '.');
            if (!/^\d+(\.\d+)?$/.test(norm)) {
              if (err) err.textContent = 'Nhập số, dùng dấu phẩy hoặc chấm';
              firstBad = firstBad || el;
              continue;
            }
            const num = Number(norm);
            if (num < field.min) {
              if (err) err.textContent = `Phải từ ${field.min} trở lên`;
              firstBad = firstBad || el;
              continue;
            }
            if (num > field.max) {
              if (err) err.textContent = `Tối đa ${field.max}`;
              firstBad = firstBad || el;
              continue;
            }
            value = num;
          } else {
            const limit = field.type === 'textarea' ? PROFILE_LONG_MAX : PROFILE_SHORT_MAX;
            if (raw.length > limit) {
              if (err) err.textContent = `Tối đa ${limit} ký tự`;
              firstBad = firstBad || el;
              continue;
            }
            value = raw;
          }
        }
        const current = currentProfile ? currentProfile[field.key] : null;
        const currentNorm = current == null || current === ''
          ? null
          : (field.type === 'number' ? Number(current) : String(current));
        const nextNorm = value == null ? null : (field.type === 'number' ? Number(value) : value);
        if (currentNorm !== nextNorm) payload[field.key] = value;
      }
    }
    if (firstBad) {
      try { firstBad.focus(); firstBad.scrollIntoView({ block: 'center' }); } catch {}
      return;
    }
    if (!Object.keys(payload).length) {
      profileDirty = false;
      clearProfileDraft();
      showAppToast('Chưa có gì thay đổi');
      return;
    }
    profileSaving = true;
    if (profileSave) { profileSave.disabled = true; profileSave.textContent = 'Đang lưu…'; }
    try {
      payload.profile_updated_at = new Date().toISOString();
      const { error } = await supabase.from('profiles').update(payload).eq('id', currentUser.id);
      if (error) throw error;
      currentProfile = { ...(currentProfile || { id: currentUser.id }), ...payload };
      profilesMap.set(currentUser.id, { ...(profilesMap.get(currentUser.id) || {}), ...currentProfile });
      try { lsSet(CACHE_PROFILES_KEY, [...profilesMap.values()]); } catch {}
      profileDirty = false;
      clearProfileDraft();
      applyProfileIdentity();
      refreshSenderNames();
      renderProfileHero();
      showAppToast('Đã lưu hồ sơ 💕');
    } catch (error) {
      console.error('saveProfile error:', error);
      showAppToast('Lưu hồ sơ thất bại: ' + (error?.message || String(error)));
      saveProfileDraft();
    } finally {
      profileSaving = false;
      if (profileSave) { profileSave.disabled = false; profileSave.textContent = 'Lưu'; }
    }
  }

  function saveProfileDraft() {
    if (!profileDirty) return;
    lsSet(PROFILE_DRAFT_KEY, { at: Date.now(), values: collectFormValues() });
  }

  function refreshSenderNames() {
    document.querySelectorAll('.message-row .sticker-sender').forEach((el) => {
      const row = el.closest('.message-row');
      try { el.textContent = senderName(JSON.parse(row.dataset.msg)); } catch {}
    });
  }

  // Hiện ngay bằng đúng blob vừa cắt (ô hồ sơ 96px + header) trước khi upload xong
  function setAvatarBlobPreview(url) {
    if (userAvatar) {
      userAvatar.textContent = '';
      userAvatar.style.backgroundImage = `url("${url}")`;
    }
    if (profileOpen && profileWho === 'me' && profileAvatarEl) {
      profileAvatarEl.textContent = '';
      profileAvatarEl.style.backgroundImage = `url("${url}")`;
    }
  }

  // Đổi ảnh hồ sơ: xem trước blob ngay, tải lên bucket, lưu profiles.avatar_path (không cần bấm Lưu)
  async function uploadAvatar(blob) {
    if (!currentUser || !blob) return false;
    const prevPath = (currentProfile && currentProfile.avatar_path) || null;
    if (avatarBlobUrl) { try { URL.revokeObjectURL(avatarBlobUrl); } catch {} avatarBlobUrl = null; }
    avatarBlobUrl = URL.createObjectURL(blob);
    setAvatarBlobPreview(avatarBlobUrl);
    try {
      const path = `${currentUser.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, blob, {
        contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('profiles')
        .update({ avatar_path: path, profile_updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);
      if (updateError) throw updateError;
      // Xoá URL cache cũ (path mới → URL mới) để mọi nơi hiện ảnh mới ngay, không dính ảnh cũ trên iOS
      if (prevPath) signedUrlCache.delete(prevPath);
      signedUrlCache.delete(path);
      currentProfile = { ...(currentProfile || { id: currentUser.id }), avatar_path: path };
      profilesMap.set(currentUser.id, { ...(profilesMap.get(currentUser.id) || {}), ...currentProfile });
      try { lsSet(CACHE_PROFILES_KEY, [...profilesMap.values()]); } catch {}
      applyProfileIdentity();
      refreshAvatars(); // đổi avatar xong → vẽ lại mọi ô (header, hồ sơ, tin nhắn, tìm kiếm)
      refreshSenderNames();
      renderProfileHero();
      // Thu hồi blob URL sau khi signed URL mới đã vẽ xong lên avatar (chuyển hẳn sang ảnh server)
      const blobUrl = avatarBlobUrl;
      const revokeBlobWhenPainted = (tries) => {
        if (avatarBlobUrl !== blobUrl) return;
        const painted = (userAvatar && userAvatar.dataset.path === path)
          || (profileAvatarEl && profileAvatarEl.dataset.path === path);
        if (painted || tries <= 0) {
          try { URL.revokeObjectURL(blobUrl); } catch {}
          avatarBlobUrl = null;
          return;
        }
        setTimeout(() => revokeBlobWhenPainted(tries - 1), 1500);
      };
      setTimeout(() => revokeBlobWhenPainted(8), 300);
      showAppToast('Đã đổi ảnh hồ sơ 💕');
      return true;
    } catch (error) {
      // Trả lại avatar cũ nếu upload thất bại
      if (avatarBlobUrl) { try { URL.revokeObjectURL(avatarBlobUrl); } catch {} avatarBlobUrl = null; }
      applyProfileIdentity();
      renderProfileHero();
      console.error('uploadAvatar error:', error);
      showCoverToast('Đổi ảnh hồ sơ thất bại: ' + (error?.message || String(error)));
      return false;
    }
  }

  function subscribeProfilesChange() {
    if (profilesChannel) {
      try { supabase.removeChannel(profilesChannel); } catch {}
      profilesChannel = null;
    }
    if (!currentUser) return;
    profilesChannel = supabase.channel('profiles-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload && payload.new;
        if (!row || !row.id) return;
        // avatar_path đổi → xóa URL cache cũ, render lại theo path mới
        const oldRow = profilesMap.get(row.id);
        if (typeof row.avatar_path !== 'undefined' && oldRow && oldRow.avatar_path && oldRow.avatar_path !== row.avatar_path) {
          signedUrlCache.delete(oldRow.avatar_path);
        }
        profilesMap.set(row.id, { ...(oldRow || {}), ...row });
        try { lsSet(CACHE_PROFILES_KEY, [...profilesMap.values()]); } catch {}
        refreshAvatars(); // realtime UPDATE → vẽ lại mọi ô avatar theo path hiện tại
        if (currentUser && row.id === currentUser.id) {
          currentProfile = { ...(currentProfile || {}), ...row };
          applyProfileIdentity();
          if (profileOpen && profileWho === 'me' && !profileDirty) {
            populateProfileForm();
            profileFormReady = true;
          }
        } else {
          renderHeaderPeer(); // người kia đổi biệt danh/avatar → header cập nhật ngay
          if (profileOpen && profileWho === 'peer') {
            renderProfileView();
            renderProfileHero();
          }
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeProfilesChange, 2000);
        }
      });
  }

  btnProfile?.addEventListener('click', () => { closeFuncPanel(); openProfile('me'); });
  profileBack?.addEventListener('click', () => closeProfile());
  profileSave?.addEventListener('click', saveProfile);
  profileTabMe?.addEventListener('click', () => switchProfileTab('me'));
  profileTabPeer?.addEventListener('click', () => switchProfileTab('peer'));
  profileAvatarBtn?.addEventListener('click', () => {
    if (profileWho !== 'me' || !profileAvatarFile) return;
    profileAvatarFile.click();
  });
  profileAvatarFile?.addEventListener('change', () => {
    const file = profileAvatarFile.files && profileAvatarFile.files[0];
    profileAvatarFile.value = '';
    if (file) openCoverCrop(file, 'avatar');
  });
  // Bấm avatar/tên ở header = hồ sơ NGƯỜI KIA (tab của họ); hồ sơ mình qua tab "Của tôi" / mục ➕
  if (headerUserInfo) headerUserInfo.style.cursor = 'pointer';
  headerUserInfo?.addEventListener('click', () => openProfile('peer'));
  // Bấm tên người kia trên tin (sticker) = hồ sơ người kia
  messagesContainer?.addEventListener('click', (event) => {
    if (event.target?.closest?.('.sticker-sender')) openProfile('peer');
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (!profileOpen) return;
      const el = document.activeElement;
      if (el && profileScreen.contains(el) && el.matches?.('input, textarea')) {
        setTimeout(() => { try { el.scrollIntoView({ block: 'center' }); } catch {} }, 60);
      }
    });
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
    const payload = {
      content: text,
      sender_id: currentUser.id,
      remind_mode: remindMode
    };
    addResolvedReplyTo(payload);
    messageInput.value = '';
    resizeMessageInput();
    updateSendButtonVisibility();
    animateSendButton();
    const pendingSend = addOptimisticMessage(payload, async () => {
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }, {
      restoreText: text,
      textFlightSource,
      onSuccess: () => {
        clearReply();
      }
    });
    if (pinkKeyboardOpen) scrollToBottom('mySend');
    await pendingSend;
    scheduleStreakRefresh();
    clearReply();
    keepMessageInputFocused();
    scrollToBottom('mySend');
    // Sau ~6s notify đã ghi last_push_status → cập nhật dòng cảnh báo người gửi.
    clearTimeout(peerStatusTimer);
    peerStatusTimer = setTimeout(refreshPeerPushStatus, 6000);
  }

  // ─── Chuỗi giữ lửa (streak) ────────────────────────────────────────────────
  const STREAK_KEY = 'dinhichat_streak_v1';
  const STREAK_MILESTONES = { 7: 'Cột mốc 7 ngày giữ lửa! 💕🔥', 30: 'Tròn 30 ngày giữ lửa! 💖🔥', 100: '100 ngày giữ lửa, quá đỉnh! 💯💗', 365: '365 ngày giữ lửa, cả năm yêu thương! 🎉💗' };
  let streakData = null;
  let streakPrev = null;
  let streakTimer = null;
  const streakPill = document.getElementById('streak-pill');
  const streakHeart = document.getElementById('streak-heart');
  const streakNum = document.getElementById('streak-num');
  const streakSheet = document.getElementById('streak-sheet');
  const streakBackdrop = document.getElementById('streak-backdrop');
  const streakBigHeart = document.getElementById('streak-big-heart');
  const streakBigNum = document.getElementById('streak-big-num');
  const streakBestNum = document.getElementById('streak-best-num');
  const streakTodayText = document.getElementById('streak-today-text');
  const streakWeek = document.getElementById('streak-week');
  const streakClose = document.getElementById('streak-close');

  function streakOtherName() {
    if (!currentUser) return 'Iu dấu';
    for (const p of profilesMap.values()) {
      if (p.id !== currentUser.id) return p.name || 'Iu dấu';
    }
    return 'Iu dấu';
  }

  function renderStreak() {
    if (!streakData || !streakPill) return;
    const cur = streakData.current || 0;
    const best = streakData.best || 0;
    const both = !!(streakData.today_me && streakData.today_other);
    if (streakNum) streakNum.textContent = String(cur);
    if (streakHeart) streakHeart.textContent = cur === 0 ? '🤍' : '💗';
    streakPill.classList.toggle('is-hot', cur > 0 && both);
    streakPill.classList.toggle('is-wait', cur > 0 && !both);
    streakPill.classList.toggle('is-zero', cur === 0);
    if (streakBigNum) streakBigNum.textContent = String(cur);
    if (streakBigHeart) streakBigHeart.textContent = cur === 0 ? '🤍' : '💗';
    if (streakBestNum) streakBestNum.textContent = String(best);
    if (streakTodayText) {
      if (both) streakTodayText.textContent = 'Cả hai đã giữ lửa hôm nay 💕';
      else if (!streakData.today_me) streakTodayText.textContent = 'Bạn chưa nhắn hôm nay';
      else streakTodayText.textContent = streakOtherName() + ' chưa nhắn hôm nay';
    }
    if (streakWeek) {
      streakWeek.textContent = '';
      const week = Array.isArray(streakData.week) ? streakData.week : [];
      for (const day of week.slice(-7)) {
        const s = document.createElement('span');
        s.textContent = day && day.kept ? '💗' : '🤍';
        if (day && day.date) s.title = String(day.date);
        streakWeek.appendChild(s);
      }
    }
  }

  function celebrateStreak(n) {
    if (STREAK_MILESTONES[n]) showAppToast(STREAK_MILESTONES[n], 3000);
    else showAppToast('Streak ' + n + ' ngày 🔥💗');
    if (!streakPill || document.hidden) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    streakPill.classList.remove('celebrate');
    void streakPill.offsetWidth;
    streakPill.classList.add('celebrate');
    setTimeout(() => streakPill.classList.remove('celebrate'), 600);
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'streak-fly';
      s.textContent = i % 2 ? '💗' : '🔥';
      s.style.setProperty('--dx', ((i - 3.5) * 8) + 'px');
      s.style.animationDelay = (i * 40) + 'ms';
      streakPill.appendChild(s);
      setTimeout(() => s.remove(), 1100 + i * 40);
    }
  }

  async function refreshStreak() {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase.rpc('get_streak');
      if (error) throw error;
      if (!data) return;
      const prev = streakPrev;
      streakData = data;
      try { localStorage.setItem(STREAK_KEY, JSON.stringify(data)); } catch {}
      renderStreak();
      if (prev !== null && (data.current || 0) > prev) celebrateStreak(data.current);
      streakPrev = data.current || 0;
    } catch (err) {
      console.error('refreshStreak error:', err);
    }
  }

  function scheduleStreakRefresh() {
    clearTimeout(streakTimer);
    streakTimer = setTimeout(refreshStreak, 2000);
  }

  function loadStreakCache() {
    try {
      const c = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
      if (c && typeof c.current === 'number') {
        streakData = c;
        streakPrev = c.current;
        renderStreak();
      }
    } catch {}
  }

  function closeStreakSheet() {
    streakSheet?.classList.remove('open');
    streakBackdrop?.classList.remove('open');
  }
  streakPill?.addEventListener('click', () => {
    renderStreak();
    streakSheet?.classList.add('open');
    streakBackdrop?.classList.add('open');
  });
  streakClose?.addEventListener('click', closeStreakSheet);
  streakBackdrop?.addEventListener('click', closeStreakSheet);

  // ─── Banner + hoa rơi + thiệp (cấu hình hoàn toàn qua chat_settings) ──────────
  const BANNER_SEEN_KEY = 'dnc_banner_seen'; // `${banner_date}|${yyyy}` — pháo hoa/toast lặp theo năm hoặc khi đổi ngày
  const BANNER_CFG_KEY = 'dnc_banner_cfg_v1';
  // MỌI giá trị mặc định của dịp lễ chỉ nằm ở đây (DB thiếu cột/null → dùng; sửa/khôi phục được)
  const DEFAULT_BANNER = {
    text: '🌸 Chúc mừng 20/10 🌸 Chúc {tên} luôn xinh đẹp, hạnh phúc và được yêu thương thật nhiều 💐 Yêu {tên} nhiều lắm 💕',
    title: 'Chúc mừng 20/10 💐',
    headerTitle: '🌸 DiNhiChat 🌸',
    toast: 'Chúc mừng 20/10 💐',
    cardText: 'Nhân ngày Phụ nữ Việt Nam 20/10, chúc {tên} luôn xinh đẹp, rạng rỡ, vui vẻ và hạnh phúc mỗi ngày. Cảm ơn {tên} đã luôn ở đây 💐💕',
    fillText: 'Chúc mừng 20/10 nhaaa {tên} 💐🌸 Chúc {tên} luôn xinh đẹp, vui vẻ và hạnh phúc nhé, yêu {tên} nhiều lắm 💕',
    recipient: 'Vợ iu',
    emojis: '🌸 💐 🌷 🌹 ✨ 💗',
    color1: '#e91e63',
    color2: '#ff9ecb',
    date: '10-20',
    endDate: '',
    enabled: true,
    fireworks: true,
    falling: true,
    marqueeSpeed: 14
  };
  // Mẫu nhanh trong form: mỗi mẫu có ngày + câu chúc ({tên} = người nhận) + emoji + màu
  const BANNER_PRESETS = [
    { label: '20/10', date: '10-20', title: 'Chúc mừng 20/10 💐', card: 'Nhân ngày Phụ nữ Việt Nam 20/10, chúc {tên} luôn xinh đẹp, hạnh phúc và được yêu thương thật nhiều 💐', emojis: '🌸 💐 🌷 🌹 ✨ 💗', color: '#e91e63' },
    { label: '14/2', date: '02-14', title: 'Valentine 💗', card: 'Chúc {tên} một ngày Valentine ấm áp, nhiều chocolate và thật nhiều yêu thương 💕', emojis: '💗 💝 🌹 ✨ 💕', color: '#d81b60' },
    { label: '8/3', date: '03-08', title: 'Chúc mừng 8/3 🌸', card: 'Chúc {tên} ngày 8/3 thật vui, luôn rạng rỡ và hạnh phúc mỗi ngày 🌸', emojis: '🌸 🌷 💐 ✨', color: '#ad1457' },
    { label: '20/11', date: '11-20', title: 'Ngày 20/11 💐', card: 'Chúc {tên} ngày 20/11 tràn đầy niềm vui, sức khỏe và yêu thương 💐', emojis: '💐 🌸 ✨ 💗', color: '#7b1fa2' },
    { label: 'Sinh nhật', date: '', title: 'Sinh nhật {tên} 🎂', card: 'Chúc {tên} sinh nhật thật vui, mạnh khỏe và thực hiện được mọi ước mơ 🎂🎈', emojis: '🎂 🎈 🎁 ✨ 💗', color: '#f57c00' },
    { label: 'Kỷ niệm', date: '', title: 'Kỷ niệm yêu nhau 💑', card: 'Chúc {tên} kỷ niệm yêu nhau ấm áp, mãi nắm tay nhau đi hết những ngày phía trước 💕', emojis: '💗 💕 🌹 ✨ 💞', color: '#e91e63' },
    { label: 'Giáng sinh', date: '12-25', title: 'Giáng sinh an lành 🎄', card: 'Chúc {tên} Giáng sinh an lành, ấm áp bên gia đình và thật nhiều niềm vui 🎄✨', emojis: '🎄 ✨ ❄️ 💖 🌟', color: '#2e7d32' },
    { label: 'Tết', date: '01-01', title: 'Năm mới 🧧', card: 'Chúc {tên} năm mới thật nhiều sức khỏe, niềm vui, bình an và hạnh phúc 🧧🌸', emojis: '🧧 🌸 🎉 ✨ 💗', color: '#d32f2f' }
  ];
  // Chuỗi hợp lệ cho cột text (giữ null nếu trùng mặc định/rỗng — DB sẽ lấy mặc định)
  function bannerCfgFromCached(c) {
    const str = (v) => (typeof v === 'string' ? v : null);
    return {
      text: str(c.text), title: str(c.title), headerTitle: str(c.headerTitle),
      toast: str(c.toast), cardText: str(c.cardText), fillText: str(c.fillText),
      recipient: str(c.recipient), emojis: str(c.emojis),
      color1: str(c.color1), color2: str(c.color2),
      date: str(c.date) || DEFAULT_BANNER.date,
      endDate: str(c.endDate) || '',
      enabled: c.enabled !== false,
      fireworks: c.fireworks !== false,
      falling: c.falling !== false,
      marqueeSpeed: Math.min(40, Math.max(6, Number(c.marqueeSpeed) || DEFAULT_BANNER.marqueeSpeed))
    };
  }
  let bannerCfg = bannerCfgFromCached(DEFAULT_BANNER);
  try {
    const cachedCfg = lsGet(BANNER_CFG_KEY);
    if (cachedCfg && typeof cachedCfg === 'object') bannerCfg = bannerCfgFromCached(cachedCfg);
  } catch {}
  let festiveOn = false;
  let festiveHiddenSession = false;
  let festiveAnims = [];
  let festivePetalEls = [];
  let festivePetalSig = null;
  const festiveBanner = document.getElementById('festive-banner');
  const festiveTextA = document.getElementById('festive-text-a');
  const festiveTextB = document.getElementById('festive-text-b');
  const festiveLayer = document.getElementById('festive');
  const festiveOpenBtn = document.getElementById('festive-open');
  const festiveHideBtn = document.getElementById('festive-hide');
  const festiveBackdrop = document.getElementById('festive-backdrop');
  const festiveSheet = document.getElementById('festive-sheet');
  const festiveLong = document.getElementById('festive-long');
  const festiveSendBtn = document.getElementById('festive-send');
  const festiveCloseBtn = document.getElementById('festive-close');
  const festiveEditBtn = document.getElementById('festive-edit');
  const festiveTitleEl = document.querySelector('.festive-sheet .festive-title');
  const festiveTrackEl = document.querySelector('.festive-track');

  function vnDateString() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }

  // Khoảng ngày hiển thị (qua năm): [banner_date, banner_end_date]; end rỗng = đúng 1 ngày
  function inBannerRange(todayMMDD, start, end) {
    if (!start) return false;
    if (!end || end === start) return todayMMDD === start;
    if (start <= end) return todayMMDD >= start && todayMMDD <= end;
    return todayMMDD >= start || todayMMDD <= end; // bắt đầu > kết thúc → vắt qua năm
  }

  // Ngày banner hiển thị: hôm nay (giờ Asia/Ho_Chi_Minh) nằm trong khoảng + banner_enabled
  function isBannerDay() {
    try {
      if (new URLSearchParams(location.search).get('event') === '1') return true; // debug, không lưu
    } catch {}
    if (!bannerCfg.enabled) return false;
    return inBannerRange(vnDateString().slice(5), bannerCfg.date || DEFAULT_BANNER.date, bannerCfg.endDate || '');
  }

  // Thay {tên} = tên người nhận trong mọi nội dung hiển thị
  function bannerRecipient() {
    return (bannerCfg.recipient && bannerCfg.recipient.trim()) || DEFAULT_BANNER.recipient;
  }
  function bnText(s) {
    return String(s == null ? '' : s).split('{tên}').join(bannerRecipient());
  }
  function bnDefault(key) { return DEFAULT_BANNER[key]; }

  function bannerText() {
    return bnText((bannerCfg.text && bannerCfg.text.trim()) || DEFAULT_BANNER.text);
  }
  function bannerCardText() {
    return bnText((bannerCfg.cardText && bannerCfg.cardText.trim()) || DEFAULT_BANNER.cardText);
  }
  function bannerFillText() {
    return bnText((bannerCfg.fillText && bannerCfg.fillText.trim()) || DEFAULT_BANNER.fillText);
  }
  function bannerTitle() {
    return bnText((bannerCfg.title && bannerCfg.title.trim()) || DEFAULT_BANNER.title);
  }
  function bannerHeaderTitle() {
    // null = chưa có dữ liệu → mặc định; '' = người dùng tắt → không đổi tiêu đề
    return bnText(bannerCfg.headerTitle ?? DEFAULT_BANNER.headerTitle);
  }
  function bannerToastText() {
    // null = chưa có dữ liệu → mặc định; '' = tắt toast
    return bnText(bannerCfg.toast ?? DEFAULT_BANNER.toast);
  }
  function bannerEmojiList() {
    const src = (bannerCfg.emojis && bannerCfg.emojis.trim()) || DEFAULT_BANNER.emojis;
    const list = String(src).split(/\s+/).filter(Boolean);
    return list.length ? list : DEFAULT_BANNER.emojis.split(/\s+/).filter(Boolean);
  }

  function bannerRowToCfg(row) {
    // bannerCfgFromCached ép kiểu: cột không phải chuỗi/null → null (lấy mặc định)
    return bannerCfgFromCached({
      text: row?.banner_text, title: row?.banner_title, headerTitle: row?.banner_header_title,
      toast: row?.banner_toast, cardText: row?.banner_card_text, fillText: row?.banner_fill_text,
      recipient: row?.banner_recipient, emojis: row?.banner_emojis,
      color1: row?.banner_color1, color2: row?.banner_color2,
      date: row?.banner_date, endDate: row?.banner_end_date,
      enabled: row?.banner_enabled, fireworks: row?.banner_fireworks,
      falling: row?.banner_falling, marqueeSpeed: row?.banner_marquee_speed
    });
  }

  // Áp cấu hình banner (từ server/realtime/editor) + cache; ngày/khoảng đổi → tính lại
  function applyBannerRow(row, persistCache) {
    const prev = bannerCfg;
    bannerCfg = bannerRowToCfg(row);
    if (persistCache) lsSet(BANNER_CFG_KEY, bannerCfg);
    const dayChanged = prev.date !== bannerCfg.date || prev.endDate !== bannerCfg.endDate ||
      prev.enabled !== bannerCfg.enabled;
    applyBannerTexts();
    applyBannerColors();
    applyMarqueeSpeed();
    if (dayChanged) checkFestive();
    ensureFestiveFlowers();
  }

  // Màu gradient banner/nút: từ cấu hình (mặc định hồng); mode tối → trộn 25% đen
  function bnColor(v, fallback) {
    return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : fallback;
  }
  function bnMixBlack(hex, ratio) {
    try {
      const n = parseInt(hex.slice(1), 16);
      const f = 1 - ratio;
      return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        .map((v) => Math.round(v * f).toString(16).padStart(2, '0')).join('');
    } catch { return hex; }
  }
  function applyBannerColors() {
    try {
      const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      let c1 = bnColor(bannerCfg.color1, DEFAULT_BANNER.color1);
      let c2 = bnColor(bannerCfg.color2, DEFAULT_BANNER.color2);
      if (dark) { c1 = bnMixBlack(c1, .25); c2 = bnMixBlack(c2, .25); }
      document.documentElement.style.setProperty('--bn-c1', c1);
      document.documentElement.style.setProperty('--bn-c2', c2);
    } catch {}
  }

  // Tốc độ chữ chạy (6-40 giây) áp cho .festive-track
  function applyMarqueeSpeed() {
    try {
      const sp = Math.min(40, Math.max(6, Number(bannerCfg.marqueeSpeed) || DEFAULT_BANNER.marqueeSpeed));
      if (festiveTrackEl) festiveTrackEl.style.animationDuration = sp + 's';
    } catch {}
  }

  async function refreshBannerFromServer() {
    try {
      const { data, error } = await supabase.from('chat_settings')
        .select('banner_text,banner_title,banner_header_title,banner_toast,banner_card_text,banner_fill_text,banner_recipient,banner_emojis,banner_color1,banner_color2,banner_date,banner_end_date,banner_enabled,banner_fireworks,banner_falling,banner_marquee_speed')
        .eq('id', 1).maybeSingle();
      if (error || !data) return;
      applyBannerRow(data, true);
    } catch {}
  }

  function festiveReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  // Render nội dung banner bằng textContent (chống XSS); lặp 2 lần trong markup cho marquee liền
  function applyBannerTexts() {
    const txt = bannerText();
    if (festiveTextA && festiveTextA.textContent !== txt) festiveTextA.textContent = txt;
    if (festiveTextB && festiveTextB.textContent !== txt) festiveTextB.textContent = txt;
    if (festiveLong) festiveLong.textContent = bannerCardText();
    const cardTitle = bannerTitle();
    if (festiveTitleEl && festiveTitleEl.textContent !== cardTitle) festiveTitleEl.textContent = cardTitle;
  }

  function applyFestive() {
    const show = festiveOn && !festiveHiddenSession;
    if (festiveBanner && show && festiveBanner.hidden) {
      festiveBanner.classList.add('festive-enter');
      setTimeout(() => festiveBanner?.classList.remove('festive-enter'), 400);
    }
    if (festiveBanner) festiveBanner.hidden = !show;
    // Hoa rơi chạy MỖI NGÀY: lớp chỉ ẩn khi reduced-motion (không phụ thuộc ngày banner)
    if (festiveLayer) festiveLayer.hidden = festiveReducedMotion();
    // Tiêu đề header trong ngày: null → mặc định, chuỗi rỗng = không đổi
    const headTitle = festiveOn ? bannerHeaderTitle() : '';
    if (chatTitle) chatTitle.textContent = headTitle || (currentProfile?.name || 'DiNhiChat');
    applyBannerTexts();
    applyBannerColors();
    applyMarqueeSpeed();
  }

  // Kế hoạch hoa: ngày lễ đầy đủ (14 nụ, theo banner_falling), ngày thường nhẹ (8 nụ)
  function festiveFlowerPlan() {
    const list = bannerEmojiList();
    if (isBannerDay() && bannerCfg.falling !== false) {
      return { list, count: 14, sizeMin: 14, sizeMax: 26, opacity: .85, durMin: 8000, durRange: 6000, swayMin: 20, swayRange: 30 };
    }
    return { list, count: 8, sizeMin: 12, sizeMax: 20, opacity: .6, durMin: 10000, durRange: 6000, swayMin: 10, swayRange: 12 };
  }

  // Tái sử dụng phần tử hoa: chỉ dựng lại khi số lượng/kiểu ngày/emoji đổi (giữ pháo hoa tạm)
  function ensureFestiveFlowers() {
    if (!festiveLayer) return;
    if (festiveReducedMotion()) { stopFestiveFall(); festiveLayer.hidden = true; return; }
    festiveLayer.hidden = false;
    const plan = festiveFlowerPlan();
    const sig = plan.count + ':' + plan.opacity + ':' + plan.list.join('');
    if (sig === festivePetalSig && festivePetalEls.length === plan.count &&
        festivePetalEls.every((el) => el.isConnected)) return;
    festiveAnims.forEach((a) => { try { a.cancel(); } catch {} });
    festiveAnims = [];
    festivePetalEls.forEach((el) => el.remove());
    festivePetalEls = [];
    festivePetalSig = sig;
    for (let i = 0; i < plan.count; i++) {
      const s = document.createElement('span');
      s.className = 'festive-petal';
      s.textContent = plan.list[i % plan.list.length];
      s.style.fontSize = (plan.sizeMin + Math.round(Math.random() * (plan.sizeMax - plan.sizeMin))) + 'px';
      s.style.left = (Math.random() * 100) + '%';
      festiveLayer.appendChild(s);
      festivePetalEls.push(s);
      const dur = plan.durMin + Math.random() * plan.durRange;
      const sway = plan.swayMin + Math.random() * plan.swayRange;
      try {
        const anim = s.animate([
          { transform: 'translate3d(0,-60px,0) rotate(0deg)', opacity: 0 },
          { opacity: plan.opacity, offset: .08 },
          { transform: 'translate3d(' + sway + 'px,50vh,0) rotate(120deg)', opacity: plan.opacity, offset: .5 },
          { transform: 'translate3d(' + (-sway) + 'px,105vh,0) rotate(240deg)', opacity: 0 }
        ], { duration: dur, delay: -Math.random() * dur, iterations: Infinity });
        festiveAnims.push(anim);
      } catch {}
    }
  }

  function stopFestiveFall() {
    festiveAnims.forEach((a) => { try { a.cancel(); } catch {} });
    festiveAnims = [];
    festivePetalEls.forEach((el) => el.remove());
    festivePetalEls = [];
    festivePetalSig = null;
    if (festiveLayer) festiveLayer.textContent = '';
  }

  function festiveFireworks() {
    if (!festiveLayer || festiveReducedMotion() || document.hidden) return;
    const rect = festiveLayer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.4;
    const glyphs = bannerEmojiList();
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span');
      s.className = 'festive-petal';
      s.style.opacity = '1';
      s.textContent = glyphs[i % glyphs.length];
      s.style.fontSize = (12 + Math.round(Math.random() * 10)) + 'px';
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      festiveLayer.appendChild(s);
      const ang = (i / 24) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 90 + Math.random() * 130;
      const dx = Math.cos(ang) * dist;
      try {
        const anim = s.animate([
          { transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + Math.round(dx) + 'px), calc(-50% - ' + Math.round(Math.abs(Math.sin(ang)) * 60 + 40) + 'px)) scale(1.1)', opacity: 1, offset: .45 },
          { transform: 'translate(calc(-50% + ' + Math.round(dx * 1.1) + 'px), calc(-50% + 220px)) scale(.9)', opacity: 0 }
        ], { duration: 2500, easing: 'cubic-bezier(.2,.7,.3,1)' });
        anim.onfinish = () => s.remove();
      } catch { s.remove(); }
    }
  }

  function showFestiveToast(text, duration = 3000) {
    try {
      document.querySelector('.festive-toast')?.remove();
      const toast = document.createElement('div');
      toast.className = 'festive-toast';
      toast.textContent = text;
      (document.getElementById('app') || document.body).appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    } catch {}
  }

  function maybeFestiveFireworks() {
    if (!festiveOn) return;
    // Lần đầu mở app theo (banner_date|năm): lặp lại mỗi năm hoặc khi đổi ngày cấu hình
    const seenVal = (bannerCfg.date || DEFAULT_BANNER.date) + '|' + new Date().getFullYear();
    let firstOpen = false;
    try {
      if (chatScreen && !chatScreen.classList.contains('active')) return;
      if (localStorage.getItem(BANNER_SEEN_KEY) !== seenVal) {
        localStorage.setItem(BANNER_SEEN_KEY, seenVal);
        firstOpen = true;
      }
    } catch {}
    if (!firstOpen) return;
    if (bannerCfg.fireworks !== false) festiveFireworks();
    const toast = bannerToastText(); // '' = không hiện
    if (toast) showFestiveToast(toast);
  }

  function checkFestive() {
    const on = isBannerDay();
    if (on === festiveOn) {
      if (on) applyFestive();
      ensureFestiveFlowers(); // hoa chạy mọi ngày, kể cả khi không có banner
      return;
    }
    festiveOn = on;
    applyFestive();
    ensureFestiveFlowers();
    if (on) maybeFestiveFireworks();
    else closeFestiveSheet();
  }

  function openFestiveSheet() {
    if (festiveLong) festiveLong.textContent = bannerCardText();
    festiveBackdrop?.classList.add('open');
    festiveSheet?.classList.add('open');
  }

  function closeFestiveSheet() {
    festiveBackdrop?.classList.remove('open');
    festiveSheet?.classList.remove('open');
  }

  festiveOpenBtn?.addEventListener('click', openFestiveSheet);
  festiveHideBtn?.addEventListener('click', () => {
    festiveHiddenSession = true;
    if (festiveBanner) festiveBanner.hidden = true;
  });
  festiveBackdrop?.addEventListener('click', closeFestiveSheet);
  festiveCloseBtn?.addEventListener('click', closeFestiveSheet);
  festiveSendBtn?.addEventListener('click', () => {
    if (messageInput) {
      messageInput.value = bannerFillText();
      try { resizeMessageInput(); updateSendButtonVisibility(); } catch {}
      try { messageInput.focus({ preventScroll: true }); } catch { try { messageInput.focus(); } catch {} }
    }
    closeFestiveSheet();
  });

  // ─── Sửa banner (nút ✏️ trong thiệp) ─────────────────────────────────────────
  const bannerEditor = document.getElementById('banner-editor');
  const beText = document.getElementById('be-text');
  const beCard = document.getElementById('be-card');
  const beFill = document.getElementById('be-fill');
  const beTextCount = document.getElementById('be-text-count');
  const beCardCount = document.getElementById('be-card-count');
  const beFillCount = document.getElementById('be-fill-count');
  const beMonth = document.getElementById('be-month');
  const beDay = document.getElementById('be-day');
  const beEnabled = document.getElementById('be-enabled');
  const beDefaultsBtn = document.getElementById('be-defaults');
  const bePreviewBtn = document.getElementById('be-preview');
  const beSaveBtn = document.getElementById('be-save');
  const beCloseBtn = document.getElementById('be-close');
  const beEmojiRow = document.getElementById('be-emoji');
  const beTitle = document.getElementById('be-title');
  const beHeader = document.getElementById('be-header');
  const beToast = document.getElementById('be-toast');
  const beRecipient = document.getElementById('be-recipient');
  const beEmojis = document.getElementById('be-emojis');
  const beColor1 = document.getElementById('be-color1');
  const beColor2 = document.getElementById('be-color2');
  const beColor1Code = document.getElementById('be-color1-code');
  const beColor2Code = document.getElementById('be-color2-code');
  const beMonth2 = document.getElementById('be-month2');
  const beDay2 = document.getElementById('be-day2');
  const beFireworks = document.getElementById('be-fireworks');
  const beFalling = document.getElementById('be-falling');
  const beSpeed = document.getElementById('be-speed');
  const beSpeedLabel = document.getElementById('be-speed-label');
  const bePresets = document.getElementById('be-presets');
  let bannerEditorDirty = false;
  let bannerSavedCfg = null; // cfg trước khi Xem thử (phục hồi khi bỏ thay đổi)
  let beFocusTarget = null;  // ô input/textarea đang focus để chèn emoji tại con trỏ

  function beDateVal(monthSel, daySel, required) {
    if (!required && (!monthSel.value || !daySel.value)) return '';
    return String(monthSel.value).padStart(2, '0') + '-' + String(daySel.value).padStart(2, '0');
  }

  function beFormSnapshot() {
    return {
      text: beText.value, title: beTitle.value, headerTitle: beHeader.value,
      toast: beToast.value, cardText: beCard.value, fillText: beFill.value,
      recipient: beRecipient.value, emojis: beEmojis.value,
      color1: beColor1.value, color2: beColor2.value,
      date: beDateVal(beMonth, beDay, true),
      endDate: beDateVal(beMonth2, beDay2, false),
      enabled: beEnabled.checked, fireworks: beFireworks.checked, falling: beFalling.checked,
      marqueeSpeed: Number(beSpeed.value) || DEFAULT_BANNER.marqueeSpeed
    };
  }

  function beSetCounters() {
    if (beTextCount) beTextCount.textContent = beText.value.length + '/200';
    if (beCardCount) beCardCount.textContent = beCard.value.length + '/500';
    if (beFillCount) beFillCount.textContent = beFill.value.length + '/200';
    if (beSpeedLabel) beSpeedLabel.textContent = (beSpeed.value || '14') + ' giây';
    if (beColor1Code) beColor1Code.textContent = String(beColor1.value || '').toUpperCase();
    if (beColor2Code) beColor2Code.textContent = String(beColor2.value || '').toUpperCase();
  }

  function beApplyFormToUi() {
    // Xem thử: áp lên banner/thiệp/hoa/header NGAY, chưa lưu DB
    const f = beFormSnapshot();
    bannerCfg = bannerCfgFromCached({
      text: f.text.trim() || null, title: f.title.trim() || null,
      headerTitle: f.headerTitle, toast: f.toast, // '' = tắt, null = mặc định
      cardText: f.cardText.trim() || null, fillText: f.fillText.trim() || null,
      recipient: f.recipient.trim() || null, emojis: f.emojis.trim() || null,
      color1: f.color1, color2: f.color2,
      date: f.date, endDate: f.endDate,
      enabled: f.enabled, fireworks: f.fireworks, falling: f.falling,
      marqueeSpeed: f.marqueeSpeed
    });
    applyBannerTexts();
    applyBannerColors();
    applyMarqueeSpeed();
    checkFestive();
    ensureFestiveFlowers();
  }

  // Điền form từ 1 cfg (mở form / Khôi phục mặc định / mẫu nhanh)
  function beSetDateFields(cfg) {
    const p = String(cfg.date || DEFAULT_BANNER.date).split('-');
    beMonth.value = String(parseInt(p[0], 10) || 10);
    beDay.value = String(parseInt(p[1], 10) || 20);
    if (cfg.endDate) {
      const e = String(cfg.endDate).split('-');
      beMonth2.value = String(parseInt(e[0], 10) || '');
      beDay2.value = String(parseInt(e[1], 10) || '');
    } else {
      beMonth2.value = '';
      beDay2.value = '';
    }
  }

  function beSetFields(cfg) {
    const or = (v, k) => (typeof v === 'string' ? v : DEFAULT_BANNER[k]);
    beText.value = or(cfg.text, 'text');
    beTitle.value = or(cfg.title, 'title');
    beHeader.value = cfg.headerTitle ?? DEFAULT_BANNER.headerTitle; // '' = tắt, giữ nguyên
    beToast.value = cfg.toast ?? DEFAULT_BANNER.toast;             // '' = tắt, giữ nguyên
    beCard.value = or(cfg.cardText, 'cardText');
    beFill.value = or(cfg.fillText, 'fillText');
    beRecipient.value = cfg.recipient ?? DEFAULT_BANNER.recipient;
    beEmojis.value = or(cfg.emojis, 'emojis');
    beColor1.value = bnColor(cfg.color1, DEFAULT_BANNER.color1);
    beColor2.value = bnColor(cfg.color2, DEFAULT_BANNER.color2);
    beSetDateFields(cfg);
    beEnabled.checked = cfg.enabled !== false;
    beFireworks.checked = cfg.fireworks !== false;
    beFalling.checked = cfg.falling !== false;
    beSpeed.value = String(Math.min(40, Math.max(6, Number(cfg.marqueeSpeed) || DEFAULT_BANNER.marqueeSpeed)));
    beSetCounters();
  }

  function openBannerEditor() {
    if (!bannerEditor) return;
    beSetFields(bannerCfg);
    bannerSavedCfg = bannerCfg;
    bannerEditorDirty = false;
    bannerEditor.hidden = false;
    closeFestiveSheet();
  }

  function closeBannerEditor(force) {
    if (!bannerEditor) return;
    if (!force && bannerEditorDirty && !confirm('Bỏ thay đổi?')) return;
    // Đã bấm Xem thử → đưa banner về cấu hình đã lưu
    if (bannerSavedCfg) {
      bannerCfg = bannerSavedCfg;
      applyBannerTexts(); applyBannerColors(); applyMarqueeSpeed();
      checkFestive(); ensureFestiveFlowers();
    }
    bannerSavedCfg = null;
    bannerEditorDirty = false;
    bannerEditor.hidden = true;
  }

  async function saveBannerEditor() {
    if (!beSaveBtn) return;
    const f = beFormSnapshot();
    const def = DEFAULT_BANNER;
    // text-like: rỗng/trùng mặc định → null (null = dùng DEFAULT_BANNER)
    const txtOr = (v, d) => { const s = String(v || '').trim(); return (!s || s === String(d).trim()) ? null : v; };
    // tùy chọn (header/toast): trùng mặc định → null, '' giữ nguyên = tắt
    const optOr = (v, d) => { const s = String(v || '').trim(); return (s === String(d).trim()) ? null : v; };
    const payload = {
      banner_text: txtOr(f.text, def.text),
      banner_title: txtOr(f.title, def.title),
      banner_header_title: optOr(f.headerTitle, def.headerTitle),
      banner_toast: optOr(f.toast, def.toast),
      banner_card_text: txtOr(f.cardText, def.cardText),
      banner_fill_text: txtOr(f.fillText, def.fillText),
      banner_recipient: txtOr(f.recipient, def.recipient),
      banner_emojis: txtOr(f.emojis, def.emojis),
      banner_color1: txtOr(f.color1, def.color1),
      banner_color2: txtOr(f.color2, def.color2),
      banner_date: f.date,
      banner_end_date: f.endDate || null,
      banner_enabled: f.enabled,
      banner_fireworks: f.fireworks,
      banner_falling: f.falling,
      banner_marquee_speed: f.marqueeSpeed
    };
    const oldLabel = beSaveBtn.textContent;
    beSaveBtn.disabled = true;
    beSaveBtn.textContent = 'Đang lưu…';
    try {
      const { error } = await supabase.from('chat_settings').update(payload).eq('id', 1);
      if (error) throw error;
      applyBannerRow(payload, true);
      bannerSavedCfg = bannerCfg;
      bannerEditorDirty = false;
      showAppToast('Đã lưu banner 💕');
      bannerEditor.hidden = true;
    } catch (err) {
      console.error('Lưu banner lỗi:', err);
      showAppToast('Lưu thất bại, thử lại nhé');
    } finally {
      beSaveBtn.disabled = false;
      beSaveBtn.textContent = oldLabel;
    }
  }

  festiveEditBtn?.addEventListener('click', openBannerEditor);
  // Vào từ bảng ➕: banner ẩn (ngoài ngày đặt) vẫn mở được form sửa
  document.getElementById('btn-banner-edit')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeFuncPanel();
    openBannerEditor();
  });
  beCloseBtn?.addEventListener('click', () => closeBannerEditor(false));
  bePreviewBtn?.addEventListener('click', beApplyFormToUi);
  beSaveBtn?.addEventListener('click', saveBannerEditor);
  beDefaultsBtn?.addEventListener('click', () => {
    // Đặt toàn bộ ô về giá trị mặc định (lưu → cột text thành null)
    beSetFields(DEFAULT_BANNER);
    bannerEditorDirty = true;
  });

  const beTextFields = [beText, beTitle, beHeader, beToast, beCard, beFill, beRecipient, beEmojis];
  beTextFields.forEach((el) => {
    el?.addEventListener('focus', () => { beFocusTarget = el; });
    el?.addEventListener('input', () => { bannerEditorDirty = true; beSetCounters(); });
  });
  [beColor1, beColor2, beSpeed].forEach((el) => el?.addEventListener('input', () => {
    bannerEditorDirty = true;
    beSetCounters();
  }));
  [beEnabled, beFireworks, beFalling, beColor1, beColor2].forEach((el) =>
    el?.addEventListener('change', () => { bannerEditorDirty = true; }));
  // Ngày bắt đầu / ngày kết thúc: tháng đổi → chặn ngày vượt tháng
  [[beMonth, beDay], [beMonth2, beDay2]].forEach(([mSel, dSel]) => {
    mSel?.addEventListener('change', () => {
      bannerEditorDirty = true;
      const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(mSel.value) - 1] || 31;
      if (Number(dSel.value) > maxDay) dSel.value = String(maxDay);
    });
    dSel?.addEventListener('change', () => { bannerEditorDirty = true; });
  });
  // Hàng gợi ý emoji (mọi ô trong form): chèn tại con trỏ của ô đang focus (setRangeText)
  bannerEditor?.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-emoji]');
    if (!btn) return;
    const target = beFocusTarget || beEmojis;
    const emoji = btn.getAttribute('data-emoji') || '';
    try {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      target.setRangeText(emoji, start, end, 'preserve');
    } catch { target.value += emoji; }
    try { target.focus({ preventScroll: true }); } catch {}
    bannerEditorDirty = true;
    beSetCounters();
  });

  // Mẫu nhanh: 1 chạm điền sẵn toàn bộ ô (chưa lưu)
  if (bePresets) {
    BANNER_PRESETS.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'be-preset';
      b.dataset.idx = String(i);
      b.textContent = p.label;
      bePresets.appendChild(b);
    });
    bePresets.addEventListener('click', (event) => {
      const b = event.target.closest?.('[data-idx]');
      if (!b) return;
      const p = BANNER_PRESETS[Number(b.dataset.idx)];
      if (!p) return;
      const keepRecipient = beRecipient.value;
      beSetFields(Object.assign({}, DEFAULT_BANNER, {
        date: p.date || vnDateString().slice(5), // mẫu không cố định ngày → hôm nay (sửa tay được)
        title: p.title, cardText: p.card, emojis: p.emojis, color1: p.color,
        recipient: keepRecipient || DEFAULT_BANNER.recipient
      }));
      bannerEditorDirty = true;
      try { navigator.vibrate?.(10); } catch {}
    });
  }

  // Áp màu/tốc độ ngay khi tải trang (kể cả khi chưa tới ngày banner)
  applyBannerColors();
  applyMarqueeSpeed();
  if (beRecipient && !beRecipient.placeholder) beRecipient.placeholder = DEFAULT_BANNER.recipient;

  document.addEventListener('visibilitychange', () => {
    try { document.body.classList.toggle('festive-paused', document.hidden); } catch {}
    if (document.hidden) festiveAnims.forEach((a) => { try { a.pause(); } catch {} });
    else {
      festiveAnims.forEach((a) => { try { a.play(); } catch {} });
      checkFestive();
    }
  });
  setInterval(() => { if (document.visibilityState === 'visible') checkFestive(); }, 60000);

  // ─── Visibility / focus sync ──────────────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
      resetToNativeKeyboard();
      syncMessages();
      markRead();
      checkNotificationStatus();
      ensurePush();
      refreshPeerPushStatus();
      refreshCoverFromServer();
      refreshBannerFromServer();
      scheduleStreakRefresh();
    } else if (document.visibilityState === 'hidden') {
      sendStopTyping();
    }
  });
  window.addEventListener('pageshow', () => { resetToNativeKeyboard(); if (currentUser) { syncMessages(); markRead(); checkNotificationStatus(); ensurePush(); refreshPeerPushStatus(); refreshCoverFromServer(); refreshBannerFromServer(); } });
  window.addEventListener('focus', () => { if (currentUser) { syncMessages(); markRead(); } });
  setInterval(() => {
    if (document.visibilityState === 'visible') ensurePush();
  }, 30 * 60 * 1000);

  // ─── Lịch trực điều dưỡng ───────────────────────────────────────────────────
  const DUTY_DEFAULTS = {
    pattern: 'HC,HC,TRUC,NGHI',
    owner_name: null,
    hc_time: '07:00-16:30',
    truc_time: '07:00-07:00 (24h)'
  };
  const DUTY_DEFAULT_ANCHOR = { start_date: '2026-11-02', shift_index: 2 }; // dự phòng khi chưa nạp được duty_anchors
  const DUTY_SHIFTS = {
    HC: { label: 'Hành chính', tag: 'HC', icon: '☀️', color: '#1e88e5' },
    TRUC: { label: 'Trực', tag: 'TRỰC', icon: '🌙', color: '#e53935' },
    NGHI: { label: 'Nghỉ', tag: 'NGHỈ', icon: '🛌', color: '#43a047' },
    PHEP: { label: 'Phép', tag: 'PHÉP', icon: '🏖️', color: '#8e24aa' },
    TRUC_BU: { label: 'Trực bù', tag: 'BÙ', icon: '💉', color: '#fb8c00' },
    KHAC: { label: 'Khác', tag: 'KHÁC', icon: '🏥', color: '#757575' }
  };
  const DUTY_ORDER = ['HC', 'TRUC', 'NGHI', 'PHEP', 'TRUC_BU', 'KHAC'];
  const DUTY_WD = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const DUTY_WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const dutyScreen = document.getElementById('duty-screen');
  const dutyTitle = document.getElementById('duty-title');
  const dutyTodayShift = document.getElementById('duty-today-shift');
  const dutyTodayTime = document.getElementById('duty-today-time');
  const dutyTodayNext = document.getElementById('duty-today-next');
  const dutyTodayRest = document.getElementById('duty-today-rest');
  const dutyChips = document.getElementById('duty-chips');
  const dutyGrid = document.getElementById('duty-grid');
  const dutyMonthTitle = document.getElementById('duty-month-title');
  const dutyLegend = document.getElementById('duty-legend');
  const dutyStats = document.getElementById('duty-stats');
  const dutyDaySheet = document.getElementById('duty-day-sheet');
  const dutyDayBackdrop = document.getElementById('duty-day-backdrop');
  const dutyDayTitle = document.getElementById('duty-day-title');
  const dutyDaySub = document.getElementById('duty-day-sub');
  const dutyDayShift = document.getElementById('duty-day-shift');
  const dutyDayNote = document.getElementById('duty-day-note');
  const dutyDayCount = document.getElementById('duty-day-count');
  const dutySetSheet = document.getElementById('duty-set-sheet');
  const dutySetBackdrop = document.getElementById('duty-set-backdrop');
  const dutyRotSheet = document.getElementById('duty-rot-sheet');
  const dutyRotBackdrop = document.getElementById('duty-rot-backdrop');
  const dutyRotDate = document.getElementById('duty-rot-date');
  const dutyRotShifts = document.getElementById('duty-rot-shifts');
  const dutyRotNote = document.getElementById('duty-rot-note');
  const dutyRotCount = document.getElementById('duty-rot-count');
  const dutyRotPreview = document.getElementById('duty-rot-preview');
  const dutyRotHist = document.getElementById('duty-rot-hist');

  let dutyOpen = false;
  let dutyWasPink = false;
  let dutyCfg = { ...DUTY_DEFAULTS };
  let dutyCfgLoaded = false;
  let dutyOv = new Map();      // 'yyyy-mm-dd' → row override (tháng đang xem)
  let dutyOvMonth = '';
  let dutyMonth = '';          // 'yyyy-mm' đang xem
  let dutyDay = '';            // ngày đang mở sheet
  let dutyAnchors = [];        // [{start_date, shift_index, note}] tăng dần — các mốc "đổi tua"
  let dutyAnchorsLoaded = false;
  let dutyRotIdx = 2;          // ca đang chọn ở sheet Đổi tua (1=HC1, 2=HC2, 3=Trực, 4=Nghỉ)
  let dutyChannel = null;
  let dutyTick = null;         // đồng hồ đếm giờ hết ca trực

  // ── Ngày tháng trên UTC (yyyy-mm-dd) → không lệch giờ/DST, đúng cả qua năm ──
  function dutyUtc(dateStr) {
    const p = String(dateStr).split('-').map(Number);
    return Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1);
  }
  function dutyAddDays(dateStr, n) {
    return new Date(dutyUtc(dateStr) + n * 86400000).toISOString().slice(0, 10);
  }
  function dutyDiffDays(a, b) {
    return Math.round((dutyUtc(a) - dutyUtc(b)) / 86400000);
  }
  function dutyNowVn() { // giờ VN = UTC+7 (không DST) → getter UTC = giờ VN
    return new Date(Date.now() + 7 * 3600000);
  }
  function dutyWdIdx(dateStr) { return new Date(dutyUtc(dateStr)).getUTCDay(); }
  function dutyWdName(dateStr) { return DUTY_WD[dutyWdIdx(dateStr)]; }
  function dutyFmtDM(dateStr) { return dateStr.slice(8, 10) + '/' + dateStr.slice(5, 7); }
  function dutyPattern() {
    const parts = String(dutyCfg.pattern || DUTY_DEFAULTS.pattern)
      .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    return parts.length ? parts : DUTY_DEFAULTS.pattern.split(',');
  }

  // ── Mốc "tua": mốc lớn nhất ≤ ngày; trước mốc đầu → tính ngược từ mốc đầu tiên ──
  function dutyAnchorFor(dateStr) {
    if (!dutyAnchors.length) return DUTY_DEFAULT_ANCHOR;
    let found = null;
    for (const a of dutyAnchors) {
      if (String(a.start_date) <= dateStr) found = a; else break; // danh sách đã sort tăng dần
    }
    return found || dutyAnchors[0];
  }

  // ── Quy luật ca: idx = ((shift_index-1) + (ngày - mốc)) mod n (mod dương, Date.UTC) ──
  // 0=HC1, 1=HC2, 2=Trực, 3=Nghỉ; mốc trước giữ nguyên, mốc sau tính lại từ mốc mới
  function dutyInfo(dateStr) {
    const pattern = dutyPattern();
    const n = pattern.length;
    const a = dutyAnchorFor(dateStr);
    const diff = dutyDiffDays(dateStr, a.start_date); // âm nếu trước mốc đầu (tính ngược)
    const base = Math.min(Math.max(Number(a.shift_index) || 1, 1), n) - 1;
    const idx = ((((base + diff) % n) + n) % n);
    const raw = pattern[idx] || 'HC';
    const code = DUTY_SHIFTS[raw] ? raw : 'KHAC';
    // "ngày 2/2" = ngày thứ mấy trong số ngày cùng ca này của chu kỳ (HC1/HC2 → 2/2)
    const cnt = pattern.filter((p) => p === raw).length;
    const ord = pattern.slice(0, idx + 1).filter((p) => p === raw).length;
    return { code, idx, dayNo: idx + 1, len: n, cnt, ord, meta: DUTY_SHIFTS[code] };
  }
  function getShift(dateStr) { return dutyInfo(dateStr).code; } // dùng cho test console
  function dutyShiftOf(dateStr) { // override (điều chỉnh) thắng chu kỳ
    const ov = dutyOv.get(dateStr);
    if (ov && DUTY_SHIFTS[ov.shift]) return ov.shift;
    return getShift(dateStr);
  }
  window.__duty = { getShift, dutyInfo, dutyShiftOf, DUTY_SHIFTS, anchorFor: dutyAnchorFor, anchors: () => dutyAnchors }; // hook test console

  // ── Nạp dữ liệu: cache localStorage + fetch, realtime giữ mới ──
  async function loadDutyCfg(force) {
    if (!force) {
      if (dutyCfgLoaded) return;
      const cached = lsGet('dnc_duty_cfg_v1');
      if (cached) { dutyCfg = { ...DUTY_DEFAULTS, ...cached }; dutyCfgLoaded = true; }
    }
    try {
      const { data, error } = await supabase.from('duty_settings').select('*').eq('id', 1).single();
      if (!error && data) {
        dutyCfg = {
          pattern: data.pattern || DUTY_DEFAULTS.pattern,
          owner_name: data.owner_name || null,
          hc_time: data.hc_time ?? DUTY_DEFAULTS.hc_time,
          truc_time: data.truc_time ?? DUTY_DEFAULTS.truc_time
        };
        dutyCfgLoaded = true;
        lsSet('dnc_duty_cfg_v1', dutyCfg);
      }
    } catch {}
  }

  async function loadDutyOverrides(month, skipCache) {
    if (!month) return;
    if (!skipCache && dutyOvMonth !== month) {
      try {
        const cached = lsGet('dnc_duty_ov_v1');
        if (cached && cached.month === month) {
          dutyOv = new Map((cached.rows || []).map((r) => [r.day, r]));
          dutyOvMonth = month;
        }
      } catch {}
    }
    try {
      const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const { data, error } = await supabase.from('duty_overrides').select('*')
        .gte('day', month + '-01')
        .lte('day', month + '-' + String(last).padStart(2, '0'));
      if (!error) {
        dutyOv = new Map((data || []).map((r) => [r.day, r]));
        dutyOvMonth = month;
        lsSet('dnc_duty_ov_v1', { month, rows: data || [] });
      }
    } catch {}
  }

  async function loadDutyAnchors(force) {
    if (!force) {
      if (dutyAnchorsLoaded) return;
      try {
        const cached = lsGet('dnc_duty_anchors_v1');
        if (Array.isArray(cached) && cached.length) { dutyAnchors = cached; dutyAnchorsLoaded = true; }
      } catch {}
    }
    try {
      const { data, error } = await supabase.from('duty_anchors').select('*').order('start_date');
      if (!error && data) {
        dutyAnchors = data.slice().sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
        dutyAnchorsLoaded = true;
        lsSet('dnc_duty_anchors_v1', dutyAnchors);
      }
    } catch {}
  }

  // ── Vẽ ──
  function dutyOwnerName() {
    return (dutyCfg.owner_name || '').trim() || getPeerProfile()?.name || 'bạn';
  }

  function dutyNextTruc(from) {
    for (let i = 1; i <= 30; i++) {
      const d = dutyAddDays(from, i);
      const c = dutyShiftOf(d);
      if (c === 'TRUC' || c === 'TRUC_BU') return d;
    }
    return null;
  }

  function dutyTrucRemaining() {
    const now = dutyNowVn();
    const mm = String(dutyCfg.truc_time || DUTY_DEFAULTS.truc_time)
      .match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    let startMin = 7 * 60, endMin = 7 * 60;
    if (mm) { startMin = Number(mm[1]) * 60 + Number(mm[2]); endMin = Number(mm[3]) * 60 + Number(mm[4]); }
    let dur = endMin - startMin;
    if (dur <= 0) dur += 1440; // ca 24h: hết ca hôm sau
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      Math.floor(startMin / 60), startMin % 60);
    const left = start + dur * 60000 - now.getTime();
    if (left <= 0) return 'Ca trực đã kết thúc';
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
    return `Đang trực 🌙 — còn ${h}g ${m}p tới hết ca`;
  }

  function dutyTickStart() {
    dutyTickStop();
    const upd = () => { if (dutyOpen) dutyTodayNext.textContent = dutyTrucRemaining(); };
    upd();
    dutyTick = setInterval(upd, 60000);
  }
  function dutyTickStop() { if (dutyTick) { clearInterval(dutyTick); dutyTick = null; } }

  function renderDutyToday() {
    const today = vnDateString();
    const info = dutyInfo(today);
    const code = dutyShiftOf(today);
    const meta = DUTY_SHIFTS[code];
    dutyTitle.textContent = `🩺 Lịch trực của ${dutyOwnerName()}`;
    dutyTodayShift.replaceChildren();
    const ico = document.createElement('span');
    ico.className = 'duty-today-ico';
    ico.textContent = meta.icon;
    const txt = document.createElement('span');
    const dayPart = code === info.code
      ? `ngày ${info.ord}/${info.cnt}`      // HC2 → "ngày 2/2" (2 ngày HC trong chu kỳ)
      : `ngày ${info.dayNo}/${info.len}`;   // ngày điều chỉnh → vị trí trong chu kỳ
    txt.textContent = `${meta.label} – ${dayPart}`;
    dutyTodayShift.append(ico, txt);
    if (code === 'HC' || code === 'TRUC') {
      dutyTodayTime.hidden = false;
      dutyTodayTime.textContent = `Giờ ca: ${code === 'HC' ? (dutyCfg.hc_time || '—') : (dutyCfg.truc_time || '—')}`;
    } else {
      dutyTodayTime.hidden = true;
      dutyTodayTime.textContent = '';
    }
    if (code === 'TRUC') {
      dutyTickStart(); // đang trực → đếm giờ tới hết ca
    } else {
      dutyTickStop();
      const next = dutyNextTruc(today);
      if (next) {
        const n = dutyDiffDays(next, today);
        dutyTodayNext.textContent = `Ca trực tiếp theo: ${dutyWdName(next)} ${dutyFmtDM(next)} (còn ${n} ngày)`;
      } else {
        dutyTodayNext.textContent = 'Chưa có ca trực trong 30 ngày tới';
      }
    }
    const rest = dutyShiftOf(dutyAddDays(today, 1)) === 'NGHI';
    dutyTodayRest.hidden = !rest;
    dutyTodayRest.textContent = rest ? 'Mai được nghỉ 🛌' : '';
  }

  function renderDutyChips() {
    const today = vnDateString();
    dutyChips.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const d = dutyAddDays(today, i);
      const meta = DUTY_SHIFTS[dutyShiftOf(d)];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'duty-chip' + (i === 0 ? ' today' : '');
      btn.dataset.day = d;
      btn.style.backgroundColor = meta.color;
      btn.style.color = '#fff';
      btn.setAttribute('aria-label', `${dutyWdName(d)} ${dutyFmtDM(d)}: ${meta.label}`);
      const wd = document.createElement('span');
      wd.className = 'duty-chip-wd';
      wd.textContent = i === 0 ? 'HN' : DUTY_WD_SHORT[dutyWdIdx(d)];
      const day = document.createElement('span');
      day.className = 'duty-chip-day';
      day.textContent = d.slice(8, 10);
      const ico = document.createElement('span');
      ico.className = 'duty-chip-ico';
      ico.textContent = meta.icon;
      const tag = document.createElement('span');
      tag.className = 'duty-chip-tag';
      tag.textContent = meta.tag;
      btn.append(wd, day, ico, tag);
      dutyChips.append(btn);
    }
  }

  function renderDutyGrid() {
    const y = Number(dutyMonth.slice(0, 4)), m = Number(dutyMonth.slice(5, 7));
    dutyMonthTitle.textContent = `Tháng ${m}/${y}`;
    const today = vnDateString();
    dutyGrid.replaceChildren();
    for (const w of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      const el = document.createElement('div');
      el.className = 'duty-grid-wd';
      el.textContent = w;
      dutyGrid.append(el);
    }
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // T2 = cột 0
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = 0; i < lead; i++) {
      const el = document.createElement('div');
      el.className = 'duty-cell empty';
      el.setAttribute('aria-hidden', 'true');
      dutyGrid.append(el);
    }
    const stats = { HC: 0, TRUC: 0, NGHI: 0, PHEP: 0, TRUC_BU: 0, KHAC: 0 };
    for (let d = 1; d <= days; d++) {
      const ds = `${dutyMonth}-${String(d).padStart(2, '0')}`;
      const code = dutyShiftOf(ds);
      const meta = DUTY_SHIFTS[code];
      stats[code] = (stats[code] || 0) + 1;
      const ov = dutyOv.get(ds);
      const isRot = dutyAnchors.some((a) => a.start_date === ds); // ngày bắt đầu tua mới
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'duty-cell' + (ds === today ? ' is-today' : '') + (ov ? ' has-ov' : '') + (isRot ? ' has-rot' : '');
      btn.dataset.day = ds;
      btn.style.backgroundColor = meta.color;
      btn.style.color = '#fff';
      btn.setAttribute('aria-label', `Ngày ${d} tháng ${m}: ${meta.label}${ov ? ', đã điều chỉnh' : ''}${isRot ? ', bắt đầu tua mới' : ''}`);
      const num = document.createElement('span');
      num.className = 'duty-cell-num';
      num.textContent = String(d);
      const tag = document.createElement('span');
      tag.className = 'duty-cell-tag';
      tag.textContent = `${meta.icon}${meta.tag}`;
      btn.append(num, tag);
      dutyGrid.append(btn);
    }
    dutyLegend.replaceChildren();
    for (const code of DUTY_ORDER) {
      const meta = DUTY_SHIFTS[code];
      const item = document.createElement('span');
      item.className = 'duty-legend-item';
      const dot = document.createElement('span');
      dot.className = 'duty-legend-dot';
      dot.style.backgroundColor = meta.color;
      const t = document.createElement('span');
      t.textContent = `${meta.icon} ${meta.label}`;
      item.append(dot, t);
      dutyLegend.append(item);
    }
    dutyStats.replaceChildren();
    const line1 = document.createElement('div');
    line1.textContent = `HC: ${stats.HC || 0} · Trực: ${stats.TRUC || 0} · Nghỉ: ${stats.NGHI || 0} · Phép: ${stats.PHEP || 0}`;
    const line2 = document.createElement('div');
    const b = document.createElement('b');
    line2.append('Tổng số ca trực tháng này: ', b);
    b.textContent = String((stats.TRUC || 0) + (stats.TRUC_BU || 0));
    dutyStats.append(line1, line2);
  }

  function renderDutyAll() {
    if (!dutyOpen) return;
    renderDutyToday();
    renderDutyChips();
    renderDutyGrid();
  }

  // ── Mở / đóng màn ──
  async function openDuty() {
    if (!dutyScreen || dutyOpen || !currentUser) return;
    closeFuncPanel();
    closeStickerPanel();
    dutyWasPink = pinkKeyboardOpen;
    if (dutyWasPink) closePinkKeyboard();
    resetToNativeKeyboard(); // lịch trực dùng bàn phím iOS, KHÔNG dùng #kb hồng
    if (messageInput) messageInput.blur();
    dutyOpen = true;
    dutyScreen.classList.add('open');
    dutyScreen.setAttribute('aria-hidden', 'false');
    dutyMonth = vnDateString().slice(0, 7);
    await Promise.all([loadDutyCfg(), loadDutyOverrides(dutyMonth), loadDutyAnchors()]);
    renderDutyAll(); // cache có gì vẽ trước đó; thiếu mốc → dùng mốc dự phòng 02/11=HC2
    Promise.all([loadDutyCfg(true), loadDutyAnchors(true)]) // luôn lấy bản mới nhất
      .then(() => { if (dutyOpen) renderDutyAll(); });
    const scroll = document.getElementById('duty-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function closeDuty() {
    if (!dutyOpen) return;
    dutyOpen = false;
    dutyTickStop();
    closeDutyDay();
    closeDutySet();
    closeDutyRot();
    dutyScreen.classList.remove('open');
    dutyScreen.setAttribute('aria-hidden', 'true');
    const active = document.activeElement;
    if (active && (dutyScreen.contains(active) || dutyDaySheet?.contains(active) || dutySetSheet?.contains(active) || dutyRotSheet?.contains(active)) && active.blur) {
      active.blur();
    }
    if (dutyWasPink) {
      dutyWasPink = false;
      try { usePinkKeyboard(); } catch {}
    }
  }

  function dutyShiftMonth(delta) {
    let y = Number(dutyMonth.slice(0, 4)), m = Number(dutyMonth.slice(5, 7)) + delta;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    dutyMonth = `${y}-${String(m).padStart(2, '0')}`;
    renderDutyGrid();
    loadDutyOverrides(dutyMonth).then(() => { if (dutyOpen) renderDutyGrid(); });
  }

  // ── Sheet điều chỉnh 1 ngày ──
  function openDutyDay(ds) {
    if (!dutyDaySheet || !ds) return;
    dutyDay = ds;
    const info = dutyInfo(ds);
    const cycle = DUTY_SHIFTS[info.code];
    const ov = dutyOv.get(ds);
    const eff = DUTY_SHIFTS[dutyShiftOf(ds)];
    dutyDayTitle.textContent = `${dutyFmtDM(ds)} ${ds.slice(0, 4)} — ${dutyWdName(ds)}`;
    dutyDaySub.textContent = `Theo chu kỳ: ${cycle.icon} ${cycle.label}` +
      (ov ? ` · đang đặt: ${eff.icon} ${eff.label}` : '');
    dutyDayShift.replaceChildren();
    for (const code of DUTY_ORDER) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${DUTY_SHIFTS[code].icon} ${DUTY_SHIFTS[code].label}`;
      if (code === (ov ? ov.shift : info.code)) o.selected = true;
      dutyDayShift.append(o);
    }
    dutyDayNote.value = (ov && ov.note) || '';
    dutyDayCount.textContent = String(dutyDayNote.value.length);
    dutyDayBackdrop.classList.add('open');
    dutyDaySheet.classList.add('open');
    dutyDaySheet.setAttribute('aria-hidden', 'false');
  }

  function closeDutyDay() {
    if (!dutyDaySheet || !dutyDaySheet.classList.contains('open')) return;
    dutyDayBackdrop.classList.remove('open');
    dutyDaySheet.classList.remove('open');
    dutyDaySheet.setAttribute('aria-hidden', 'true');
    dutyDay = '';
  }

  async function saveDutyDay() {
    if (!dutyDay || !currentUser) return;
    const ds = dutyDay;
    const shift = dutyDayShift.value;
    const note = (dutyDayNote.value || '').trim().slice(0, 200);
    try {
      if (shift === getShift(ds) && !note) {
        const { error } = await supabase.from('duty_overrides').delete().eq('day', ds);
        if (error) throw error;
        dutyOv.delete(ds);
      } else {
        const { data, error } = await supabase.from('duty_overrides').upsert(
          { day: ds, shift, note: note || null, updated_by: currentUser.id, updated_at: new Date().toISOString() },
          { onConflict: 'day' }
        ).select();
        if (error) throw error;
        if (data && data[0]) dutyOv.set(ds, data[0]);
      }
      try { lsSet('dnc_duty_ov_v1', { month: dutyMonth, rows: [...dutyOv.values()] }); } catch {}
      renderDutyAll();
      closeDutyDay();
      showAppToast('Đã lưu lịch trực 💚');
    } catch (err) {
      console.error('saveDutyDay error:', err);
      showAppToast('Không lưu được, thử lại');
    }
  }

  async function resetDutyDay() {
    if (!dutyDay) return;
    const ds = dutyDay;
    if (!dutyOv.has(ds)) {
      closeDutyDay();
      showAppToast('Ngày này đang theo chu kỳ');
      return;
    }
    try {
      const { error } = await supabase.from('duty_overrides').delete().eq('day', ds);
      if (error) throw error;
      dutyOv.delete(ds);
      try { lsSet('dnc_duty_ov_v1', { month: dutyMonth, rows: [...dutyOv.values()] }); } catch {}
      renderDutyAll();
      closeDutyDay();
      showAppToast('Đã về theo chu kỳ 💚');
    } catch (err) {
      console.error('resetDutyDay error:', err);
      showAppToast('Không xử lý được, thử lại');
    }
  }

  // ── Sheet cài đặt (cả 2 tài khoản đều sửa được) ──
  function openDutySet() {
    if (!dutySetSheet) return;
    document.getElementById('duty-set-owner').value = dutyCfg.owner_name || '';
    document.getElementById('duty-set-hc').value = dutyCfg.hc_time || '';
    document.getElementById('duty-set-truc').value = dutyCfg.truc_time || '';
    dutySetBackdrop.classList.add('open');
    dutySetSheet.classList.add('open');
    dutySetSheet.setAttribute('aria-hidden', 'false');
  }

  function closeDutySet() {
    if (!dutySetSheet || !dutySetSheet.classList.contains('open')) return;
    dutySetBackdrop.classList.remove('open');
    dutySetSheet.classList.remove('open');
    dutySetSheet.setAttribute('aria-hidden', 'true');
  }

  async function saveDutySet() {
    const owner = document.getElementById('duty-set-owner').value.trim().slice(0, 30) || null;
    const hc = document.getElementById('duty-set-hc').value.trim().slice(0, 40) || null;
    const truc = document.getElementById('duty-set-truc').value.trim().slice(0, 40) || null;
    try {
      const { error } = await supabase.from('duty_settings').update({
        owner_name: owner, hc_time: hc, truc_time: truc, updated_at: new Date().toISOString()
      }).eq('id', 1);
      if (error) throw error;
      dutyCfg = { ...dutyCfg, owner_name: owner, hc_time: hc, truc_time: truc };
      dutyCfgLoaded = true;
      lsSet('dnc_duty_cfg_v1', dutyCfg);
      renderDutyAll();
      closeDutySet();
      showAppToast('Đã lưu cài đặt lịch trực 💚');
    } catch (err) {
      console.error('saveDutySet error:', err);
      showAppToast('Không lưu được, thử lại');
    }
  }

  async function dutyRestoreDefaults() {
    document.getElementById('duty-set-owner').value = '';
    document.getElementById('duty-set-hc').value = DUTY_DEFAULTS.hc_time;
    document.getElementById('duty-set-truc').value = DUTY_DEFAULTS.truc_time;
    await saveDutySet();
  }

  // ── Sheet Đổi tua (nhiều mốc theo thời gian) ──
  function dutyShiftLabel(idx) { // 1=HC1, 2=HC2, 3=Trực, 4=Nghỉ
    const labels = ['☀️ Hành chính 1', '☀️ Hành chính 2', '🌙 Trực', '🛌 Nghỉ'];
    return labels[Math.min(Math.max(Number(idx) || 1, 1), 4) - 1];
  }

  // Tập mốc xem trước = hiện tại + mốc mới (trùng ngày thì thay), sort tăng dần
  function dutyAnchorListWith(date, idx) {
    const list = dutyAnchors.filter((a) => a.start_date !== date)
      .concat([{ start_date: date, shift_index: idx }]);
    list.sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
    return list;
  }

  function dutyShiftWithList(list, dateStr) { // ca theo tập mốc (dùng cho xem trước)
    const pattern = dutyPattern();
    const n = pattern.length;
    let a = null;
    for (const x of list) { if (String(x.start_date) <= dateStr) a = x; else break; }
    if (!a) a = list[0];
    if (!a) return pattern[0] || 'HC';
    const diff = dutyDiffDays(dateStr, a.start_date);
    const base = Math.min(Math.max(Number(a.shift_index) || 1, 1), n) - 1;
    return pattern[((((base + diff) % n) + n) % n)] || 'HC';
  }

  function updateDutyRotPreview() {
    if (!dutyRotPreview || !dutyRotShifts) return;
    const date = dutyRotDate.value || vnDateString();
    dutyRotShifts.querySelectorAll('.duty-rot-shift').forEach((b) => {
      const on = Number(b.dataset.idx) === dutyRotIdx;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const list = dutyAnchorListWith(date, dutyRotIdx);
    dutyRotPreview.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const d = dutyAddDays(date, i);
      const meta = DUTY_SHIFTS[dutyShiftWithList(list, d)];
      const line = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = dutyFmtDM(d);
      line.append(b, ` ${dutyWdName(d)} — ${meta.icon} ${meta.label}`);
      dutyRotPreview.append(line);
    }
  }

  function renderDutyHist() {
    if (!dutyRotHist) return;
    dutyRotHist.replaceChildren();
    const list = [...dutyAnchors].sort((a, b) => (a.start_date < b.start_date ? 1 : -1)); // mới nhất trước
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'duty-hint';
      empty.textContent = 'Chưa có mốc tua';
      dutyRotHist.append(empty);
      return;
    }
    for (const a of list) {
      const row = document.createElement('div');
      row.className = 'duty-hist-row';
      const main = document.createElement('div');
      main.className = 'duty-hist-main';
      const t = document.createElement('span');
      t.textContent = `${dutyFmtDM(a.start_date)} ${String(a.start_date).slice(0, 4)} — ${dutyShiftLabel(a.shift_index)}`;
      main.append(t);
      if (a.note) {
        const nt = document.createElement('span');
        nt.className = 'duty-hist-note';
        nt.textContent = a.note;
        main.append(nt);
      }
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'duty-hist-del';
      del.textContent = '✕';
      del.setAttribute('aria-label', `Xóa mốc ${dutyFmtDM(a.start_date)}`);
      del.disabled = list.length <= 1; // không cho xóa mốc cuối cùng còn lại
      del.dataset.day = a.start_date;
      row.append(main, del);
      dutyRotHist.append(row);
    }
  }

  function openDutyRot() {
    if (!dutyRotSheet) return;
    const today = vnDateString();
    dutyRotDate.value = today;
    const cur = getShift(today); // mặc chọn ca hiện tại của hôm nay (HC1/HC2/Trực/Nghỉ)
    dutyRotIdx = cur === 'HC' ? (dutyInfo(today).idx === 0 ? 1 : 2) : cur === 'TRUC' ? 3 : cur === 'NGHI' ? 4 : 1;
    dutyRotNote.value = '';
    dutyRotCount.textContent = '0';
    updateDutyRotPreview();
    renderDutyHist();
    dutyRotBackdrop.classList.add('open');
    dutyRotSheet.classList.add('open');
    dutyRotSheet.setAttribute('aria-hidden', 'false');
  }

  function closeDutyRot() {
    if (!dutyRotSheet || !dutyRotSheet.classList.contains('open')) return;
    dutyRotBackdrop.classList.remove('open');
    dutyRotSheet.classList.remove('open');
    dutyRotSheet.setAttribute('aria-hidden', 'true');
  }

  async function applyDutyRot() {
    if (!currentUser) return;
    const date = dutyRotDate.value || vnDateString();
    const note = (dutyRotNote.value || '').trim().slice(0, 200);
    let msg = `Từ ${dutyFmtDM(date)} các ngày sau sẽ tính lại, các ngày trước giữ nguyên.`;
    if (date < vnDateString()) msg += ' Sẽ đổi cả lịch từ ngày đó.';
    if (!window.confirm(msg)) return;
    try {
      const { error } = await supabase.from('duty_anchors').upsert(
        { start_date: date, shift_index: dutyRotIdx, note: note || null, created_by: currentUser.id, created_at: new Date().toISOString() },
        { onConflict: 'start_date' }
      );
      if (error) throw error;
      await loadDutyAnchors(true);
      renderDutyAll();
      updateDutyRotPreview();
      renderDutyHist();
      showAppToast('Đã đổi tua 💚');
    } catch (err) {
      console.error('applyDutyRot error:', err);
      showAppToast('Không lưu được, thử lại');
    }
  }

  async function deleteDutyAnchor(startDate) {
    if (dutyAnchors.length <= 1) { showAppToast('Không thể xóa mốc cuối cùng'); return; }
    if (!window.confirm(`Xóa mốc ${dutyFmtDM(startDate)}? Lịch sẽ quay về tua trước đó.`)) return;
    try {
      const { error } = await supabase.from('duty_anchors').delete().eq('start_date', startDate);
      if (error) throw error;
      await loadDutyAnchors(true);
      renderDutyAll();
      updateDutyRotPreview();
      renderDutyHist();
      showAppToast('Đã xóa mốc tua 💚');
    } catch (err) {
      console.error('deleteDutyAnchor error:', err);
      showAppToast('Không xóa được, thử lại');
    }
  }

  // "Đặt ngày này là…" trong sheet ngày → tạo mốc mới tại ngày đó (1 chạm)
  async function setDutyDayAnchor(idx) {
    if (!dutyDay || !currentUser) return;
    const ds = dutyDay;
    try {
      const { error } = await supabase.from('duty_anchors').upsert(
        { start_date: ds, shift_index: idx, note: null, created_by: currentUser.id, created_at: new Date().toISOString() },
        { onConflict: 'start_date' }
      );
      if (error) throw error;
      await loadDutyAnchors(true);
      renderDutyAll();
      closeDutyDay();
      showAppToast(`Đã đặt ${dutyFmtDM(ds)} là tua mới 🔄`);
    } catch (err) {
      console.error('setDutyDayAnchor error:', err);
      showAppToast('Không lưu được, thử lại');
    }
  }

  // ── Realtime: đổi cài đặt/điều chỉnh → làm mới ngay, không giật ──
  function subscribeDuty() {
    if (dutyChannel) { try { supabase.removeChannel(dutyChannel); } catch {} dutyChannel = null; }
    if (!currentUser) return;
    dutyChannel = supabase.channel('duty-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_settings' }, () => {
        loadDutyCfg(true).then(() => { if (dutyOpen) renderDutyAll(); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_overrides' }, () => {
        loadDutyOverrides(dutyMonth || vnDateString().slice(0, 7), true)
          .then(() => { if (dutyOpen) renderDutyAll(); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_anchors' }, () => {
        loadDutyAnchors(true).then(() => {
          if (!dutyOpen) return;
          renderDutyAll();
          if (dutyRotSheet?.classList.contains('open')) { updateDutyRotPreview(); renderDutyHist(); }
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(subscribeDuty, 2000);
        }
      });
  }

  // ── Lối vào + sự kiện ──
  document.getElementById('btn-duty')?.addEventListener('click', () => { closeFuncPanel(); openDuty(); });
  document.getElementById('btn-duty-quick')?.addEventListener('click', () => { closeFuncPanel(); openDuty(); });
  document.getElementById('duty-back')?.addEventListener('click', closeDuty);
  document.getElementById('duty-gear')?.addEventListener('click', openDutySet);
  document.getElementById('duty-prev')?.addEventListener('click', () => dutyShiftMonth(-1));
  document.getElementById('duty-next')?.addEventListener('click', () => dutyShiftMonth(1));
  document.getElementById('duty-today-btn')?.addEventListener('click', () => {
    dutyMonth = vnDateString().slice(0, 7);
    renderDutyGrid();
    loadDutyOverrides(dutyMonth).then(() => { if (dutyOpen) renderDutyGrid(); });
  });
  dutyChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-day]');
    if (btn) openDutyDay(btn.dataset.day);
  });
  dutyGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.duty-cell[data-day]');
    if (btn) openDutyDay(btn.dataset.day);
  });
  let dutySwipeX = 0, dutySwipeY = 0, dutySwipeOn = false;
  dutyGrid?.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { dutySwipeOn = false; return; }
    dutySwipeOn = true;
    dutySwipeX = e.touches[0].clientX;
    dutySwipeY = e.touches[0].clientY;
  }, { passive: true });
  dutyGrid?.addEventListener('touchend', (e) => {
    if (!dutySwipeOn) return;
    dutySwipeOn = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - dutySwipeX, dy = t.clientY - dutySwipeY;
    if (Math.abs(dx) >= 50 && Math.abs(dy) <= 40) dutyShiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.getElementById('duty-day-close')?.addEventListener('click', closeDutyDay);
  dutyDayBackdrop?.addEventListener('click', closeDutyDay);
  document.getElementById('duty-day-save')?.addEventListener('click', saveDutyDay);
  document.getElementById('duty-day-reset')?.addEventListener('click', resetDutyDay);
  dutyDayNote?.addEventListener('input', () => {
    dutyDayCount.textContent = String((dutyDayNote.value || '').length);
  });
  document.getElementById('duty-set-close')?.addEventListener('click', closeDutySet);
  dutySetBackdrop?.addEventListener('click', closeDutySet);
  document.getElementById('duty-set-save')?.addEventListener('click', saveDutySet);
  document.getElementById('duty-set-defaults')?.addEventListener('click', dutyRestoreDefaults);
  document.getElementById('duty-rotate')?.addEventListener('click', openDutyRot);
  document.getElementById('duty-rot-close')?.addEventListener('click', closeDutyRot);
  dutyRotBackdrop?.addEventListener('click', closeDutyRot);
  document.getElementById('duty-rot-apply')?.addEventListener('click', applyDutyRot);
  dutyRotDate?.addEventListener('change', updateDutyRotPreview);
  dutyRotShifts?.addEventListener('click', (e) => {
    const b = e.target.closest('.duty-rot-shift');
    if (!b) return;
    dutyRotIdx = Number(b.dataset.idx) || 1;
    updateDutyRotPreview();
  });
  dutyRotNote?.addEventListener('input', () => {
    dutyRotCount.textContent = String((dutyRotNote.value || '').length);
  });
  dutyRotHist?.addEventListener('click', (e) => {
    const b = e.target.closest('.duty-hist-del');
    if (b && !b.disabled) deleteDutyAnchor(b.dataset.day);
  });
  document.getElementById('duty-day-anchor')?.addEventListener('click', (e) => {
    const b = e.target.closest('.duty-rot-shift');
    if (b) setDutyDayAnchor(Number(b.dataset.idx) || 1);
  });

  // ─── initChat ────────────────────────────────────────────────────────────────
  async function initChat(user) {
    try {
      currentUser = user;
      authScreen.classList.remove('active');
      chatScreen.classList.add('active');
      resetToNativeKeyboard();
      requestAnimationFrame(fitViewport);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentProfile = profile;
      }

      await loadProfiles();
      applyProfileIdentity();
      subscribeProfilesChange();
      subscribeDuty();
      loadStreakCache();
      refreshStreak();
      checkFestive();
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
    if (profilesChannel) { try { supabase.removeChannel(profilesChannel); } catch {} profilesChannel = null; }
    if (dutyChannel) { try { supabase.removeChannel(dutyChannel); } catch {} dutyChannel = null; }
    if (profileOpen) closeProfile(true);
    if (dutyOpen) closeDuty();
    hideTyping();
    chatScreen.classList.remove('active');
    authScreen.classList.add('active');
    requestAnimationFrame(fitViewport);
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
  if (!btnCover || !coverMenu || !coverChange || !coverRemove || !coverFile) {
    console.error('Thiếu nút, menu hoặc input ảnh bìa trong index.html.');
  } else {
    btnCover.onclick = (event) => {
      event.stopPropagation();
      coverMenu.classList.toggle('open');
    };
    coverMenu.onclick = (event) => event.stopPropagation();
    document.addEventListener('click', (event) => {
      if (!coverMenu.contains(event.target) && event.target !== btnCover) coverMenu.classList.remove('open');
    });
    coverChange.onclick = () => {
      coverMenu.classList.remove('open');
      coverFile.value = '';
      coverFile.click();
    };
    coverRemove.onclick = () => {
      coverMenu.classList.remove('open');
      removeCover();
    };
    coverFile.onchange = () => {
      const file = coverFile.files?.[0];
      coverFile.value = '';
      if (file) openCoverCrop(file);
    };
  }
  if (coverCropCancel) coverCropCancel.onclick = closeCoverCrop;
  if (coverCropRotate) coverCropRotate.onclick = () => {
    if (!coverCropBitmap) return;
    // Xoay nguồn ảnh (không xoay transform) → mô hình crop giữ nguyên (s, tx, ty).
    const source = coverCropBitmap;
    const rotated = document.createElement('canvas');
    rotated.width = source.height;
    rotated.height = source.width;
    const context = rotated.getContext('2d');
    if (!context) return;
    context.translate(rotated.width / 2, rotated.height / 2);
    context.rotate(Math.PI / 2);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    if (source.close) source.close();
    coverCropBitmap = rotated;
    coverCropRotation = (coverCropRotation + 90) % 360;
    coverCropImage.width = rotated.width;
    coverCropImage.height = rotated.height;
    coverCropImage.getContext('2d').drawImage(rotated, 0, 0);
    layoutCoverCrop(true);
  };
  if (coverCropDone) coverCropDone.onclick = finishCoverCrop;
  if (coverCropZoom) coverCropZoom.addEventListener('input', () => {
    if (!coverCropBitmap) return;
    const zoom = Math.max(1, Math.min(6, Number(coverCropZoom.value) || 1));
    zoomCoverCropTo(coverCropMinScale * zoom, coverCropFrameSize.width / 2, coverCropFrameSize.height / 2);
  });
  if (coverCropStage) {
    coverCropStage.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      coverCropPointers.set(event.pointerId, coverCropPoint(event));
      try { coverCropStage.setPointerCapture(event.pointerId); } catch {}
      startCoverCropGesture();
    });
    coverCropStage.addEventListener('pointermove', moveCoverCropPointer);
    const finishCropPointer = (event) => {
      if (!coverCropPointers.has(event.pointerId)) return;
      coverCropPointers.delete(event.pointerId);
      startCoverCropGesture();
      try { coverCropStage.releasePointerCapture(event.pointerId); } catch {}
    };
    coverCropStage.addEventListener('pointerup', finishCropPointer);
    coverCropStage.addEventListener('pointercancel', finishCropPointer);
  }
  const relayoutCropOnViewportChange = () => {
    if (coverCropOverlay?.classList.contains('open')) layoutCoverCrop();
  };
  window.addEventListener('resize', relayoutCropOnViewportChange);
  window.addEventListener('resize', scheduleKeyboardCoordinateCache);
  window.addEventListener('orientationchange', scheduleKeyboardCoordinateCache);
  window.visualViewport?.addEventListener('resize', relayoutCropOnViewportChange);
  window.visualViewport?.addEventListener('resize', scheduleKeyboardCoordinateCache);
  let sendTouchStarted = false;
  let ignoreSendClick = false;
  btnSend.addEventListener('pointerdown', (event) => event.preventDefault());
  btnSend.addEventListener('mousedown', (event) => event.preventDefault());
  btnSend.addEventListener('touchstart', (event) => {
    event.preventDefault();
    sendTouchStarted = true;
  }, { passive: false });
  btnSend.addEventListener('touchend', (event) => {
    if (!sendTouchStarted) return;
    event.preventDefault();
    sendTouchStarted = false;
    ignoreSendClick = true;
    sendMessage();
    window.setTimeout(() => { ignoreSendClick = false; }, 500);
  }, { passive: false });
  btnSend.addEventListener('touchcancel', () => { sendTouchStarted = false; });
  btnSend.addEventListener('click', (event) => {
    if (ignoreSendClick) { event.preventDefault(); return; }
    sendMessage();
  });
  if (newMessagesButton) newMessagesButton.addEventListener('click', () => {
    if (viewingOldMessages) { exitOldView(); return; } // exitOldView tự nạp + cuộn
    scrollToBottom('jumpDown'); // forced → reset đếm "↓ Tin mới (N)"
  });
  replyCancel.addEventListener('click', clearReply);
  messageInput.addEventListener('input', () => {
    if (composerInputFramePending) return;
    composerInputFramePending = true;
    requestAnimationFrame(() => {
      composerInputFramePending = false;
      resizeMessageInput();
      updateSendButtonVisibility();
    });
    // Việc phụ (gõ "đang nhập") tách khỏi RAF đường gõ.
    setTimeout(sendTyping, 0);
  });
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    else if (e.key === 'Enter' && e.shiftKey) scrollToBottom('input');
  });
  resizeMessageInput();
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

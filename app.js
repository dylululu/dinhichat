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
  let coverCropBitmap = null;
  let coverCropObjectUrl = null;
  let coverCropFrameSize = { width: 0, height: 0 };
  let coverCropBaseScale = 1;
  let coverCropZoomValue = 1;
  let coverCropRotation = 0;
  let coverCropOffsetX = 0;
  let coverCropOffsetY = 0;
  let coverCropPointers = new Map();
  let coverCropGesture = null;
  let typingTimer = null;
  let lastTypingSent = 0;
  const messageIds = new Set();
  const signedUrlCache = new Map();
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

  function clampCoverCropPosition() {
    if (!coverCropBitmap || !coverCropFrameSize.width || !coverCropFrameSize.height) return;
    const rotated = Math.abs(coverCropRotation % 180) === 90;
    const renderedWidth = (rotated ? coverCropBitmap.height : coverCropBitmap.width) * coverCropBaseScale * coverCropZoomValue;
    const renderedHeight = (rotated ? coverCropBitmap.width : coverCropBitmap.height) * coverCropBaseScale * coverCropZoomValue;
    const maxX = Math.max(0, (renderedWidth - coverCropFrameSize.width) / 2);
    const maxY = Math.max(0, (renderedHeight - coverCropFrameSize.height) / 2);
    coverCropOffsetX = Math.max(-maxX, Math.min(maxX, coverCropOffsetX));
    coverCropOffsetY = Math.max(-maxY, Math.min(maxY, coverCropOffsetY));
  }

  function renderCoverCrop() {
    if (!coverCropBitmap) return;
    clampCoverCropPosition();
    coverCropImage.style.width = `${coverCropBitmap.width * coverCropBaseScale}px`;
    coverCropImage.style.height = `${coverCropBitmap.height * coverCropBaseScale}px`;
    coverCropImage.style.transform = `translate(-50%, -50%) translate(${coverCropOffsetX}px, ${coverCropOffsetY}px) scale(${coverCropZoomValue}) rotate(${coverCropRotation}deg)`;
    coverCropZoom.value = String(coverCropZoomValue);
    coverCropZoomLabel.textContent = `${coverCropZoomValue.toFixed(1)}×`;
  }

  function layoutCoverCrop() {
    if (!coverCropBitmap || !coverCropStage.clientWidth || !coverCropStage.clientHeight) return;
    const coverRect = coverElement.getBoundingClientRect();
    const ratio = coverRect.width / Math.max(1, coverRect.height);
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const maxHeight = Math.min(coverCropStage.clientHeight, viewportHeight * 0.8);
    const maxWidth = Math.max(1, coverCropStage.clientWidth - 24);
    const frameHeight = Math.min(maxHeight, maxWidth / ratio);
    const frameWidth = frameHeight * ratio;
    coverCropFrameSize = { width: frameWidth, height: frameHeight };
    coverCropFrame.style.width = `${frameWidth}px`;
    coverCropFrame.style.height = `${frameHeight}px`;
    const rotated = Math.abs(coverCropRotation % 180) === 90;
    const sourceWidth = rotated ? coverCropBitmap.height : coverCropBitmap.width;
    const sourceHeight = rotated ? coverCropBitmap.width : coverCropBitmap.height;
    coverCropBaseScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
    renderCoverCrop();
  }

  async function openCoverCrop(file) {
    try {
      if (!file) return;
      if (!coverCropOverlay || !coverCropStage || !coverCropImage || !coverCropFrame) {
        throw new Error('Không tìm thấy màn hình cắt ảnh bìa.');
      }
      closeCoverCrop();
      coverCropBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      coverCropObjectUrl = URL.createObjectURL(file);
      coverCropImage.src = coverCropObjectUrl;
      coverCropZoomValue = 1;
      coverCropRotation = 0;
      coverCropOffsetX = 0;
      coverCropOffsetY = 0;
      coverCropOverlay.classList.add('open');
      coverCropOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('cover-crop-open');
      if (coverCropImage.decode) await coverCropImage.decode();
      layoutCoverCrop();
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
    if (coverCropImage) coverCropImage.removeAttribute('src');
    if (coverCropObjectUrl) URL.revokeObjectURL(coverCropObjectUrl);
    coverCropObjectUrl = null;
    if (coverCropBitmap) coverCropBitmap.close?.();
    coverCropBitmap = null;
  }

  function coverCropPoint(event) {
    const rect = coverCropStage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function coverCropDistance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function startCoverCropGesture() {
    const points = [...coverCropPointers.values()];
    if (points.length >= 2) {
      coverCropGesture = {
        type: 'pinch',
        distance: Math.max(1, coverCropDistance(points[0], points[1])),
        midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        zoom: coverCropZoomValue,
        offsetX: coverCropOffsetX,
        offsetY: coverCropOffsetY
      };
    } else if (points.length === 1) {
      coverCropGesture = {
        type: 'drag', point: points[0], offsetX: coverCropOffsetX, offsetY: coverCropOffsetY
      };
    } else coverCropGesture = null;
  }

  function moveCoverCropPointer(event) {
    if (!coverCropPointers.has(event.pointerId)) return;
    coverCropPointers.set(event.pointerId, coverCropPoint(event));
    const points = [...coverCropPointers.values()];
    if (points.length >= 2 && coverCropGesture?.type === 'pinch') {
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = coverCropDistance(points[0], points[1]);
      const zoom = Math.max(1, Math.min(4, coverCropGesture.zoom * distance / coverCropGesture.distance));
      const centerX = coverCropStage.clientWidth / 2;
      const centerY = coverCropStage.clientHeight / 2;
      coverCropOffsetX = midpoint.x - centerX -
        ((coverCropGesture.midpoint.x - centerX - coverCropGesture.offsetX) / coverCropGesture.zoom) * zoom;
      coverCropOffsetY = midpoint.y - centerY -
        ((coverCropGesture.midpoint.y - centerY - coverCropGesture.offsetY) / coverCropGesture.zoom) * zoom;
      coverCropZoomValue = zoom;
    } else if (points.length === 1 && coverCropGesture?.type === 'drag') {
      coverCropOffsetX = coverCropGesture.offsetX + points[0].x - coverCropGesture.point.x;
      coverCropOffsetY = coverCropGesture.offsetY + points[0].y - coverCropGesture.point.y;
    }
    renderCoverCrop();
  }

  async function exportCoverCrop() {
    if (!coverCropBitmap || !coverCropFrameSize.width || !coverCropFrameSize.height) {
      throw new Error('Ảnh chưa sẵn sàng để cắt.');
    }
    const ratio = coverCropFrameSize.width / coverCropFrameSize.height;
    const canvas = document.createElement('canvas');
    canvas.width = ratio >= 1 ? 1280 : Math.max(1, Math.round(1280 * ratio));
    canvas.height = ratio >= 1 ? Math.max(1, Math.round(1280 / ratio)) : 1280;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không tạo được canvas.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const outputScale = canvas.width / coverCropFrameSize.width;
    context.translate(canvas.width / 2 + coverCropOffsetX * outputScale,
      canvas.height / 2 + coverCropOffsetY * outputScale);
    context.rotate(coverCropRotation * Math.PI / 180);
    context.scale(coverCropBaseScale * coverCropZoomValue * outputScale,
      coverCropBaseScale * coverCropZoomValue * outputScale);
    context.drawImage(coverCropBitmap, -coverCropBitmap.width / 2, -coverCropBitmap.height / 2);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas không tạo được ảnh JPEG.'));
    }, 'image/jpeg', 0.85));
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
      if (await uploadCover(blob)) closeCoverCrop();
    } catch (error) {
      console.error(error?.message || String(error));
      showCoverToast('Đổi ảnh bìa thất bại: ' + (error?.message || String(error)));
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
    const { data, error } = await supabase.from('profiles')
      .select('id, name, push_subscription, last_push_status, last_push_at');
    if (!error && data) {
      data.forEach((p) => profilesMap.set(p.id, p));
      lsSet(CACHE_PROFILES_KEY, data);
      updatePeerPushNotice(data);
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
        .select('id, name, push_subscription, last_push_status, last_push_at')
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
      if (activate) {
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
    const glyphs = festiveDay ? ['🌸', '🌷', '💗', '✨', '🌹', '💐'] : null;
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

    if (options.sorted && message.created_at) insertMsgSorted(row, message.created_at);
    else messagesContainer.appendChild(row);
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
    row.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest?.('a, button, img, .reply-quote, .reaction-badge, #rxBar, .rx-trigger-btn')) return;
      tapStartPos = { x: event.clientX, y: event.clientY };
    }, { passive: true });

    row.addEventListener('pointermove', (event) => {
      if (!tapStartPos) return;
      if (Math.hypot(event.clientX - tapStartPos.x, event.clientY - tapStartPos.y) > 10) {
        tapStartPos = null;
      }
    }, { passive: true });

    row.addEventListener('pointerup', () => {
      if (!tapStartPos) return;
      tapStartPos = null;
      if (String(message.id).startsWith('tmp-') || !currentUser || message.sender_id === currentUser.id) return;
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
            await handleIncomingMessage(payload.new);
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
      av.className = 'search-avatar';
      av.setAttribute('aria-hidden', 'true');
      const nm = senderName(m);
      av.textContent = nm.substring(0, 2).toUpperCase();
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

  // ─── 20/10: banner + hoa rơi + thiệp ─────────────────────────────────────────
  const FESTIVE_SEEN_KEY = 'dnc_2010_seen';
  const FESTIVE_FLOWERS = ['🌸', '💐', '🌷', '🌹', '✨', '💗'];
  const FESTIVE_WISH = 'Chúc mừng 20/10 nhaaa Vợ iu 💐🌸 Chúc Vợ iu luôn xinh đẹp, vui vẻ và hạnh phúc nhé, yêu Vợ iu nhiều lắm 💕';
  const FESTIVE_LONG = 'Nhân ngày Phụ nữ Việt Nam 20/10, chúc Vợ iu luôn xinh đẹp, rạng rỡ, vui vẻ và hạnh phúc mỗi ngày. Cảm ơn Vợ iu đã luôn ở đây 💐💕';
  let festiveOn = false;
  let festiveHiddenSession = false;
  let festiveAnims = [];
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

  function vnDateString() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }

  function isEvent2010() {
    try {
      if (new URLSearchParams(location.search).get('event') === '2010') return true;
    } catch {}
    return vnDateString().slice(5) === '10-20';
  }

  function festiveReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function setFestiveText(el) {
    if (!el) return;
    el.textContent = '';
    const parts = [
      ['ico', '🌸'], ['txt', ' Chúc mừng 20/10 '], ['ico', '🌸'],
      ['txt', ' Chúc '], ['name', 'Vợ iu'],
      ['txt', ' luôn xinh đẹp, hạnh phúc và được yêu thương thật nhiều '],
      ['ico', '💐'], ['txt', ' Yêu Vợ iu nhiều lắm '], ['ico', '💕']
    ];
    let icoIdx = 0;
    parts.forEach(([kind, val]) => {
      if (kind === 'txt') { el.appendChild(document.createTextNode(val)); return; }
      const s = document.createElement('span');
      if (kind === 'ico') {
        s.className = 'festive-ico';
        s.style.animationDelay = (icoIdx * 0.25) + 's';
        icoIdx++;
      } else {
        s.className = 'festive-name';
      }
      s.textContent = val;
      el.appendChild(s);
    });
  }

  function applyFestive() {
    const show = festiveOn && !festiveHiddenSession;
    if (festiveBanner && show && festiveBanner.hidden) {
      festiveBanner.classList.add('festive-enter');
      setTimeout(() => festiveBanner?.classList.remove('festive-enter'), 400);
    }
    if (festiveBanner) festiveBanner.hidden = !show;
    if (festiveLayer) festiveLayer.hidden = !festiveOn;
    if (chatTitle) chatTitle.textContent = festiveOn ? '🌸 DiNhiChat 🌸' : (currentProfile?.name || 'DiNhiChat');
    if (!festiveOn) return;
    setFestiveText(festiveTextA);
    setFestiveText(festiveTextB);
    if (festiveLong) festiveLong.textContent = FESTIVE_LONG;
  }

  function startFestiveFall() {
    if (!festiveLayer || festiveLayer.childElementCount || festiveReducedMotion()) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'festive-petal';
      s.textContent = FESTIVE_FLOWERS[i % FESTIVE_FLOWERS.length];
      s.style.fontSize = (14 + Math.round(Math.random() * 12)) + 'px';
      s.style.left = (Math.random() * 100) + '%';
      festiveLayer.appendChild(s);
      const dur = 8000 + Math.random() * 6000;
      const sway = 20 + Math.random() * 30;
      try {
        const anim = s.animate([
          { transform: 'translate3d(0,-60px,0) rotate(0deg)', opacity: 0 },
          { opacity: .85, offset: .08 },
          { transform: 'translate3d(' + sway + 'px,50vh,0) rotate(120deg)', opacity: .85, offset: .5 },
          { transform: 'translate3d(' + (-sway) + 'px,105vh,0) rotate(240deg)', opacity: 0 }
        ], { duration: dur, delay: -Math.random() * dur, iterations: Infinity });
        festiveAnims.push(anim);
      } catch {}
    }
  }

  function stopFestiveFall() {
    festiveAnims.forEach((a) => { try { a.cancel(); } catch {} });
    festiveAnims = [];
    if (festiveLayer) festiveLayer.textContent = '';
  }

  function festiveFireworks() {
    if (!festiveLayer || festiveReducedMotion() || document.hidden) return;
    const rect = festiveLayer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.4;
    const glyphs = ['🌸', '💗', '✨'];
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
    try {
      if (chatScreen && !chatScreen.classList.contains('active')) return;
      if (localStorage.getItem(FESTIVE_SEEN_KEY) === vnDateString()) return;
      localStorage.setItem(FESTIVE_SEEN_KEY, vnDateString());
    } catch {}
    festiveFireworks();
    showFestiveToast('Chúc mừng 20/10 💐');
  }

  function checkFestive() {
    const on = isEvent2010();
    if (on === festiveOn) {
      if (on) applyFestive();
      return;
    }
    festiveOn = on;
    if (on) {
      applyFestive();
      startFestiveFall();
      maybeFestiveFireworks();
    } else {
      stopFestiveFall();
      closeFestiveSheet();
      applyFestive();
    }
  }

  function openFestiveSheet() {
    if (festiveLong) festiveLong.textContent = FESTIVE_LONG;
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
      messageInput.value = FESTIVE_WISH;
      try { resizeMessageInput(); updateSendButtonVisibility(); } catch {}
      try { messageInput.focus({ preventScroll: true }); } catch { try { messageInput.focus(); } catch {} }
    }
    closeFestiveSheet();
  });

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
      scheduleStreakRefresh();
    } else if (document.visibilityState === 'hidden') {
      sendStopTyping();
    }
  });
  window.addEventListener('pageshow', () => { resetToNativeKeyboard(); if (currentUser) { syncMessages(); markRead(); checkNotificationStatus(); ensurePush(); refreshPeerPushStatus(); refreshCoverFromServer(); } });
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
      resetToNativeKeyboard();
      requestAnimationFrame(fitViewport);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentProfile = profile;
        userAvatar.textContent = (profile.name || 'DN').substring(0, 2).toUpperCase();
        chatTitle.textContent = profile.name || 'DiNhiChat';
      }

      await loadProfiles();
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
    coverCropRotation = (coverCropRotation + 90) % 360;
    layoutCoverCrop();
  };
  if (coverCropDone) coverCropDone.onclick = finishCoverCrop;
  if (coverCropZoom) coverCropZoom.addEventListener('input', () => {
    coverCropZoomValue = Math.max(1, Math.min(4, Number(coverCropZoom.value) || 1));
    renderCoverCrop();
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

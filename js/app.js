// App shell: state, controls, message editor, playback loop.

const DEFAULT_MESSAGES = [
  { sender: 'them', text: 'Hey! Did you see the new device picker? 👀' },
  { sender: 'me', text: 'Just tried it. Switched to the S25 Ultra and the punch-hole showed up instantly' },
  { sender: 'them', text: 'Nice. Does the export match the preview?' },
  { sender: 'me', text: 'Pixel-perfect. Same renderer draws both, so 4K comes out crisp' },
  { sender: 'them', text: '🔥' },
  { sender: 'them', text: 'Okay shipping it' },
];

const state = {
  deviceId: 'iphone-16-pro-max',
  orientation: 'portrait',
  app: 'whatsapp',
  deviceAngle: 0,
  showFrame: true,
  darkMode: false,
  showTyping: true,
  showKeyboard: true,
  soundsEnabled: true,
  contactName: 'Alex',
  contactStatus: '',
  contactPhoto: null,
  myName: 'Me',
  myPhoto: null,
  bgStyle: 'gradient',
  bgColor: '#17191e',
  customDeviceWidth: 1080,
  customDeviceHeight: 1920,
  exportRes: 'native',
  customExportWidth: 1080,
  customExportHeight: 1920,
  exportFps: 60,
  playbackSpeed: 1,
  messages: DEFAULT_MESSAGES.map(m => ({ ...m })),
};

const STORAGE_KEY = 'conversation-simulator-v1';
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.messages)) Object.assign(state, saved);
} catch { /* fresh start */ }

// Shared-conversation links: #s=<base64 json> overrides the saved state.
try {
  const m = location.hash.match(/[#&]s=([^&]+)/);
  if (m) {
    const shared = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (shared && Array.isArray(shared.messages)) {
      delete shared.contactPhoto; delete shared.myPhoto; // photos never travel in links
      Object.assign(state, shared);
    }
  }
} catch { /* malformed share link — ignore */ }

// Landing pages (e.g. whatsapp-chat-generator.html) preset the chat app.
if (window.PRESET_APP) state.app = window.PRESET_APP;

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* full/blocked */ }
}

/* ------------------------------- playback loop ------------------------------ */

const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const renderCache = {};

const playback = {
  playing: true,
  time: 0,          // content seconds
  lastFrame: null,  // wall-clock ms
};

function timelineDuration() {
  const tl = computeTimeline(state);
  return tl.duration;
}

// Preview renders at device aspect, capped so huge devices stay smooth,
// then CSS-scales to fit the stage.
function sizePreviewCanvas() {
  const d = resolveDevice(state);
  const cap = 1500 * (window.devicePixelRatio > 1 ? 1.3 : 1);
  const scale = Math.min(1, cap / Math.max(d.width, d.height));
  previewCanvas.width = Math.round(d.width * scale);
  previewCanvas.height = Math.round(d.height * scale);
  previewCanvas.style.aspectRatio = `${d.width} / ${d.height}`;
  document.getElementById('res-badge').textContent =
    `${d.width} × ${d.height}`;
  const ex = resolveExportSize(state);
  document.getElementById('export-badge').textContent =
    `Export: ${ex.width} × ${ex.height}`;
}

function drawPreview() {
  renderFrame(previewCtx, previewCanvas.width, previewCanvas.height, playback.time, state, renderCache);
  const dur = timelineDuration();
  const scrub = document.getElementById('scrubber');
  if (!scrub.matches(':active')) scrub.value = String(Math.min(1, playback.time / dur) * 1000);
  document.getElementById('time-label').textContent =
    `${playback.time.toFixed(1)}s / ${dur.toFixed(1)}s`;
}

function loop(now) {
  if (playback.playing) {
    if (playback.lastFrame != null) {
      const prevT = playback.time;
      playback.time += ((now - playback.lastFrame) / 1000) * state.playbackSpeed;
      const dur = timelineDuration();
      if (playback.time >= dur + 0.6) playback.time = 0; // loop with a beat of rest
      if (state.soundsEnabled && Sounds.ctx && renderCache.timeline) {
        triggerTimelineSounds(Sounds, renderCache.timeline, state.messages, state.showKeyboard, prevT, playback.time, state.app);
      }
    }
    playback.lastFrame = now;
    drawPreview();
  } else {
    playback.lastFrame = null;
  }
  requestAnimationFrame(loop);
}

function invalidate({ restart = false, resize = false } = {}) {
  if (resize) sizePreviewCanvas();
  if (restart) playback.time = 0;
  renderCache.layoutKey = null;
  renderCache.timelineKey = null;
  drawPreview();
  persist();
}

/* --------------------------------- controls -------------------------------- */

const $ = (id) => document.getElementById(id);

function buildDeviceSelect() {
  const sel = $('device-select');
  sel.innerHTML = '';
  for (const d of DEVICES) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.isCustom ? d.name : `${d.name} — ${d.width}×${d.height}`;
    sel.appendChild(opt);
  }
  sel.value = state.deviceId;
}

function buildExportSelect() {
  const sel = $('export-res-select');
  sel.innerHTML = '';
  for (const r of EXPORT_RESOLUTIONS) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    sel.appendChild(opt);
  }
  sel.value = state.exportRes;
}

function syncControlVisibility() {
  const device = getDevice(state.deviceId);
  $('custom-device-size').hidden = !device.isCustom;
  $('custom-export-size').hidden = state.exportRes !== 'custom';
  $('bg-color-row').hidden = state.bgStyle !== 'solid';
  $('landscape-btn').disabled = !device.supportsLandscape;
}

// Brand-flavored inline SVG icons for the app pills (original simplified marks).
const APP_ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M17.4 14.4c-.3-.15-1.65-.8-1.9-.9-.26-.1-.45-.15-.63.14-.19.28-.72.9-.88 1.08-.16.19-.33.21-.6.07-.28-.14-1.18-.44-2.24-1.39-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.5-.86-2.06-.23-.54-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.72 1.15 2.9c.14.19 1.98 3.02 4.8 4.23.67.29 1.19.46 1.6.6.67.21 1.28.18 1.77.11.54-.08 1.65-.67 1.89-1.32.23-.65.23-1.2.16-1.32-.07-.12-.26-.19-.53-.33z" fill="#fff"/></svg>',
  imessage: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ic-im" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BF675"/><stop offset="1" stop-color="#0BD318"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ic-im)"/><path d="M12 5c-4.4 0-8 2.9-8 6.5 0 2 1.1 3.8 2.9 5-.1 1-.6 1.9-1.2 2.6 1.4-.2 2.6-.7 3.5-1.4.9.2 1.8.4 2.8.4 4.4 0 8-2.9 8-6.5S16.4 5 12 5z" fill="#fff"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ic-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FD5949"/><stop offset=".5" stop-color="#D6249F"/><stop offset="1" stop-color="#8134AF"/></linearGradient></defs><rect width="24" height="24" rx="7" fill="url(#ic-ig)"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="16.4" cy="7.6" r="1" fill="#fff"/></svg>',
  messenger: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ic-ms" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00B2FF"/><stop offset="1" stop-color="#006AFF"/></linearGradient></defs><circle cx="12" cy="12" r="12" fill="url(#ic-ms)"/><path d="M12 5.5c-3.9 0-7 2.9-7 6.5 0 2 1 3.9 2.6 5.1V20l2.4-1.3c.6.2 1.3.3 2 .3 3.9 0 7-2.9 7-6.5s-3.1-7-7-7zm.8 8.7L11 12.3l-3.5 1.9 3.9-4.1 1.8 1.9 3.4-1.9-3.8 4.1z" fill="#fff"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#010101"/><path d="M16.6 8.1a4.3 4.3 0 0 1-2.5-2.4h-2.2v9.2a1.9 1.9 0 1 1-1.9-1.9c.2 0 .4 0 .6.1v-2.3a4.2 4.2 0 0 0-.6 0 4.2 4.2 0 1 0 4.2 4.2v-4.5a6.4 6.4 0 0 0 3.4 1V9.2c-.3 0-.7-.05-1-.15z" fill="#fff"/></svg>',
  android: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1A73E8"/><path d="M6 6.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3 2.5v-10.5a1 1 0 0 1 1-1z" fill="#fff"/></svg>',
};
const APP_SHORT_NAMES = {
  whatsapp: 'WhatsApp', imessage: 'iMessage', instagram: 'Instagram',
  messenger: 'Messenger', tiktok: 'TikTok', android: 'Android',
};

function buildAppPills() {
  const wrap = $('app-pills');
  wrap.innerHTML = '';
  for (const a of APPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'app-pill' + (a.id === state.app ? ' active' : '');
    b.innerHTML = (APP_ICONS[a.id] || '') + '<span>' + (APP_SHORT_NAMES[a.id] || a.name) + '</span>';
    b.title = a.name;
    b.addEventListener('click', () => {
      if (state.app === a.id) return;
      state.app = a.id;
      buildAppPills();
      invalidate();
    });
    wrap.appendChild(b);
  }
}

// Downscale an uploaded photo to a small square dataURL (keeps localStorage light).
function readPhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 192;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const cx = c.getContext('2d');
      const s = Math.max(S / img.width, S / img.height);
      cx.drawImage(img, (S - img.width * s) / 2, (S - img.height * s) / 2, img.width * s, img.height * s);
      cb(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function wirePhoto(fileId, clearId, thumbId, key) {
  const fileInput = $(fileId);
  const updateThumb = () => {
    const th = $(thumbId);
    th.style.backgroundImage = state[key] ? `url(${state[key]})` : 'none';
    th.classList.toggle('has-photo', !!state[key]);
    $(clearId).hidden = !state[key];
  };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    readPhoto(f, (dataUrl) => {
      state[key] = dataUrl;
      updateThumb();
      invalidate();
    });
    fileInput.value = '';
  });
  $(clearId).addEventListener('click', () => {
    state[key] = null;
    updateThumb();
    invalidate();
  });
  updateThumb();
}

function wireControls() {
  buildDeviceSelect();
  buildExportSelect();
  buildAppPills();

  $('contact-status').value = state.contactStatus || '';
  $('contact-status').addEventListener('input', (e) => {
    state.contactStatus = e.target.value;
    invalidate();
  });

  const angleInput = $('angle-slider');
  const angleLabel = $('angle-label');
  const setAngle = (deg) => {
    state.deviceAngle = Math.max(-45, Math.min(45, deg));
    angleInput.value = String(state.deviceAngle);
    angleLabel.textContent = `${state.deviceAngle}°`;
    invalidate();
  };
  angleInput.value = String(state.deviceAngle);
  angleLabel.textContent = `${state.deviceAngle}°`;
  angleInput.addEventListener('input', (e) => setAngle(parseInt(e.target.value, 10) || 0));
  $('angle-left').addEventListener('click', () => setAngle(-45));
  $('angle-zero').addEventListener('click', () => setAngle(0));
  $('angle-right').addEventListener('click', () => setAngle(45));

  $('my-name').value = state.myName;
  $('my-name').addEventListener('input', (e) => {
    state.myName = e.target.value;
    invalidate();
  });
  wirePhoto('contact-photo', 'contact-photo-clear', 'contact-thumb', 'contactPhoto');
  wirePhoto('my-photo', 'my-photo-clear', 'my-thumb', 'myPhoto');

  $('device-select').addEventListener('change', (e) => {
    state.deviceId = e.target.value;
    syncControlVisibility();
    invalidate({ resize: true });
  });

  for (const [id, key] of [['custom-w', 'customDeviceWidth'], ['custom-h', 'customDeviceHeight']]) {
    $(id).value = state[key];
    $(id).addEventListener('input', (e) => {
      state[key] = parseInt(e.target.value, 10) || 0;
      if (state[key] >= 16) invalidate({ resize: true });
    });
  }

  $('portrait-btn').addEventListener('click', () => setOrientation('portrait'));
  $('landscape-btn').addEventListener('click', () => setOrientation('landscape'));
  function setOrientation(o) {
    state.orientation = o;
    $('portrait-btn').classList.toggle('active', o === 'portrait');
    $('landscape-btn').classList.toggle('active', o === 'landscape');
    invalidate({ resize: true });
  }
  setOrientation(state.orientation);

  const toggles = [
    ['frame-toggle', 'showFrame', {}],
    ['dark-toggle', 'darkMode', {}],
    ['typing-toggle', 'showTyping', { restart: true }],
    ['keyboard-toggle', 'showKeyboard', { restart: true }],
    ['sounds-toggle', 'soundsEnabled', {}],
  ];
  for (const [id, key, opts] of toggles) {
    $(id).checked = state[key];
    $(id).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      invalidate(opts);
    });
  }

  $('contact-name').value = state.contactName;
  $('contact-name').addEventListener('input', (e) => {
    state.contactName = e.target.value;
    invalidate();
  });

  $('bg-style').value = state.bgStyle;
  $('bg-style').addEventListener('change', (e) => {
    state.bgStyle = e.target.value;
    syncControlVisibility();
    invalidate();
  });
  $('bg-color').value = state.bgColor;
  $('bg-color').addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    invalidate();
  });

  $('export-res-select').addEventListener('change', (e) => {
    state.exportRes = e.target.value;
    syncControlVisibility();
    invalidate({ resize: true });
  });
  for (const [id, key] of [['export-w', 'customExportWidth'], ['export-h', 'customExportHeight']]) {
    $(id).value = state[key];
    $(id).addEventListener('input', (e) => {
      state[key] = parseInt(e.target.value, 10) || 0;
      invalidate({ resize: true });
    });
  }

  $('fps-select').value = String(state.exportFps);
  $('fps-select').addEventListener('change', (e) => {
    state.exportFps = parseInt(e.target.value, 10);
    persist();
  });

  $('speed-select').value = String(state.playbackSpeed);
  $('speed-select').addEventListener('change', (e) => {
    state.playbackSpeed = parseFloat(e.target.value);
    persist();
  });

  // playback
  const playBtn = $('play-btn');
  function setPlaying(p) {
    playback.playing = p;
    playBtn.textContent = p ? '⏸' : '▶';
    playBtn.title = p ? 'Pause' : 'Play';
  }
  playBtn.addEventListener('click', () => setPlaying(!playback.playing));
  $('restart-btn').addEventListener('click', () => {
    playback.time = 0;
    setPlaying(true);
  });
  $('scrubber').addEventListener('input', (e) => {
    playback.time = (parseInt(e.target.value, 10) / 1000) * timelineDuration();
    playback.playing = false;
    playBtn.textContent = '▶';
    drawPreview();
  });

  // export
  $('export-btn').addEventListener('click', startExport);
  $('export-png-btn').addEventListener('click', exportScreenshot);
  $('share-btn').addEventListener('click', shareConversation);
  $('cancel-export-btn').addEventListener('click', () => Exporter.cancel());

  // browsers require a user gesture before audio can start
  document.addEventListener('pointerdown', () => {
    if (state.soundsEnabled) Sounds.ensure();
  }, { once: false });
}

/* ------------------------------ PNG screenshot ------------------------------ */

function exportScreenshot() {
  const { width, height } = resolveExportSize(state);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  renderFrame(c.getContext('2d'), width, height, playback.time, state, {});
  c.toBlob((blob) => {
    if (!blob) { toast('Screenshot failed', true); return; }
    const device = getDevice(state.deviceId);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${state.app}_${device.id}_${width}x${height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    toast(`Saved PNG screenshot (${width}×${height})`);
  }, 'image/png');
}

/* -------------------------------- share links ------------------------------- */

function shareConversation() {
  const shared = {
    app: state.app, deviceId: state.deviceId, orientation: state.orientation,
    showFrame: state.showFrame, darkMode: state.darkMode, showTyping: state.showTyping,
    showKeyboard: state.showKeyboard, deviceAngle: state.deviceAngle,
    contactName: state.contactName, myName: state.myName,
    messages: state.messages,
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shared))));
  const url = location.origin + location.pathname + '#s=' + encoded;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast('Share link copied — anyone can open & edit this conversation'))
    .catch(() => { prompt('Copy this share link:', url); });
}

/* ------------------------------ message editor ----------------------------- */

const ICON_UP = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M4 9l4 4 4-4"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h11M6.5 2.5h3M5.5 4.5l.5 9h4l.5-9M6.8 7v4M9.2 7v4"/></svg>';

function renderMessageList() {
  const list = $('message-list');
  list.innerHTML = '';
  state.messages.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'msg-card' + (m.sender === 'me' ? ' me' : '');

    const top = document.createElement('div');
    top.className = 'msg-card-top';

    const pills = document.createElement('div');
    pills.className = 'sender-pills';
    for (const [label, val] of [['Contact', 'them'], ['You', 'me']]) {
      const p = document.createElement('button');
      p.type = 'button';
      p.className = 's-pill' + (m.sender === val ? ' active' : '');
      p.textContent = label;
      p.addEventListener('click', () => {
        if (m.sender === val) return;
        m.sender = val;
        renderMessageList();
        invalidate({ restart: true });
      });
      pills.appendChild(p);
    }

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const mkBtn = (svg, title, fn, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = svg; b.title = title; b.disabled = !!disabled;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    mkBtn(ICON_UP, 'Move up', () => {
      [state.messages[i - 1], state.messages[i]] = [state.messages[i], state.messages[i - 1]];
      renderMessageList(); invalidate({ restart: true });
    }, i === 0);
    mkBtn(ICON_DOWN, 'Move down', () => {
      [state.messages[i + 1], state.messages[i]] = [state.messages[i], state.messages[i + 1]];
      renderMessageList(); invalidate({ restart: true });
    }, i === state.messages.length - 1);
    mkBtn(ICON_TRASH, 'Delete', () => {
      state.messages.splice(i, 1);
      renderMessageList(); invalidate({ restart: true });
    });

    top.append(pills, actions);

    const input = document.createElement('textarea');
    input.value = m.text;
    input.rows = 1;
    input.placeholder = 'Message text…';
    const autosize = () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };
    input.addEventListener('input', () => {
      m.text = input.value;
      autosize();
      invalidate();
    });
    requestAnimationFrame(autosize);

    card.append(top, input);
    list.appendChild(card);
  });
}

function wireEditor() {
  renderMessageList();
  $('add-them-btn').addEventListener('click', () => addMessage('them'));
  $('add-me-btn').addEventListener('click', () => addMessage('me'));
  function addMessage(sender) {
    state.messages.push({ sender, text: '' });
    renderMessageList();
    invalidate({ restart: true });
    const areas = document.querySelectorAll('#message-list textarea');
    areas[areas.length - 1]?.focus();
  }
}

/* ---------------------------------- export --------------------------------- */

function startExport() {
  if (Exporter.active) return;
  const wasPlaying = playback.playing;
  playback.playing = false;

  const panel = $('export-progress');
  const bar = $('progress-bar');
  const label = $('progress-label');
  panel.hidden = false;
  $('export-btn').disabled = true;
  bar.style.width = '0%';
  const ex = resolveExportSize(state);
  label.textContent = `Recording ${ex.width}×${ex.height} @ ${state.exportFps}fps…`;

  Exporter.export(state, {
    onProgress: (p) => { bar.style.width = (p * 100).toFixed(1) + '%'; },
    onDone: (result) => {
      panel.hidden = true;
      $('export-btn').disabled = false;
      playback.playing = wasPlaying;
      if (!result) return; // cancelled
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast(`Saved ${result.filename} (${result.width}×${result.height})`);
    },
    onError: (err) => {
      panel.hidden = true;
      $('export-btn').disabled = false;
      playback.playing = wasPlaying;
      toast('Export failed: ' + (err?.message || err), true);
    },
  });
}

let toastTimer = null;
function toast(msg, isError = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/* ----------------------------------- boot ---------------------------------- */

/* ------------------------------ hero live demo ------------------------------ */

(function heroDemo() {
  const hc = document.getElementById('hero-demo-canvas');
  if (!hc) return;
  const hctx = hc.getContext('2d');
  const demoState = {
    deviceId: 'iphone-16-pro', orientation: 'portrait', app: 'whatsapp',
    deviceAngle: 0, showFrame: true, darkMode: false, showTyping: true,
    showKeyboard: true, contactName: 'Maya', contactPhoto: null, myName: 'Me', myPhoto: null,
    bgStyle: 'solid', bgColor: 'rgba(0,0,0,0)',
    messages: [
      { sender: 'them', text: 'wait… you made this video with a free tool?? 😱' },
      { sender: 'me', text: 'Yep. Typing, sounds, 4K export' },
      { sender: 'them', text: 'no watermark?' },
      { sender: 'me', text: 'None. Scroll down and try it 👇' },
    ],
  };
  const cache = {};
  const tl = computeTimeline(demoState);
  let t = 0, last = null;
  function tick(now) {
    if (last != null) {
      t += (now - last) / 1000;
      if (t > tl.duration + 1) t = 0;
    }
    last = now;
    // only render while visible
    const r = hc.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      renderFrame(hctx, hc.width, hc.height, t, demoState, cache);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

renderCache.onImageLoad = () => drawPreview();
wireControls();
wireEditor();
syncControlVisibility();
sizePreviewCanvas();
drawPreview();
requestAnimationFrame(loop);

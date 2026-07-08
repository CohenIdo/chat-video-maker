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
  contactName: 'Alex',
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
      playback.time += ((now - playback.lastFrame) / 1000) * state.playbackSpeed;
      const dur = timelineDuration();
      if (playback.time >= dur + 0.6) playback.time = 0; // loop with a beat of rest
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

function buildAppSelect() {
  const sel = $('app-select');
  sel.innerHTML = '';
  for (const a of APPS) {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    sel.appendChild(opt);
  }
  sel.value = state.app;
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
  buildAppSelect();

  $('app-select').addEventListener('change', (e) => {
    state.app = e.target.value;
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
  $('cancel-export-btn').addEventListener('click', () => Exporter.cancel());
}

/* ------------------------------ message editor ----------------------------- */

function renderMessageList() {
  const list = $('message-list');
  list.innerHTML = '';
  state.messages.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'msg-row' + (m.sender === 'me' ? ' me' : '');

    const senderBtn = document.createElement('button');
    senderBtn.className = 'sender-btn';
    senderBtn.textContent = m.sender === 'me' ? 'Me' : 'Them';
    senderBtn.title = 'Toggle sender';
    senderBtn.addEventListener('click', () => {
      m.sender = m.sender === 'me' ? 'them' : 'me';
      renderMessageList();
      invalidate({ restart: true });
    });

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

    const controls = document.createElement('div');
    controls.className = 'msg-controls';
    const mkBtn = (label, title, fn, disabled) => {
      const b = document.createElement('button');
      b.textContent = label; b.title = title; b.disabled = !!disabled;
      b.addEventListener('click', fn);
      controls.appendChild(b);
    };
    mkBtn('↑', 'Move up', () => {
      [state.messages[i - 1], state.messages[i]] = [state.messages[i], state.messages[i - 1]];
      renderMessageList(); invalidate({ restart: true });
    }, i === 0);
    mkBtn('↓', 'Move down', () => {
      [state.messages[i + 1], state.messages[i]] = [state.messages[i], state.messages[i + 1]];
      renderMessageList(); invalidate({ restart: true });
    }, i === state.messages.length - 1);
    mkBtn('✕', 'Delete', () => {
      state.messages.splice(i, 1);
      renderMessageList(); invalidate({ restart: true });
    });

    row.append(senderBtn, input, controls);
    list.appendChild(row);
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

renderCache.onImageLoad = () => drawPreview();
wireControls();
wireEditor();
syncControlVisibility();
sizePreviewCanvas();
drawPreview();
requestAnimationFrame(loop);

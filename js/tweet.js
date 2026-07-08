// Fake Tweet / X post generator — standalone app sharing the chat renderer's
// helpers (roundRect, wrapText, drawAvatar, IMG_CACHE) and the sound engine.
// The differentiator: counters ANIMATE (roll up) and the like button bursts,
// exported as video — competitors only produce static images.

/* ----------------------------------- state ---------------------------------- */

const tstate = {
  name: 'Elon Notmusk',
  handle: 'definitelyreal',
  verified: true,
  avatar: null,
  text: 'I made this tweet with a free fake tweet generator that exports an ANIMATED video. The like counter actually rolls up 🤯',
  image: null,
  time: '9:41 AM',
  date: 'Jul 8, 2026',
  views: 2400000,
  replies: 1843,
  reposts: 12400,
  likes: 89300,
  bookmarks: 4120,
  theme: 'light',
  bgStyle: 'gradient',
  bgColor: '#17191e',
  format: 'square',
  animate: true,
  soundsEnabled: true,
};

const T_STORAGE = 'tweet-simulator-v1';
try {
  const saved = JSON.parse(localStorage.getItem(T_STORAGE));
  if (saved && typeof saved.text === 'string') Object.assign(tstate, saved);
} catch { /* fresh start */ }

// Shared-tweet links (#s=...)
try {
  const m = location.hash.match(/[#&]s=([^&]+)/);
  if (m) {
    const shared = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (shared && typeof shared.text === 'string') {
      delete shared.avatar; delete shared.image;
      Object.assign(tstate, shared);
    }
  }
} catch { /* malformed link */ }

function tpersist() {
  try { localStorage.setItem(T_STORAGE, JSON.stringify(tstate)); } catch { /* full */ }
}

const FORMATS = {
  square: { w: 1080, h: 1080, name: 'Square 1080×1080' },
  vertical: { w: 1080, h: 1920, name: 'Vertical 1080×1920 (Reels/TikTok)' },
  wide: { w: 1920, h: 1080, name: 'Wide 1920×1080 (YouTube)' },
};

const TWEET_THEMES = {
  light: { card: '#ffffff', text: '#0f1419', sub: '#536471', border: '#eff3f4', badge: '#1d9bf0' },
  dim: { card: '#15202b', text: '#f7f9f9', sub: '#8b98a5', border: '#38444d', badge: '#1d9bf0' },
  dark: { card: '#000000', text: '#e7e9ea', sub: '#71767b', border: '#2f3336', badge: '#1d9bf0' },
};
const LIKE_RED = '#f91880';

const ANIM = { fadeIn: 0.35, countStart: 0.55, countDur: 2.4, likeAt: 1.9, duration: 5.2 };

/* --------------------------------- formatting -------------------------------- */

function fmtCount(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n < 10e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n < 10e3 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return String(n);
}

function animCount(target, t) {
  if (!tstate.animate) return target;
  const p = easeOutCubic(clamp01((t - ANIM.countStart) / ANIM.countDur));
  return target * p;
}

/* --------------------------------- tweet card -------------------------------- */

// All card drawing uses a 600-wide logical card, scaled by `u`.
function measureCard(u) {
  const len = (tstate.text || '').length;
  const fontSize = len <= 90 ? 24 : len <= 200 ? 19 : 17;
  const lineHeight = fontSize * 1.32;
  const font = `400 ${fontSize}px ${FONT_STACK}`;
  const { lines } = wrapText(tstate.text || ' ', font, 552);
  const img = tstate.image ? IMG_CACHE.get(tstate.image) : null;
  const imgOk = img && img.complete && img.naturalWidth;
  const imgH = imgOk ? Math.min(320, 552 / (img.naturalWidth / img.naturalHeight)) : 0;
  let h = 24 + 48 + 16;                       // padding + author row
  h += lines.length * lineHeight + 8;
  if (imgOk) h += imgH + 12;
  h += 30 + 12;                               // time/views row
  h += 1 + 46;                                // separator + action row
  return { lines, font, fontSize, lineHeight, imgOk, imgH, h, img };
}

function drawTweetCard(ctx, cx, cy, u, t) {
  const th = TWEET_THEMES[tstate.theme] || TWEET_THEMES.light;
  const m = measureCard(u);
  const W = 600, H = m.h;
  const x0 = cx - (W * u) / 2, y0 = cy - (H * u) / 2;

  ctx.save();
  // entrance
  const ap = tstate.animate ? easeOutBack(clamp01(t / ANIM.fadeIn)) : 1;
  ctx.globalAlpha = Math.min(1, ap * 1.4);
  ctx.translate(cx, cy);
  ctx.scale(0.92 + 0.08 * ap, 0.92 + 0.08 * ap);
  ctx.translate(-cx, -cy);

  ctx.translate(x0, y0);
  ctx.scale(u, u);

  // card
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = th.card;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = th.border; ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 18);
  ctx.stroke();

  // author row
  drawAvatar(ctx, 24 + 24, 24 + 24, 24, tstate.name || '?', tstate.avatar);
  ctx.fillStyle = th.text;
  ctx.font = `700 17px ${FONT_STACK}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const nameW = ctx.measureText(tstate.name).width;
  ctx.fillText(tstate.name, 84, 24 + 14);
  if (tstate.verified) {
    const bx = 84 + nameW + 12, by = 24 + 14;
    ctx.fillStyle = th.badge;
    // scalloped seal ≈ circle
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      ctx.arc(bx + Math.cos(a) * 8.4, by + Math.sin(a) * 8.4, 3.2, 0, Math.PI * 2);
    }
    ctx.arc(bx, by, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 4, by + 0.5); ctx.lineTo(bx - 1.2, by + 3.4); ctx.lineTo(bx + 4.4, by - 3);
    ctx.stroke();
  }
  ctx.fillStyle = th.sub;
  ctx.font = `400 15px ${FONT_STACK}`;
  ctx.fillText('@' + tstate.handle, 84, 24 + 35);
  // kebab
  ctx.fillStyle = th.sub;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.arc(W - 30 + i * 7, 24 + 14, 1.9, 0, Math.PI * 2); ctx.fill();
  }

  // text
  let y = 24 + 48 + 16;
  ctx.fillStyle = th.text;
  ctx.font = m.font;
  ctx.textBaseline = 'alphabetic';
  for (const line of m.lines) {
    y += m.lineHeight;
    ctx.fillText(line, 24, y - m.lineHeight * 0.28);
  }
  y += 8;

  // attached image
  if (m.imgOk) {
    ctx.save();
    roundRect(ctx, 24, y, 552, m.imgH, 16);
    ctx.clip();
    const img = m.img;
    const s = Math.max(552 / img.naturalWidth, m.imgH / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    ctx.drawImage(img, 24 + (552 - iw) / 2, y + (m.imgH - ih) / 2, iw, ih);
    ctx.restore();
    ctx.strokeStyle = th.border;
    roundRect(ctx, 24.5, y + 0.5, 551, m.imgH - 1, 16);
    ctx.stroke();
    y += m.imgH + 12;
  }

  // time · date · views
  ctx.textBaseline = 'middle';
  const rowY = y + 15;
  ctx.font = `400 15px ${FONT_STACK}`;
  ctx.fillStyle = th.sub;
  const timeStr = `${tstate.time} · ${tstate.date} · `;
  ctx.fillText(timeStr, 24, rowY);
  const tw1 = ctx.measureText(timeStr).width;
  ctx.font = `700 15px ${FONT_STACK}`;
  ctx.fillStyle = th.text;
  const viewsStr = fmtCount(animCount(tstate.views, t));
  ctx.fillText(viewsStr, 24 + tw1, rowY);
  ctx.font = `400 15px ${FONT_STACK}`;
  ctx.fillStyle = th.sub;
  ctx.fillText(' Views', 24 + tw1 + ctx.measureText(viewsStr).width + 2, rowY);
  y += 30 + 12;

  // separator
  ctx.fillStyle = th.border;
  ctx.fillRect(24, y, 552, 1);
  y += 1;

  // action row
  const liked = tstate.animate ? t >= ANIM.likeAt : true;
  const midY = y + 23;
  const slots = [24, 24 + 138, 24 + 276, 24 + 414, W - 44];
  drawReplyIcon(ctx, slots[0] + 11, midY, th.sub);
  drawCount(ctx, slots[0] + 26, midY, fmtCount(animCount(tstate.replies, t)), th.sub);
  drawRepostIcon(ctx, slots[1] + 11, midY, th.sub);
  drawCount(ctx, slots[1] + 26, midY, fmtCount(animCount(tstate.reposts, t)), th.sub);
  drawHeartIcon(ctx, slots[2] + 11, midY, liked ? LIKE_RED : th.sub, liked, tstate.animate ? t : 99);
  drawCount(ctx, slots[2] + 26, midY, fmtCount(animCount(tstate.likes, t)), liked ? LIKE_RED : th.sub);
  drawBookmarkIcon(ctx, slots[3] + 11, midY, th.sub);
  drawCount(ctx, slots[3] + 26, midY, fmtCount(animCount(tstate.bookmarks, t)), th.sub);
  drawShareIcon(ctx, slots[4], midY, th.sub);

  ctx.restore();
  return { cardH: H * u, cardW: W * u };
}

function drawCount(ctx, x, y, str, color) {
  ctx.fillStyle = color;
  ctx.font = `400 14px ${FONT_STACK}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y + 0.5);
}

function drawReplyIcon(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 8.5, cy - 1);
  ctx.arc(cx, cy - 1, 8.5, 0, Math.PI, true);
  ctx.arc(cx, cy - 1, 8.5, Math.PI, Math.PI * 0.62, true);
  ctx.lineTo(cx - 6.5, cy + 8.5);
  ctx.lineTo(cx - 3, cy + 7.2);
  ctx.stroke();
}

function drawRepostIcon(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 2.5); ctx.lineTo(cx - 8, cy - 3);
  ctx.quadraticCurveTo(cx - 8, cy - 6, cx - 5, cy - 6);
  ctx.lineTo(cx + 3, cy - 6);
  ctx.moveTo(cx + 0.5, cy - 8.5); ctx.lineTo(cx + 3.5, cy - 6); ctx.lineTo(cx + 0.5, cy - 3.5);
  ctx.moveTo(cx + 8, cy - 2.5); ctx.lineTo(cx + 8, cy + 3);
  ctx.quadraticCurveTo(cx + 8, cy + 6, cx + 5, cy + 6);
  ctx.lineTo(cx - 3, cy + 6);
  ctx.moveTo(cx - 0.5, cy + 8.5); ctx.lineTo(cx - 3.5, cy + 6); ctx.lineTo(cx - 0.5, cy + 3.5);
  ctx.stroke();
}

const HEART_PATH = new Path2D('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');

function drawHeartIcon(ctx, cx, cy, color, filled, t) {
  // burst ring right after the like lands
  const burst = clamp01((t - ANIM.likeAt) / 0.4);
  ctx.save();
  const pop = filled ? 1 + 0.35 * Math.sin(Math.min(1, burst) * Math.PI) : 1;
  ctx.translate(cx - 10 * pop, cy - 10 * pop);
  ctx.scale((20 / 24) * pop, (20 / 24) * pop);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill(HEART_PATH);
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.stroke(HEART_PATH);
  }
  ctx.restore();
  if (filled && burst > 0 && burst < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - burst;
    ctx.strokeStyle = LIKE_RED;
    ctx.lineWidth = 2 * (1 - burst) + 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + burst * 14, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const r = 14 + burst * 18;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2 * (1 - burst), 0, Math.PI * 2);
      ctx.fillStyle = LIKE_RED;
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBookmarkIcon(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 8.5);
  ctx.lineTo(cx + 6, cy - 8.5);
  ctx.lineTo(cx + 6, cy + 8.5);
  ctx.lineTo(cx, cy + 3.5);
  ctx.lineTo(cx - 6, cy + 8.5);
  ctx.closePath();
  ctx.stroke();
}

function drawShareIcon(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2.5); ctx.lineTo(cx, cy - 8.5);
  ctx.moveTo(cx - 4, cy - 4.5); ctx.lineTo(cx, cy - 8.5); ctx.lineTo(cx + 4, cy - 4.5);
  ctx.moveTo(cx - 8, cy - 0.5); ctx.lineTo(cx - 8, cy + 6.5);
  ctx.quadraticCurveTo(cx - 8, cy + 8.5, cx - 6, cy + 8.5);
  ctx.lineTo(cx + 6, cy + 8.5);
  ctx.quadraticCurveTo(cx + 8, cy + 8.5, cx + 8, cy + 6.5);
  ctx.lineTo(cx + 8, cy - 0.5);
  ctx.stroke();
}

/* -------------------------------- frame render ------------------------------- */

function renderTweetFrame(ctx, cw, ch, t) {
  ensureImage(tstate.avatar, tcache.onImageLoad);
  ensureImage(tstate.image, tcache.onImageLoad);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (tstate.bgStyle === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, '#20242e'); g.addColorStop(0.55, '#171a21'); g.addColorStop(1, '#22262f');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = tstate.bgColor || '#17191e';
  }
  ctx.fillRect(0, 0, cw, ch);

  // fit the card
  const probeU = 1;
  const m = measureCard(probeU);
  const maxW = cw * 0.82, maxH = ch * 0.82;
  const u = Math.min(maxW / 600, maxH / m.h);
  drawTweetCard(ctx, cw / 2, ch / 2, u, t);
}

/* ---------------------------------- app shell -------------------------------- */

const tcache = {};
const tCanvas = document.getElementById('tweet-canvas');
const tCtx = tCanvas.getContext('2d');
const tplayback = { playing: true, time: 0, lastFrame: null };

function sizeTweetCanvas() {
  const f = FORMATS[tstate.format] || FORMATS.square;
  const cap = 1400;
  const scale = Math.min(1, cap / Math.max(f.w, f.h));
  tCanvas.width = Math.round(f.w * scale);
  tCanvas.height = Math.round(f.h * scale);
  document.getElementById('t-res-badge').textContent = `${f.w} × ${f.h}`;
}

function drawTweetPreview() {
  renderTweetFrame(tCtx, tCanvas.width, tCanvas.height, tplayback.time);
  const scrub = document.getElementById('t-scrubber');
  if (!scrub.matches(':active')) scrub.value = String(Math.min(1, tplayback.time / ANIM.duration) * 1000);
  document.getElementById('t-time-label').textContent =
    `${tplayback.time.toFixed(1)}s / ${ANIM.duration.toFixed(1)}s`;
}

let tPrevSoundT = 0;
function tloop(now) {
  if (tplayback.playing) {
    if (tplayback.lastFrame != null) {
      const prevT = tplayback.time;
      tplayback.time += (now - tplayback.lastFrame) / 1000;
      if (tplayback.time >= ANIM.duration + 0.8) { tplayback.time = 0; tPrevSoundT = 0; }
      if (tstate.soundsEnabled && tstate.animate && Sounds.ctx) {
        if (prevT < 0.12 && tplayback.time >= 0.12) Sounds.send('imessage');
        if (prevT < ANIM.likeAt && tplayback.time >= ANIM.likeAt) Sounds.receive('instagram');
      }
    }
    tplayback.lastFrame = now;
    drawTweetPreview();
  } else {
    tplayback.lastFrame = null;
  }
  requestAnimationFrame(tloop);
}

function tinvalidate() {
  drawTweetPreview();
  tpersist();
}

/* ----------------------------------- wiring ---------------------------------- */

const $t = (id) => document.getElementById(id);

function twire() {
  const bind = (id, key, { numeric = false, evt = 'input' } = {}) => {
    $t(id).value = tstate[key];
    $t(id).addEventListener(evt, (e) => {
      tstate[key] = numeric ? (parseInt(String(e.target.value).replace(/[^\d]/g, ''), 10) || 0) : e.target.value;
      tinvalidate();
    });
  };
  bind('t-name', 'name');
  bind('t-handle', 'handle');
  bind('t-text', 'text');
  bind('t-time', 'time');
  bind('t-date', 'date');
  bind('t-views', 'views', { numeric: true });
  bind('t-replies', 'replies', { numeric: true });
  bind('t-reposts', 'reposts', { numeric: true });
  bind('t-likes', 'likes', { numeric: true });
  bind('t-bookmarks', 'bookmarks', { numeric: true });

  $t('t-theme').value = tstate.theme;
  $t('t-theme').addEventListener('change', (e) => { tstate.theme = e.target.value; tinvalidate(); });
  $t('t-bg-style').value = tstate.bgStyle;
  $t('t-bg-style').addEventListener('change', (e) => {
    tstate.bgStyle = e.target.value;
    $t('t-bg-color-row').hidden = tstate.bgStyle !== 'solid';
    tinvalidate();
  });
  $t('t-bg-color-row').hidden = tstate.bgStyle !== 'solid';
  $t('t-bg-color').value = tstate.bgColor;
  $t('t-bg-color').addEventListener('input', (e) => { tstate.bgColor = e.target.value; tinvalidate(); });
  $t('t-format').value = tstate.format;
  $t('t-format').addEventListener('change', (e) => { tstate.format = e.target.value; sizeTweetCanvas(); tinvalidate(); });

  for (const [id, key] of [['t-verified', 'verified'], ['t-animate', 'animate'], ['t-sounds', 'soundsEnabled']]) {
    $t(id).checked = tstate[key];
    $t(id).addEventListener('change', (e) => {
      tstate[key] = e.target.checked;
      tplayback.time = 0;
      tinvalidate();
    });
  }

  // photo pickers (avatar + attached image)
  const photo = (fileId, clearId, key, thumbId) => {
    const update = () => {
      if (thumbId) {
        $t(thumbId).style.backgroundImage = tstate[key] ? `url(${tstate[key]})` : 'none';
        $t(thumbId).classList.toggle('has-photo', !!tstate[key]);
      }
      $t(clearId).hidden = !tstate[key];
    };
    $t(fileId).addEventListener('change', () => {
      const f = $t(fileId).files && $t(fileId).files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = key === 'avatar' ? 192 : 900;
          const s = Math.min(1, MAX / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          tstate[key] = c.toDataURL('image/jpeg', 0.85);
          update(); tinvalidate();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
      $t(fileId).value = '';
    });
    $t(clearId).addEventListener('click', () => { tstate[key] = null; update(); tinvalidate(); });
    update();
  };
  photo('t-avatar-file', 't-avatar-clear', 'avatar', 't-avatar-thumb');
  photo('t-image-file', 't-image-clear', 'image', null);

  // transport
  const playBtn = $t('t-play-btn');
  const setPlaying = (p) => { tplayback.playing = p; playBtn.textContent = p ? '⏸' : '▶'; };
  playBtn.addEventListener('click', () => setPlaying(!tplayback.playing));
  $t('t-restart-btn').addEventListener('click', () => { tplayback.time = 0; tPrevSoundT = 0; setPlaying(true); });
  $t('t-scrubber').addEventListener('input', (e) => {
    tplayback.time = (parseInt(e.target.value, 10) / 1000) * ANIM.duration;
    setPlaying(false);
    drawTweetPreview();
  });

  $t('t-export-png').addEventListener('click', exportTweetPNG);
  $t('t-export-video').addEventListener('click', exportTweetVideo);
  $t('t-share').addEventListener('click', shareTweet);
  $t('t-cancel-export').addEventListener('click', () => { tExportCancel = true; });

  document.addEventListener('pointerdown', () => { if (tstate.soundsEnabled) Sounds.ensure(); });
}

/* ---------------------------------- exports ---------------------------------- */

function exportTweetPNG() {
  const f = FORMATS[tstate.format];
  const c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  renderTweetFrame(c.getContext('2d'), f.w, f.h, tstate.animate ? ANIM.duration : 0);
  c.toBlob((blob) => {
    if (!blob) return ttoast('Screenshot failed', true);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fake_tweet_${f.w}x${f.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    ttoast(`Saved PNG (${f.w}×${f.h})`);
  }, 'image/png');
}

let tExportCancel = false;
async function exportTweetVideo() {
  if ($t('t-export-video').disabled) return;
  tExportCancel = false;
  const f = FORMATS[tstate.format];
  const fps = 60;
  const c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  const ctx = c.getContext('2d', { alpha: false });

  const wantAudio = tstate.soundsEnabled && tstate.animate && !!(window.AudioContext || window.webkitAudioContext);
  const audioStream = wantAudio ? Sounds.attachRecorder() : null;
  const mimeType = Exporter.pickMimeType(!!audioStream);
  if (!mimeType) return ttoast('Video recording is not supported in this browser', true);

  const stream = c.captureStream(fps);
  if (audioStream) for (const tr of audioStream.getAudioTracks()) stream.addTrack(tr);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.min(40_000_000, f.w * f.h * fps * 0.12),
  });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res, rej) => { recorder.onstop = res; recorder.onerror = (e) => rej(e.error); });

  const panel = $t('t-export-progress');
  panel.hidden = false;
  $t('t-export-video').disabled = true;
  const wasPlaying = tplayback.playing;
  tplayback.playing = false;

  try {
    renderTweetFrame(ctx, f.w, f.h, 0);
    recorder.start(250);
    await new Promise((resolve) => {
      let t = 0, lastNow = performance.now();
      const timer = setInterval(() => {
        if (tExportCancel) { clearInterval(timer); return resolve(); }
        const now = performance.now();
        let dt = (now - lastNow) / 1000;
        lastNow = now;
        if (dt > 0.25) dt = 1 / fps;
        const prevT = t;
        t = Math.min(t + dt, ANIM.duration);
        renderTweetFrame(ctx, f.w, f.h, t);
        if (audioStream) {
          if (prevT < 0.12 && t >= 0.12) Sounds.send('imessage');
          if (prevT < ANIM.likeAt && t >= ANIM.likeAt) Sounds.receive('instagram');
        }
        $t('t-progress-bar').style.width = ((t / ANIM.duration) * 100).toFixed(1) + '%';
        if (t >= ANIM.duration) { clearInterval(timer); resolve(); }
      }, 1000 / fps);
    });
    recorder.stop();
    await done;
    stream.getTracks().forEach(tr => tr.stop());
    if (!tExportCancel) {
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fake_tweet_animated_${f.w}x${f.h}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      ttoast(`Saved animated video (${f.w}×${f.h})`);
    }
  } catch (err) {
    console.error(err);
    ttoast('Export failed: ' + (err?.message || err), true);
  } finally {
    Sounds.detachRecorder();
    panel.hidden = true;
    $t('t-export-video').disabled = false;
    tplayback.playing = wasPlaying;
  }
}

function shareTweet() {
  const shared = { ...tstate };
  delete shared.avatar; delete shared.image;
  const url = location.origin + location.pathname + '#s=' +
    btoa(unescape(encodeURIComponent(JSON.stringify(shared))));
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => ttoast('Share link copied — anyone can open & edit this tweet'))
    .catch(() => prompt('Copy this share link:', url));
}

let ttoastTimer = null;
function ttoast(msg, isError = false) {
  const el = $t('t-toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(ttoastTimer);
  ttoastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/* ------------------------------------ boot ----------------------------------- */

tcache.onImageLoad = () => drawTweetPreview();
twire();
sizeTweetCanvas();
drawTweetPreview();
requestAnimationFrame(tloop);

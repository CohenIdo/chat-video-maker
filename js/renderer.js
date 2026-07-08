// Resolution-independent canvas renderer.
// Everything is laid out in logical points, then drawn through a scale
// transform — so the same code produces the preview and the export at any
// pixel resolution with identical layout and crisp text.

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const _measureCtx = document.createElement('canvas').getContext('2d');

// Avatar image cache: dataURL/URL → HTMLImageElement (app.js preloads these).
const IMG_CACHE = new Map();
function ensureImage(url, onload) {
  if (!url) return null;
  let img = IMG_CACHE.get(url);
  if (!img) {
    img = new Image();
    img.onload = () => onload && onload();
    img.src = url;
    IMG_CACHE.set(url, img);
  }
  return img;
}

/* ---------------------------------- easing --------------------------------- */

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
function easeOutBack(p) {
  const c1 = 1.35, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/* -------------------------------- app skins -------------------------------- */

const APPS = [
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'imessage', name: 'iMessage' },
  { id: 'instagram', name: 'Instagram DM' },
  { id: 'messenger', name: 'Messenger' },
  { id: 'tiktok', name: 'TikTok DM' },
  { id: 'android', name: 'Android Messages' },
];

// Returns the full visual spec for an app skin.
function appStyle(app, dark) {
  switch (app) {
    case 'whatsapp': return {
      id: 'whatsapp',
      bg: dark ? '#0b141a' : '#efeae2',
      headerBg: dark ? '#202c33' : '#008069', headerText: '#ffffff', headerSub: 'rgba(255,255,255,0.75)',
      headerVariant: 'left', headerSubtitle: 'online', headerOverStatus: true,
      statusBar: '#ffffff',
      sentBg: dark ? '#005c4b' : '#d9fdd3', sentText: dark ? '#e9edef' : '#111b21',
      recvBg: dark ? '#202c33' : '#ffffff', recvText: dark ? '#e9edef' : '#111b21',
      bubbleRadius: 9, tail: 'whatsapp', meta: true, metaColor: dark ? '#8696a0' : '#667781',
      tickColor: '#53bdeb', fontSize: 16, lineHeight: 21,
      recvAvatar: false, sentAvatar: false,
      inputVariant: 'whatsapp', inputBg: dark ? '#202c33' : '#ffffff',
      inputBarBg: dark ? '#111b21' : '#f0f2f5', inputText: dark ? '#8696a0' : '#8696a0',
      inputPlaceholder: 'Message', accent: '#00a884',
      dayVariant: 'chip', dayChipBg: dark ? '#182229' : '#ffffff', dayText: dark ? '#8696a0' : '#54656f',
      homeBar: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
    };
    case 'instagram': return {
      id: 'instagram',
      bg: dark ? '#000000' : '#ffffff',
      headerBg: dark ? '#000000' : '#ffffff', headerText: dark ? '#f5f5f5' : '#0f0f0f', headerSub: dark ? '#a8a8a8' : '#8e8e8e',
      headerVariant: 'left', headerSubtitle: 'Active now', headerOverStatus: false,
      statusBar: dark ? '#ffffff' : '#000000',
      sentBg: { grad: ['#7a3ff2', '#c32aa3'] }, sentText: '#ffffff',
      recvBg: dark ? '#262626' : '#efefef', recvText: dark ? '#f5f5f5' : '#0f0f0f',
      bubbleRadius: 19, tail: 'none', meta: false, fontSize: 15.5, lineHeight: 20.5,
      recvAvatar: true, sentAvatar: false,
      inputVariant: 'instagram', inputBg: dark ? '#262626' : '#efefef',
      inputBarBg: dark ? '#000000' : '#ffffff', inputText: dark ? '#a8a8a8' : '#8e8e8e',
      inputPlaceholder: 'Message…', accent: '#3797f0',
      dayVariant: 'plain', dayText: dark ? '#a8a8a8' : '#8e8e8e',
      homeBar: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
      separator: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    };
    case 'messenger': return {
      id: 'messenger',
      bg: dark ? '#000000' : '#ffffff',
      headerBg: dark ? '#000000' : '#ffffff', headerText: dark ? '#f5f5f5' : '#050505', headerSub: dark ? '#a8a8a8' : '#65676b',
      headerVariant: 'left', headerSubtitle: 'Active now', headerOverStatus: false,
      statusBar: dark ? '#ffffff' : '#000000',
      sentBg: { grad: ['#0695ff', '#3b48f5'] }, sentText: '#ffffff',
      recvBg: dark ? '#303030' : '#f0f0f0', recvText: dark ? '#f5f5f5' : '#050505',
      bubbleRadius: 18, tail: 'none', meta: false, fontSize: 15.5, lineHeight: 20.5,
      recvAvatar: true, sentAvatar: false,
      inputVariant: 'messenger', inputBg: dark ? '#303030' : '#f0f2f5',
      inputBarBg: dark ? '#000000' : '#ffffff', inputText: dark ? '#a8a8a8' : '#65676b',
      inputPlaceholder: 'Aa', accent: '#0084ff',
      dayVariant: 'plain', dayText: dark ? '#a8a8a8' : '#65676b',
      homeBar: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
      separator: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    };
    case 'tiktok': return {
      id: 'tiktok',
      bg: dark ? '#121212' : '#ffffff',
      headerBg: dark ? '#121212' : '#ffffff', headerText: dark ? '#f1f1f2' : '#161823', headerSub: dark ? '#8a8b91' : '#86878b',
      headerVariant: 'center', headerSubtitle: null, headerOverStatus: false,
      statusBar: dark ? '#ffffff' : '#000000',
      sentBg: '#fe2c55', sentText: '#ffffff',
      recvBg: dark ? '#2a2a2d' : '#f1f1f2', recvText: dark ? '#f1f1f2' : '#161823',
      bubbleRadius: 12, tail: 'none', meta: false, fontSize: 15.5, lineHeight: 20.5,
      recvAvatar: true, sentAvatar: true,
      inputVariant: 'tiktok', inputBg: dark ? '#2a2a2d' : '#f1f1f2',
      inputBarBg: dark ? '#121212' : '#ffffff', inputText: dark ? '#8a8b91' : '#86878b',
      inputPlaceholder: 'Send a message…', accent: '#fe2c55',
      dayVariant: 'plain', dayText: dark ? '#8a8b91' : '#86878b',
      homeBar: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
      separator: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    };
    case 'android': return {
      id: 'android',
      bg: dark ? '#121316' : '#ffffff',
      headerBg: dark ? '#1e1f23' : '#f2f4f8', headerText: dark ? '#e3e3e8' : '#1b1c1f', headerSub: dark ? '#9aa0a6' : '#5f6368',
      headerVariant: 'left', headerSubtitle: null, headerOverStatus: false,
      statusBar: dark ? '#e3e3e8' : '#1b1c1f',
      sentBg: dark ? '#a8c7fa' : '#0b57d0', sentText: dark ? '#0b2a55' : '#ffffff',
      recvBg: dark ? '#2d2f33' : '#e9eef6', recvText: dark ? '#e3e3e8' : '#1b1c1f',
      bubbleRadius: 18, tail: 'none', meta: false, fontSize: 16, lineHeight: 21,
      recvAvatar: false, sentAvatar: false,
      inputVariant: 'android', inputBg: dark ? '#26282c' : '#eef1f5',
      inputBarBg: dark ? '#121316' : '#ffffff', inputText: dark ? '#9aa0a6' : '#5f6368',
      inputPlaceholder: 'Text message', accent: dark ? '#a8c7fa' : '#0b57d0',
      dayVariant: 'plain', dayText: dark ? '#9aa0a6' : '#5f6368',
      homeBar: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
      separator: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    };
    default: return { // imessage
      id: 'imessage',
      bg: dark ? '#000000' : '#ffffff',
      headerBg: dark ? 'rgba(22,22,24,0.94)' : 'rgba(250,250,250,0.96)',
      headerText: dark ? '#ffffff' : '#000000', headerSub: dark ? '#98989f' : '#8e8e93',
      headerVariant: 'ios', headerSubtitle: null, headerOverStatus: false,
      statusBar: dark ? '#ffffff' : '#000000',
      sentBg: dark ? '#0a84ff' : '#007aff', sentText: '#ffffff',
      recvBg: dark ? '#26262a' : '#e9e9eb', recvText: dark ? '#ffffff' : '#000000',
      bubbleRadius: 18, tail: 'imessage', meta: false, fontSize: 17, lineHeight: 22,
      recvAvatar: false, sentAvatar: false,
      inputVariant: 'imessage', inputBg: dark ? '#1c1c1e' : '#ffffff',
      inputBarBg: dark ? '#0a0a0a' : 'rgba(250,250,250,0.96)', inputText: dark ? '#7c7c82' : '#c0c0c6',
      inputPlaceholder: 'iMessage', accent: dark ? '#0a84ff' : '#007aff',
      dayVariant: 'plain', dayText: dark ? '#98989f' : '#8e8e93',
      homeBar: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
      separator: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      delivered: true, metaColor: dark ? '#8e8e93' : '#8e8e93',
    };
  }
}

/* --------------------------------- avatars --------------------------------- */

const AVATAR_GRADIENTS = [
  ['#8e9bb5', '#6d7994'], ['#f0945e', '#d96e3a'], ['#67b26f', '#4ca2a8'],
  ['#a18cd1', '#7b6bb7'], ['#f6798c', '#d9536a'], ['#5fa8e8', '#3c7fc0'],
];
function avatarGradientFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function drawAvatar(ctx, cx, cy, r, name, photoUrl) {
  const img = photoUrl ? IMG_CACHE.get(photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img && img.complete && img.naturalWidth) {
    // cover-fit
    const s = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    const [g1, g2] = avatarGradientFor(name || '?');
    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    grad.addColorStop(0, g1); grad.addColorStop(1, g2);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${Math.round(r * 0.82)}px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(name || '?'), cx, cy + r * 0.04);
  }
  ctx.restore();
}

function isEmojiOnly(text) {
  const t = text.trim();
  if (!t || t.length > 12) return false;
  try {
    const stripped = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\s]/gu, '');
    if (stripped !== '') return false;
    const count = [...new Intl.Segmenter().segment(t)].length;
    return count <= 3;
  } catch { return false; }
}

/* --------------------------------- timeline -------------------------------- */

// Timeline is computed in "content seconds"; playback speed scales elapsed time.
function computeTimeline(state) {
  const events = [];
  let t = 0.9;
  const msgs = state.messages;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const len = (m.text || '').length;
    let typingStart = null, typingDur = 0;
    if (m.sender === 'them' && state.showTyping) {
      typingDur = Math.min(2.6, Math.max(1.0, 0.8 + len * 0.03));
      typingStart = t;
      t += typingDur;
    }
    const appearAt = t;
    events.push({ index: i, typingStart, typingDur, appearAt });
    const readPause = Math.min(1.8, Math.max(0.65, 0.45 + len * 0.016));
    t += readPause;
  }
  return { events, duration: t + 1.4 };
}

/* ---------------------------------- layout --------------------------------- */

function wrapText(text, font, maxWidth) {
  _measureCtx.font = font;
  const lines = [];
  for (const rawLine of String(text).split('\n')) {
    const words = rawLine.split(' ');
    let line = '';
    for (const word of words) {
      const attempt = line ? line + ' ' + word : word;
      if (_measureCtx.measureText(attempt).width <= maxWidth || !line) {
        line = attempt;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, _measureCtx.measureText(l).width);
  return { lines, maxLineWidth: Math.min(maxW, maxWidth), lastLineWidth: _measureCtx.measureText(lines[lines.length - 1]).width };
}

// Lays out all bubbles top-to-bottom in content coordinates (y=0 at content top).
function layoutChat(chatW, state, style) {
  const msgs = state.messages;
  const avatarR = 14;
  const recvIndent = style.recvAvatar ? avatarR * 2 + 8 : 0;
  const sentIndent = style.sentAvatar ? avatarR * 2 + 8 : 0;
  const sideMargin = 14;
  const maxBubbleW = Math.min(chatW * 0.72, 480);
  const bubbles = [];
  let y = 12;

  const dayHeaderH = 26;
  y += dayHeaderH;

  // meta ("9:41 ✓✓") reserved width for WhatsApp-style bubbles
  _measureCtx.font = `11px ${FONT_STACK}`;
  const metaTimeW = _measureCtx.measureText('9:41').width;

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const prev = msgs[i - 1], next = msgs[i + 1];
    const gapTop = i === 0 ? 8 : (prev.sender === m.sender ? 3 : 12);
    y += gapTop;

    const isMe = m.sender === 'me';
    const groupFirst = !prev || prev.sender !== m.sender;
    const groupLast = !next || next.sender !== m.sender;

    const emojiOnly = isEmojiOnly(m.text);
    const fontSize = emojiOnly ? 44 : style.fontSize;
    const lineHeight = emojiOnly ? 52 : style.lineHeight;
    const font = `${fontSize}px ${FONT_STACK}`;
    const padH = emojiOnly ? 0 : 13;
    const padV = emojiOnly ? 2 : 7.5;
    const { lines, maxLineWidth, lastLineWidth } = wrapText(m.text || ' ', font, maxBubbleW - padH * 2);

    let w = Math.max(emojiOnly ? 10 : 34, maxLineWidth + padH * 2);
    let h = lines.length * lineHeight + padV * 2;
    let metaInline = false;
    if (style.meta && !emojiOnly) {
      const metaW = metaTimeW + (isMe ? 17 : 0) + 8;
      if (lastLineWidth + metaW + padH * 2 <= maxBubbleW) {
        w = Math.max(w, lastLineWidth + metaW + padH * 2);
        metaInline = true;
      } else {
        h += 13;
      }
    }

    const showTail = style.tail === 'imessage' ? (!emojiOnly && groupLast)
      : style.tail === 'whatsapp' ? (!emojiOnly && groupFirst)
      : false;

    bubbles.push({
      index: i, isMe, emojiOnly, lines, font, fontSize, lineHeight,
      x: isMe ? chatW - sideMargin - sentIndent - w : sideMargin + recvIndent,
      y, w, h, padH, padV, showTail, groupFirst, groupLast, metaInline,
      avatarR,
    });
    y += h;
  }

  // "Delivered" under the final sent message (iMessage only)
  let deliveredIdx = -1;
  if (style.delivered) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].sender === 'me') { deliveredIdx = i; break; }
    }
    if (deliveredIdx === msgs.length - 1 && deliveredIdx >= 0) y += 18;
    else deliveredIdx = -1;
  }

  const typingW = 62, typingH = 40;
  return { bubbles, contentHeight: y + 10, sideMargin, recvIndent, dayHeaderH, deliveredIdx, typingW, typingH };
}

/* -------------------------------- primitives ------------------------------- */

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function bubbleFill(ctx, b, bgSpec) {
  if (bgSpec && bgSpec.grad) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, bgSpec.grad[0]);
    g.addColorStop(1, bgSpec.grad[1]);
    return g;
  }
  return bgSpec;
}

function drawBubbleShape(ctx, b, style, bgSpec) {
  const r = Math.min(style.bubbleRadius, b.h / 2);
  ctx.fillStyle = bubbleFill(ctx, b, bgSpec);
  roundRect(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fill();
  if (!b.showTail) return;

  if (style.tail === 'imessage') {
    ctx.beginPath();
    if (b.isMe) {
      const bx = b.x + b.w, by = b.y + b.h;
      ctx.moveTo(bx - 8, by - 14);
      ctx.quadraticCurveTo(bx - 1, by - 3, bx + 5.5, by - 1);
      ctx.quadraticCurveTo(bx - 2, by + 1.5, bx - 10, by - 4);
    } else {
      const bx = b.x, by = b.y + b.h;
      ctx.moveTo(bx + 8, by - 14);
      ctx.quadraticCurveTo(bx + 1, by - 3, bx - 5.5, by - 1);
      ctx.quadraticCurveTo(bx + 2, by + 1.5, bx + 10, by - 4);
    }
    ctx.closePath();
    ctx.fill();
  } else if (style.tail === 'whatsapp') {
    // small triangle at the TOP outer corner (WhatsApp group-first bubble)
    ctx.beginPath();
    if (b.isMe) {
      ctx.moveTo(b.x + b.w - 6, b.y);
      ctx.lineTo(b.x + b.w + 7, b.y);
      ctx.quadraticCurveTo(b.x + b.w + 2, b.y + 4, b.x + b.w, b.y + 12);
    } else {
      ctx.moveTo(b.x + 6, b.y);
      ctx.lineTo(b.x - 7, b.y);
      ctx.quadraticCurveTo(b.x - 2, b.y + 4, b.x, b.y + 12);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawWhatsAppMeta(ctx, b, style) {
  const yBase = b.y + b.h - 9;
  let x = b.x + b.w - b.padH + 2;
  if (b.isMe) {
    // double check
    ctx.strokeStyle = style.tickColor;
    ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cy = yBase;
    ctx.beginPath();
    ctx.moveTo(x - 10, cy - 1); ctx.lineTo(x - 7, cy + 2); ctx.lineTo(x - 1.5, cy - 4.5);
    ctx.moveTo(x - 14, cy - 1); ctx.lineTo(x - 11.4, cy + 1.6);
    ctx.stroke();
    x -= 17;
  }
  ctx.fillStyle = style.metaColor;
  ctx.font = `11px ${FONT_STACK}`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('9:41', x, yBase);
}

/* -------------------------------- status bars ------------------------------ */

function drawBatteryIOS(ctx, x, cy, color) {
  ctx.strokeStyle = color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
  roundRect(ctx, x, cy - 6, 25, 12.5, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x + 26.8, cy + 0.25, 2, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  roundRect(ctx, x + 2, cy - 4, 17, 8.5, 2.5);
  ctx.fill();
}

function drawSignalBars(ctx, x, cy, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const h = 4.5 + i * 2.5;
    roundRect(ctx, x + i * 5.2, cy + 5.5 - h, 3.4, h, 1.2);
    ctx.fill();
  }
}

function drawWifi(ctx, x, cy, color) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const r = 3.2 + i * 3.5;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(x, cy + 5, r, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, cy + 4.4, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawStatusBar(ctx, d, lw, color) {
  const sb = d.statusBar;
  ctx.save();
  if (sb.style === 'ios') {
    const cy = d.cutout.type === 'dynamic-island' ? d.cutout.top + d.cutout.height / 2 : 26;
    const inset = Math.max(d.cornerRadius * 0.62, 30);
    ctx.fillStyle = color;
    ctx.font = `600 17px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('9:41', inset + 24, cy + 0.5);
    const rx = lw - inset - 24;
    drawBatteryIOS(ctx, rx - 3, cy, color);
    drawWifi(ctx, rx - 18, cy - 5, color);
    drawSignalBars(ctx, rx - 51, cy - 3, color);
  } else if (sb.style === 'ios-classic') {
    const cy = 10;
    ctx.fillStyle = color;
    ctx.font = `600 12px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('9:41 AM', lw / 2, cy + 0.5);
    ctx.save(); ctx.scale(0.75, 0.75);
    drawSignalBars(ctx, 6 / 0.75, (cy - 3) / 0.75, color);
    drawWifi(ctx, 46 / 0.75, (cy - 5) / 0.75, color);
    drawBatteryIOS(ctx, (lw - 33) / 0.75, cy / 0.75, color);
    ctx.restore();
  } else {
    const cy = Math.max(sb.height / 2, 17);
    ctx.fillStyle = color;
    ctx.font = `500 14px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const inset = Math.max(d.cornerRadius * 0.55, 22);
    ctx.fillText('9:41', inset, cy + 0.5);
    ctx.save(); ctx.scale(0.85, 0.85);
    drawWifi(ctx, (lw - inset - 46) / 0.85, (cy - 5) / 0.85, color);
    drawSignalBars(ctx, (lw - inset - 30) / 0.85, (cy - 3) / 0.85, color);
    ctx.restore();
    ctx.fillStyle = color;
    roundRect(ctx, lw - inset - 6.5, cy - 6.5, 6.5, 13, 2);
    ctx.fill();
    roundRect(ctx, lw - inset - 4.6, cy - 8, 2.8, 1.8, 0.8);
    ctx.fill();
  }
  ctx.restore();
}

function drawCutout(ctx, d, lw) {
  ctx.save();
  ctx.fillStyle = '#000';
  if (d.cutout.type === 'dynamic-island') {
    const c = d.cutout;
    if (d.landscape) {
      const x = c.top, cy = d.logicalHeight / 2;
      roundRect(ctx, x, cy - c.width / 2, c.height, c.width, c.height / 2);
      ctx.fill();
    } else {
      roundRect(ctx, (lw - c.width) / 2, c.top, c.width, c.height, c.height / 2);
      ctx.fill();
    }
  } else if (d.cutout.type === 'punch-hole') {
    const c = d.cutout;
    ctx.beginPath();
    if (d.landscape) {
      ctx.arc(c.centerY, d.logicalHeight / 2, c.radius, 0, Math.PI * 2);
    } else {
      ctx.arc(lw / 2, c.centerY, c.radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------------------------- glyphs --------------------------------- */

function drawChevronLeft(ctx, x, cy, size, color, width = 2.6) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.55, cy - size); ctx.lineTo(x - size * 0.45, cy); ctx.lineTo(x + size * 0.55, cy + size);
  ctx.stroke();
}

function drawVideoIcon(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  roundRect(ctx, cx - 11, cy - 7, 15, 14, 4); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 2.5); ctx.lineTo(cx + 11, cy - 6.5); ctx.lineTo(cx + 11, cy + 6.5); ctx.lineTo(cx + 4, cy + 2.5);
  ctx.closePath(); ctx.stroke();
}

// Classic telephone-handset outline (feather-icons "phone", 24×24 viewBox).
const PHONE_ICON_PATH = new Path2D(
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 ' +
  '19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 ' +
  '.7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 ' +
  '12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
);

function drawPhoneIcon(ctx, cx, cy, color) {
  const s = 18 / 24;
  ctx.save();
  ctx.translate(cx - 9, cy - 9);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(PHONE_ICON_PATH);
  ctx.restore();
}

/* -------------------------------- chat header ------------------------------ */

function drawHeader(ctx, d, chatW, sideInset, topSafe, style, state) {
  const name = state.contactName || 'Alex';
  let headerH;
  ctx.save();

  if (style.headerVariant === 'ios') {
    headerH = topSafe + 76;
    ctx.fillStyle = style.headerBg;
    ctx.fillRect(-sideInset, 0, chatW + sideInset * 2, headerH);
    strokeBottom();
    const acy = topSafe + 28, ar = 25;
    drawAvatar(ctx, chatW / 2, acy, ar, name, state.contactPhoto);
    ctx.fillStyle = style.headerText;
    ctx.font = `400 12.5px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name + ' ›', chatW / 2, acy + ar + 13);
    drawChevronLeft(ctx, 20, acy, 9, style.accent);
    drawVideoIcon(ctx, chatW - 30, acy, style.accent);
  } else if (style.headerVariant === 'center') {
    // TikTok: centered name
    headerH = topSafe + 50;
    ctx.fillStyle = style.headerBg;
    ctx.fillRect(-sideInset, 0, chatW + sideInset * 2, headerH);
    strokeBottom();
    const cy = topSafe + 24;
    ctx.fillStyle = style.headerText;
    ctx.font = `600 16.5px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, chatW / 2, cy);
    drawChevronLeft(ctx, 22, cy, 8, style.headerText, 2.2);
    ctx.fillStyle = style.headerSub;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(chatW - 24 + i * 6.5, cy, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // left-aligned bar (WhatsApp / Instagram / Messenger / Android)
    headerH = topSafe + 54;
    ctx.fillStyle = style.headerBg;
    ctx.fillRect(-sideInset, style.headerOverStatus ? -0.5 : 0, chatW + sideInset * 2, headerH);
    if (!style.headerOverStatus) strokeBottom();
    const cy = topSafe + 27;
    drawChevronLeft(ctx, 20, cy, 8.5, style.headerVariant === 'left' && style.id === 'messenger' ? style.accent : style.headerText, 2.4);
    const ax = 52, ar = 18;
    drawAvatar(ctx, ax, cy, ar, name, state.contactPhoto);
    ctx.fillStyle = style.headerText;
    ctx.font = `600 16.5px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const nameY = style.headerSubtitle ? cy - 8 : cy;
    ctx.fillText(name, ax + ar + 11, nameY + 1);
    if (style.headerSubtitle) {
      ctx.fillStyle = style.headerSub;
      ctx.font = `400 12px ${FONT_STACK}`;
      ctx.fillText(style.headerSubtitle, ax + ar + 11, cy + 10);
    }
    // right-side icons
    const iconColor = style.id === 'whatsapp' ? style.headerText
      : style.id === 'messenger' ? style.accent
      : style.headerText;
    if (style.id === 'whatsapp' || style.id === 'messenger' || style.id === 'instagram') {
      drawVideoIcon(ctx, chatW - 27, cy, iconColor);
      drawPhoneIcon(ctx, chatW - 66, cy, iconColor);
    } else {
      ctx.fillStyle = style.headerSub;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.arc(chatW - 24, cy + i * 7, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  ctx.restore();
  return headerH;

  function strokeBottom() {
    ctx.strokeStyle = style.separator || 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-sideInset, headerH); ctx.lineTo(chatW + sideInset, headerH); ctx.stroke();
  }
}

/* -------------------------------- input bar -------------------------------- */

function drawInputBar(ctx, d, chatW, sideInset, lh, bottomSafe, style) {
  const barH = 56;
  const y0 = lh - bottomSafe - barH;
  ctx.save();
  ctx.fillStyle = style.inputBarBg;
  ctx.fillRect(-sideInset, y0, chatW + sideInset * 2, barH + bottomSafe);

  const v = style.inputVariant;

  if (v === 'whatsapp') {
    const pw = chatW - 14 - 58, ph = 40, px = 12, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    // emoji face
    smiley(px + 21, py + ph / 2);
    ctx.fillStyle = style.inputText;
    ctx.font = `400 15.5px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 40, py + ph / 2 + 0.5);
    // camera glyph in pill
    camera(px + pw - 22, py + ph / 2);
    // green mic button
    ctx.fillStyle = style.accent;
    ctx.beginPath(); ctx.arc(chatW - 32, y0 + barH / 2, 20, 0, Math.PI * 2); ctx.fill();
    mic(chatW - 32, y0 + barH / 2, '#fff');
  } else if (v === 'instagram') {
    const px = 12, pw = chatW - 24, ph = 42, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    // camera bubble
    const g = ctx.createLinearGradient(px + 6, py + 4, px + 40, py + ph - 4);
    g.addColorStop(0, '#7a3ff2'); g.addColorStop(1, '#c32aa3');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px + 21, py + ph / 2, 15, 0, Math.PI * 2); ctx.fill();
    camera(px + 21, py + ph / 2, '#fff');
    ctx.fillStyle = style.inputText;
    ctx.font = `400 15px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 44, py + ph / 2 + 0.5);
    mic(px + pw - 22, py + ph / 2, style.inputText);
  } else if (v === 'messenger') {
    const cy = y0 + barH / 2;
    // icon row
    ctx.fillStyle = style.accent;
    plus(20, cy, style.accent);
    camera(52, cy, style.accent);
    mic(82, cy, style.accent);
    const px = 100, pw = chatW - px - 46, ph = 38, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = style.inputText;
    ctx.font = `400 15px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 14, py + ph / 2 + 0.5);
    // thumb
    thumb(chatW - 24, cy, style.accent);
  } else if (v === 'tiktok') {
    const px = 12, pw = chatW - 24 - 46, ph = 40, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = style.inputText;
    ctx.font = `400 15px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 16, py + ph / 2 + 0.5);
    smiley(px + pw - 20, py + ph / 2);
    // red send circle
    ctx.fillStyle = style.accent;
    ctx.beginPath(); ctx.arc(chatW - 32, y0 + barH / 2, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(chatW - 38, y0 + barH / 2 + 4); ctx.lineTo(chatW - 32, y0 + barH / 2 - 4); ctx.lineTo(chatW - 26, y0 + barH / 2 + 4);
    ctx.moveTo(chatW - 32, y0 + barH / 2 - 4); ctx.lineTo(chatW - 32, y0 + barH / 2 + 7);
    ctx.stroke();
  } else if (v === 'android') {
    const px = 14, pw = chatW - px * 2, ph = 40, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = style.inputText;
    ctx.font = `400 15px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 44, py + ph / 2 + 0.5);
    smiley(px + 24, py + ph / 2);
    plus(px + pw - 22, py + ph / 2, style.inputText);
  } else {
    // imessage
    ctx.fillStyle = style.id === 'imessage' && style.bg === '#000000' ? '#1c1c1e' : style.recvBg;
    ctx.beginPath(); ctx.arc(30, y0 + barH / 2, 15.5, 0, Math.PI * 2); ctx.fill();
    plus(30, y0 + barH / 2, style.inputText);
    const px = 54, pw = chatW - px - 14, ph = 35, py = y0 + (barH - ph) / 2;
    ctx.fillStyle = style.inputBg;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.strokeStyle = style.separator; ctx.lineWidth = 1;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.stroke();
    ctx.fillStyle = style.inputText;
    ctx.font = `400 16px ${FONT_STACK}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(style.inputPlaceholder, px + 14, py + ph / 2 + 0.5);
    mic(px + pw - 17, py + ph / 2, style.inputText);
  }
  ctx.restore();
  return y0;

  function smiley(cx, cy) {
    ctx.strokeStyle = style.inputText; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + 1, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = style.inputText;
    ctx.beginPath(); ctx.arc(cx - 3, cy - 2.5, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3, cy - 2.5, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  function camera(cx, cy, color) {
    ctx.strokeStyle = color || style.inputText; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    roundRect(ctx, cx - 9, cy - 6.5, 18, 13, 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, Math.PI * 2); ctx.stroke();
  }
  function mic(cx, cy, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    roundRect(ctx, cx - 3.5, cy - 9, 7, 11, 3.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 1.5, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 5.5); ctx.lineTo(cx, cy + 9); ctx.stroke();
  }
  function plus(cx, cy, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
    ctx.stroke();
  }
  function thumb(cx, cy, color) {
    ctx.fillStyle = color;
    roundRect(ctx, cx - 9, cy - 1, 5, 9, 1.5); ctx.fill();
    roundRect(ctx, cx - 3, cy - 8, 11, 16, 4); ctx.fill();
  }
}

/* ------------------------------ frame hardware ----------------------------- */

function drawDeviceFrame(ctx, d, screenX, screenY, screenW, screenH, unit) {
  const bezel = Math.max(screenW, screenH) * (d.homeButton ? 0.012 : 0.014);
  const topBottomExtra = d.homeButton ? Math.min(screenW, screenH) * 0.24 : 0;
  const fx = screenX - bezel, fy = screenY - bezel - topBottomExtra;
  const fw = screenW + bezel * 2, fh = screenH + bezel * 2 + topBottomExtra * 2;
  const outerR = d.cornerRadius * unit + bezel * (d.homeButton ? 6 : 1.6);

  ctx.save();
  ctx.fillStyle = shadeColor(d.frameColor, -18);
  const btn = (x, y, w, h) => { roundRect(ctx, x, y, w, h, Math.min(w, h) / 2); ctx.fill(); };
  const bw = bezel * 0.9;
  if (!d.landscape) {
    if (d.os === 'ios') {
      btn(fx - bw, fy + fh * 0.18, bw * 1.4, fh * 0.035);
      btn(fx - bw, fy + fh * 0.26, bw * 1.4, fh * 0.055);
      btn(fx - bw, fy + fh * 0.335, bw * 1.4, fh * 0.055);
      btn(fx + fw - bw * 0.4, fy + fh * 0.28, bw * 1.4, fh * 0.09);
    } else {
      btn(fx + fw - bw * 0.4, fy + fh * 0.22, bw * 1.4, fh * 0.1);
      btn(fx + fw - bw * 0.4, fy + fh * 0.345, bw * 1.4, fh * 0.06);
    }
  } else {
    if (d.os === 'ios') {
      btn(fx + fw * 0.18, fy + fh - bw * 0.4, fw * 0.035, bw * 1.4);
      btn(fx + fw * 0.26, fy + fh - bw * 0.4, fw * 0.055, bw * 1.4);
      btn(fx + fw * 0.335, fy + fh - bw * 0.4, fw * 0.055, bw * 1.4);
      btn(fx + fw * 0.28, fy - bw, fw * 0.09, bw * 1.4);
    } else {
      btn(fx + fw * 0.22, fy - bw, fw * 0.1, bw * 1.4);
      btn(fx + fw * 0.345, fy - bw, fw * 0.06, bw * 1.4);
    }
  }

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = bezel * 3;
  ctx.shadowOffsetY = bezel * 1.2;
  ctx.fillStyle = d.frameColor;
  roundRect(ctx, fx, fy, fw, fh, outerR);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const hl = ctx.createLinearGradient(fx, fy, fx, fy + fh);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)');
  hl.addColorStop(0.12, 'rgba(255,255,255,0.06)');
  hl.addColorStop(0.88, 'rgba(255,255,255,0.06)');
  hl.addColorStop(1, 'rgba(255,255,255,0.28)');
  ctx.strokeStyle = hl;
  ctx.lineWidth = Math.max(1, bezel * 0.14);
  roundRect(ctx, fx + ctx.lineWidth / 2, fy + ctx.lineWidth / 2, fw - ctx.lineWidth, fh - ctx.lineWidth, outerR);
  ctx.stroke();

  ctx.fillStyle = '#050505';
  roundRect(ctx, screenX - bezel * 0.45, screenY - bezel * 0.45, screenW + bezel * 0.9, screenH + bezel * 0.9, d.cornerRadius * unit + bezel * 0.45);
  ctx.fill();

  if (d.homeButton) {
    if (!d.landscape) {
      ctx.fillStyle = '#101013';
      roundRect(ctx, fx + fw / 2 - screenW * 0.09, fy + topBottomExtra * 0.48, screenW * 0.18, topBottomExtra * 0.1, topBottomExtra * 0.05);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + topBottomExtra * 0.24, topBottomExtra * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, bezel * 0.25);
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh - topBottomExtra * 0.53, topBottomExtra * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, bezel * 0.25);
      ctx.beginPath();
      ctx.arc(fx + fw - topBottomExtra * 0.53, fy + fh / 2, topBottomExtra * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

/* ------------------------------- master render ----------------------------- */

// Renders one frame at time t (content seconds) onto ctx sized canvasW×canvasH px.
function renderFrame(ctx, canvasW, canvasH, t, state, cache) {
  const d = resolveDevice(state);
  const lw = d.logicalWidth, lh = d.logicalHeight;
  const style = appStyle(state.app || 'whatsapp', state.darkMode);

  // preload participant photos so they pop in once loaded
  ensureImage(state.contactPhoto, cache.onImageLoad);
  ensureImage(state.myPhoto, cache.onImageLoad);

  // ---- canvas background
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (state.bgStyle === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    g.addColorStop(0, '#20242e'); g.addColorStop(0.55, '#171a21'); g.addColorStop(1, '#22262f');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = state.bgColor || '#17191e';
  }
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ---- device placement
  // deviceAngle is a SIDE-VIEW angle: the phone stays upright, the camera
  // moves up to 45° to the left/right (perspective yaw around the vertical
  // axis). Implemented as a column-by-column perspective warp of a flat
  // offscreen render.
  const angleDeg = Math.max(-45, Math.min(45, state.deviceAngle || 0));
  const rad = angleDeg * Math.PI / 180;

  // outer logical dims incl. frame hardware + shadow allowance
  const bezelL = state.showFrame ? Math.max(lw, lh) * (d.homeButton ? 0.012 : 0.014) : 0;
  const tbExtraL = state.showFrame && d.homeButton ? Math.min(lw, lh) * 0.24 : 0;
  const marginX = bezelL * 3 + 2;
  const marginY = bezelL * 3 + tbExtraL + 4;
  const outW = lw + (state.showFrame ? marginX * 2 : 0);
  const outH = lh + (state.showFrame ? marginY * 2 : 0);
  const pad = state.showFrame ? Math.min(canvasW, canvasH) * 0.05
    : (angleDeg !== 0 ? Math.min(canvasW, canvasH) * 0.02 : 0);

  if (angleDeg === 0) {
    const unit = Math.min((canvasW - pad * 2) / outW, (canvasH - pad * 2) / outH);
    ctx.save();
    ctx.translate((canvasW - lw * unit) / 2, (canvasH - lh * unit) / 2);
    drawDeviceAt(ctx, unit);
    ctx.restore();
  } else {
    // --- perspective fit (normalized: half-width 0.5, camera distance Dn)
    const c = Math.cos(rad), sn = Math.sin(rad), sAbs = Math.abs(sn);
    const Dn = 2.2;
    const kNear = Dn / (Dn - 0.5 * sAbs);                 // max column scale
    const projWN = 0.5 * c * Dn * (1 / (Dn - 0.5 * sAbs) + 1 / (Dn + 0.5 * sAbs));
    const unit = Math.min(
      (canvasW - pad * 2) / (outW * projWN),
      (canvasH - pad * 2) / (outH * kNear)
    );

    // --- flat render into offscreen at supersampled resolution
    const offUnit = unit * kNear;
    const offW = Math.ceil(outW * offUnit), offH = Math.ceil(outH * offUnit);
    if (!cache.persp || cache.persp.width !== offW || cache.persp.height !== offH) {
      cache.persp = document.createElement('canvas');
      cache.persp.width = offW; cache.persp.height = offH;
    }
    const off = cache.persp;
    const offCtx = off.getContext('2d');
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, offW, offH);
    offCtx.save();
    offCtx.translate((offW - lw * offUnit) / 2, (offH - lh * offUnit) / 2);
    drawDeviceAt(offCtx, offUnit);
    offCtx.restore();

    // shade the far side for depth (device pixels only)
    const shade = offCtx.createLinearGradient(0, 0, offW, 0);
    const maxShade = 0.28 * sAbs;
    if (sn > 0) { // viewed from the right → left edge is far
      shade.addColorStop(0, `rgba(0,0,0,${maxShade})`);
      shade.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, `rgba(0,0,0,${maxShade})`);
    }
    offCtx.globalCompositeOperation = 'source-atop';
    offCtx.fillStyle = shade;
    offCtx.fillRect(0, 0, offW, offH);
    offCtx.globalCompositeOperation = 'source-over';

    // --- column warp: plane width Wf, camera distance D (main-canvas px)
    const Wf = outW * unit, Hf = outH * unit;
    const D = Dn * Wf;
    const proj = (u) => u * c * D / (D - u * sn);
    const inv = (xp) => xp * D / (c * D + xp * sn);
    const xpA = proj(-Wf / 2), xpB = proj(Wf / 2);
    const left = Math.min(xpA, xpB), right = Math.max(xpA, xpB);
    const cx0 = canvasW / 2, cy0 = canvasH / 2;
    const step = (right - left) > 1300 ? 2 : 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (let dx = Math.floor(left); dx < right; dx += step) {
      const u0 = inv(dx), u1 = inv(dx + step);
      const um = (u0 + u1) / 2;
      const k = D / (D - um * sn);
      const sx0 = (u0 / Wf + 0.5) * offW;
      const sx1 = (u1 / Wf + 0.5) * offW;
      const colH = Hf * k;
      ctx.drawImage(off,
        Math.min(sx0, sx1), 0, Math.max(Math.abs(sx1 - sx0), 0.5), offH,
        cx0 + dx, cy0 - colH / 2, step, colH);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return;

  // Draws the full device (frame + screen content) with the screen's top-left
  // corner at the current transform origin, at scale `unit` px per logical pt.
  function drawDeviceAt(ctx, unit) {

  if (state.showFrame) {
    drawDeviceFrame(ctx, d, 0, 0, lw * unit, lh * unit, unit);
  }

  // ---- clip to rounded screen and switch to logical coordinates
  ctx.save();
  ctx.scale(unit, unit);
  roundRect(ctx, 0, 0, lw, lh, d.cornerRadius);
  ctx.clip();

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, lw, lh);

  // ---- horizontal safe-area inset (cutout sits on the left edge in landscape)
  const sideInset = d.landscape
    ? (d.cutout.type === 'dynamic-island' ? 56 : d.cutout.type === 'punch-hole' ? 36 : 0)
    : 0;
  const chatW = lw - sideInset * 2;

  // ---- layout + timeline (cached)
  const layoutKey = JSON.stringify([state.messages, chatW, style.id, state.darkMode]);
  if (!cache.layout || cache.layoutKey !== layoutKey) {
    cache.layout = layoutChat(chatW, state, style);
    cache.layoutKey = layoutKey;
  }
  const tlKey = JSON.stringify([state.messages.map(m => [m.sender, (m.text || '').length]), state.showTyping]);
  if (!cache.timeline || cache.timelineKey !== tlKey) {
    cache.timeline = computeTimeline(state);
    cache.timelineKey = tlKey;
  }
  const layout = cache.layout;
  const { events } = cache.timeline;

  // ---- safe areas
  const topSafe = d.landscape && d.cutout.type !== 'none'
    ? Math.max(24, d.statusBar.height * 0.6)
    : d.statusBar.height;
  const bottomSafe = d.homeIndicator ? (d.landscape ? 20 : 30) : 6;

  ctx.save();
  ctx.translate(sideInset, 0);
  const headerH = drawHeader(ctx, d, chatW, sideInset, topSafe, style, state);
  const inputTop = lh - bottomSafe - 56;
  const contentTop = headerH;
  const visibleH = inputTop - contentTop - 8;

  // ---- which messages are visible at time t, and typing state
  let lastAppeared = -1, typingActive = false;
  for (const ev of events) {
    if (t >= ev.appearAt) lastAppeared = ev.index;
    else {
      if (ev.typingStart !== null && t >= ev.typingStart) typingActive = true;
      break;
    }
  }

  // ---- scroll position
  const heightAfter = (idx, withTyping) => {
    if (idx < 0) return layout.dayHeaderH + 20 + (withTyping ? layout.typingH + 12 : 0);
    const b = layout.bubbles[idx];
    let h = b.y + b.h + 8;
    if (idx === layout.deliveredIdx) h += 18;
    if (withTyping) h += layout.typingH + 12;
    return h;
  };
  const targetScroll = (idx, withTyping) => Math.max(0, heightAfter(idx, withTyping) - visibleH);

  let scroll;
  {
    const cur = targetScroll(lastAppeared, typingActive);
    let changeAt = 0, prevTarget = 0;
    for (const ev of events) {
      if (ev.typingStart !== null && t >= ev.typingStart && t < ev.appearAt) {
        changeAt = ev.typingStart;
        prevTarget = targetScroll(ev.index - 1, false);
        break;
      }
      if (t >= ev.appearAt) {
        changeAt = ev.appearAt;
        prevTarget = ev.typingStart !== null
          ? targetScroll(ev.index - 1, true)
          : targetScroll(ev.index - 1, false);
      }
    }
    const p = easeOutCubic(clamp01((t - changeAt) / 0.4));
    scroll = prevTarget + (cur - prevTarget) * p;
  }

  // ---- draw messages (clipped to content area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, contentTop, chatW, inputTop - contentTop);
  ctx.clip();
  ctx.translate(0, contentTop + 4 - scroll);

  // day header
  if (style.dayVariant === 'chip') {
    _measureCtx.font = `600 11px ${FONT_STACK}`;
    const tw = _measureCtx.measureText('TODAY').width;
    ctx.fillStyle = style.dayChipBg;
    roundRect(ctx, chatW / 2 - tw / 2 - 12, 12, tw + 24, 22, 6);
    ctx.fill();
    ctx.fillStyle = style.dayText;
    ctx.font = `600 11px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TODAY', chatW / 2, 23.5);
  } else {
    ctx.fillStyle = style.dayText;
    ctx.font = `600 12px ${FONT_STACK}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Today 9:41 AM', chatW / 2, 12 + layout.dayHeaderH / 2);
  }

  const lastVisibleInGroup = (idx) => {
    // last APPEARED bubble of this sender-group (avatar sits beside it)
    const b = layout.bubbles[idx];
    for (let j = idx + 1; j <= lastAppeared && j < layout.bubbles.length; j++) {
      if (layout.bubbles[j].isMe === b.isMe) return false;
      break;
    }
    return true;
  };

  for (const b of layout.bubbles) {
    if (b.index > lastAppeared) break;
    const ev = events[b.index];
    const p = clamp01((t - ev.appearAt) / 0.32);
    const eased = easeOutBack(p);

    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 2);
    const ax = b.isMe ? b.x + b.w : b.x;
    const ay = b.y + b.h;
    ctx.translate(ax, ay + (1 - eased) * 14);
    ctx.scale(0.86 + 0.14 * eased, 0.86 + 0.14 * eased);
    ctx.translate(-ax, -ay);

    if (b.emojiOnly) {
      ctx.font = b.font;
      ctx.textAlign = b.isMe ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = style.recvText;
      b.lines.forEach((line, li) => {
        ctx.fillText(line, b.isMe ? b.x + b.w : b.x, b.y + b.padV + (li + 0.5) * b.lineHeight);
      });
    } else {
      drawBubbleShape(ctx, b, style, b.isMe ? style.sentBg : style.recvBg);
      ctx.fillStyle = b.isMe ? style.sentText : style.recvText;
      ctx.font = b.font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      b.lines.forEach((line, li) => {
        ctx.fillText(line, b.x + b.padH, b.y + b.padV + (li + 0.5) * b.lineHeight + 0.5);
      });
      if (style.meta) drawWhatsAppMeta(ctx, b, style);
    }
    ctx.restore();

    // avatars beside the last appeared bubble of each group
    if (p > 0.05 && lastVisibleInGroup(b.index)) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2);
      if (!b.isMe && style.recvAvatar) {
        drawAvatar(ctx, layout.sideMargin + b.avatarR, b.y + b.h - b.avatarR, b.avatarR, state.contactName || 'Alex', state.contactPhoto);
      }
      if (b.isMe && style.sentAvatar) {
        drawAvatar(ctx, chatW - layout.sideMargin - b.avatarR, b.y + b.h - b.avatarR, b.avatarR, state.myName || 'Me', state.myPhoto);
      }
      ctx.restore();
    }

    if (b.index === layout.deliveredIdx && p >= 1) {
      ctx.fillStyle = style.metaColor || style.dayText;
      ctx.font = `500 11.5px ${FONT_STACK}`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('Delivered', b.x + b.w - 2, b.y + b.h + 12);
    }
  }

  // typing indicator
  if (typingActive) {
    const lastB = lastAppeared >= 0 ? layout.bubbles[lastAppeared] : null;
    let ty = lastB ? lastB.y + lastB.h + 10 : layout.dayHeaderH + 22;
    if (lastAppeared === layout.deliveredIdx && lastAppeared >= 0) ty += 18;
    const tw = layout.typingW, th = layout.typingH;
    const tb = {
      x: layout.sideMargin + layout.recvIndent, y: ty, w: tw, h: th,
      isMe: false, showTail: style.tail !== 'none', groupFirst: true, groupLast: true,
    };
    const ev = events.find(e => e.typingStart !== null && t >= e.typingStart && t < e.appearAt);
    const tp = ev ? easeOutBack(clamp01((t - ev.typingStart) / 0.25)) : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, tp * 2);
    ctx.translate(tb.x, tb.y + th);
    ctx.scale(tp, tp);
    ctx.translate(-tb.x, -(tb.y + th));
    drawBubbleShape(ctx, tb, style, style.recvBg);
    const isDarkBubble = state.darkMode;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 2.4 - i * 0.28) % 1.4;
      const bounce = Math.max(0, Math.sin(Math.min(phase, 1) * Math.PI)) * 0.55 + 0.45;
      ctx.fillStyle = isDarkBubble
        ? `rgba(200,200,205,${0.35 + bounce * 0.5})`
        : `rgba(120,120,128,${0.35 + bounce * 0.5})`;
      ctx.beginPath();
      ctx.arc(tb.x + 18 + i * 13, tb.y + th / 2 - (bounce - 0.45) * 4, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (style.recvAvatar) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tp * 2);
      drawAvatar(ctx, layout.sideMargin + 14, ty + th - 14, 14, state.contactName || 'Alex', state.contactPhoto);
      ctx.restore();
    }
  }

  ctx.restore(); // content clip

  drawInputBar(ctx, d, chatW, sideInset, lh, bottomSafe, style);
  ctx.restore(); // side-inset translate

  drawStatusBar(ctx, d, lw, style.statusBar);
  drawCutout(ctx, d, lw);

  // home indicator / gesture bar
  if (d.homeIndicator) {
    ctx.fillStyle = style.homeBar;
    const hw = d.os === 'ios' ? 140 : 110;
    roundRect(ctx, (lw - hw) / 2, lh - 9, hw, 5, 2.5);
    ctx.fill();
  }

  ctx.restore(); // screen clip + logical scale
  } // end drawDeviceAt
}

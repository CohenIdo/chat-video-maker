// Synthesized UI sounds (WebAudio — no audio files).
// Each chat app gets its own send/receive character: WhatsApp's double
// "da-ding", iMessage's swoosh, Messenger's bubble pop, etc. These are
// original approximations, not the copyrighted recordings.
// One engine can feed the speakers (preview) or a MediaStreamDestination
// (video export) so exported videos include the sounds.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.out = null;       // GainNode master
    this.recDest = null;   // optional MediaStreamAudioDestinationNode
  }

  // Must be called from a user gesture at least once (browser autoplay policy).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.9;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // Route a copy of the output into a recording destination; returns its stream.
  attachRecorder() {
    if (!this.ensure()) return null;
    this.recDest = this.ctx.createMediaStreamDestination();
    this.out.connect(this.recDest);
    return this.recDest.stream;
  }

  detachRecorder() {
    if (this.recDest) {
      try { this.out.disconnect(this.recDest); } catch { /* already gone */ }
      this.recDest = null;
    }
  }

  /* ------------------------------ synth helpers ----------------------------- */

  // Single tone with attack/decay envelope. freqEnd enables a pitch glide.
  _tone({ freq, freqEnd, at = 0, dur = 0.12, peak = 0.2, type = 'sine' }) {
    const t0 = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.out);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // Filtered noise burst; sweep the bandpass for whoosh effects.
  _noise({ at = 0, dur = 0.05, peak = 0.2, freq = 2800, freqEnd, q = 1.2, fadeIn = 0.006 }) {
    const t0 = this.ctx.currentTime + at;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(freq, t0);
    if (freqEnd) bp.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + fadeIn);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(this.out);
    src.start(t0);
  }

  /* ------------------------------- public sfx ------------------------------- */

  // Short tick — keyboard tap.
  keyClick() {
    if (!this.ensure()) return;
    this._noise({ dur: 0.028, peak: 0.18, freq: 2900 });
  }

  send(app) {
    if (!this.ensure()) return;
    switch (app) {
      case 'whatsapp':
        // soft woody "thock"
        this._tone({ freq: 620, freqEnd: 390, dur: 0.075, peak: 0.24, type: 'sine' });
        this._noise({ dur: 0.02, peak: 0.06, freq: 1800 });
        break;
      case 'imessage':
        // the famous air swoosh, ending in a tiny pop
        this._noise({ dur: 0.3, peak: 0.16, freq: 2100, freqEnd: 420, q: 0.8, fadeIn: 0.06 });
        this._tone({ freq: 700, freqEnd: 480, at: 0.2, dur: 0.07, peak: 0.12 });
        break;
      case 'messenger':
        // punchy bubble pop
        this._tone({ freq: 950, freqEnd: 330, dur: 0.07, peak: 0.26, type: 'sine' });
        break;
      case 'instagram':
        // gentle pluck
        this._tone({ freq: 1150, freqEnd: 750, dur: 0.06, peak: 0.16, type: 'triangle' });
        break;
      case 'tiktok':
        this._tone({ freq: 880, freqEnd: 520, dur: 0.06, peak: 0.2 });
        break;
      default: // android
        this._tone({ freq: 520, freqEnd: 900, dur: 0.09, peak: 0.18 });
    }
  }

  receive(app) {
    if (!this.ensure()) return;
    switch (app) {
      case 'whatsapp':
        // bright ascending double note — "da-ding!"
        this._tone({ freq: 1046, dur: 0.09, peak: 0.2, type: 'triangle' });
        this._tone({ freq: 1568, at: 0.085, dur: 0.16, peak: 0.24, type: 'triangle' });
        break;
      case 'imessage':
        // glassy two-note ding
        this._tone({ freq: 1100, dur: 0.3, peak: 0.16, type: 'triangle' });
        this._tone({ freq: 1650, dur: 0.22, peak: 0.07, type: 'sine' });
        this._tone({ freq: 1400, at: 0.11, dur: 0.32, peak: 0.18, type: 'triangle' });
        break;
      case 'messenger':
        // low double pop
        this._tone({ freq: 640, freqEnd: 260, dur: 0.07, peak: 0.24 });
        this._tone({ freq: 800, freqEnd: 380, at: 0.07, dur: 0.06, peak: 0.14 });
        break;
      case 'instagram':
        this._tone({ freq: 830, dur: 0.07, peak: 0.16, type: 'triangle' });
        this._tone({ freq: 1050, at: 0.06, dur: 0.09, peak: 0.14, type: 'triangle' });
        break;
      case 'tiktok':
        this._tone({ freq: 700, freqEnd: 980, dur: 0.09, peak: 0.18 });
        break;
      default: // android — soft ascending Material two-tone
        this._tone({ freq: 740, dur: 0.09, peak: 0.16, type: 'triangle' });
        this._tone({ freq: 988, at: 0.08, dur: 0.14, peak: 0.18, type: 'triangle' });
    }
  }
}

const Sounds = new SoundEngine();

// Fires sounds for timeline events crossed between prevT and curT.
// Shared by the preview loop and the exporter.
function triggerTimelineSounds(engine, timeline, messages, showKeyboard, prevT, curT, app) {
  if (curT < prevT) return; // loop restart — no retroactive sounds
  for (const ev of timeline.events) {
    const m = messages[ev.index];
    if (!m) continue;
    if (prevT < ev.appearAt && ev.appearAt <= curT) {
      m.sender === 'me' ? engine.send(app) : engine.receive(app);
    }
    // keyboard typing clicks for outgoing messages
    if (showKeyboard && m.sender === 'me' && ev.typingStart !== null && ev.typingDur > 0) {
      const len = Math.max(1, (m.text || '').length);
      const charAt = (tt) => Math.floor(Math.max(0, Math.min(1, (tt - ev.typingStart) / ev.typingDur)) * len);
      if (curT > ev.typingStart && prevT < ev.appearAt && charAt(curT) > charAt(prevT)) {
        engine.keyClick(); // max one click per frame — reads as rapid typing
      }
    }
  }
}

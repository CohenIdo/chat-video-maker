// Synthesized UI sounds (WebAudio — no audio files).
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

  _env(node, t0, peak, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(this.out);
    return g;
  }

  // Short filtered noise tick — keyboard tap.
  keyClick() {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const len = 0.03;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 1.2;
    src.connect(bp);
    this._env(bp, t0, 0.22, len);
    src.start(t0);
  }

  // Rising swoosh — message sent.
  send() {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(480, t0);
    o.frequency.exponentialRampToValueAtTime(950, t0 + 0.1);
    this._env(o, t0, 0.28, 0.16);
    o.start(t0); o.stop(t0 + 0.18);
  }

  // Soft two-tone pop — message received.
  receive() {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    for (const [freq, dt, peak] of [[660, 0, 0.22], [880, 0.07, 0.18]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      this._env(o, t0 + dt, peak, 0.14);
      o.start(t0 + dt); o.stop(t0 + dt + 0.16);
    }
  }
}

const Sounds = new SoundEngine();

// Fires sounds for timeline events crossed between prevT and curT.
// Shared by the preview loop and the exporter.
function triggerTimelineSounds(engine, timeline, messages, showKeyboard, prevT, curT) {
  if (curT < prevT) return; // loop restart — no retroactive sounds
  for (const ev of timeline.events) {
    const m = messages[ev.index];
    if (!m) continue;
    if (prevT < ev.appearAt && ev.appearAt <= curT) {
      m.sender === 'me' ? engine.send() : engine.receive();
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

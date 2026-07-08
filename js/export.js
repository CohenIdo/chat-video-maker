// Video export: renders the timeline onto a hidden canvas at the exact export
// resolution and records it with MediaRecorder. Because export uses the same
// renderFrame() as the preview, output is pixel-perfect at any size.

const Exporter = {
  active: false,
  _cancel: false,

  pickMimeType(withAudio) {
    const candidates = withAudio ? [
      'video/mp4;codecs=avc1.640033,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ] : [
      'video/mp4;codecs=avc1.640033',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  },

  cancel() { this._cancel = true; },

  async export(state, { onProgress, onDone, onError }) {
    if (this.active) return;
    this.active = true;
    this._cancel = false;

    try {
      const { width, height } = resolveExportSize(state);
      const fps = state.exportFps || 60;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      const cache = {};
      const timeline = computeTimeline(state);
      const speed = state.playbackSpeed || 1;

      // include synthesized sounds in the recording when enabled
      const wantAudio = !!state.soundsEnabled && !!(window.AudioContext || window.webkitAudioContext);
      const audioStream = wantAudio ? Sounds.attachRecorder() : null;

      const mimeType = this.pickMimeType(!!audioStream);
      if (!mimeType) throw new Error('MediaRecorder is not supported in this browser.');

      const stream = canvas.captureStream(fps);
      if (audioStream) {
        for (const tr of audioStream.getAudioTracks()) stream.addTrack(tr);
      }
      const bitrate = Math.min(60_000_000, Math.max(6_000_000, Math.round(width * height * fps * 0.12)));
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

      const done = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (e) => reject(e.error || new Error('Recorder error'));
      });

      // Prime the first frame before starting so the video doesn't open black.
      renderFrame(ctx, width, height, 0, state, cache);
      recorder.start(250);

      // setInterval (not rAF) so the export survives a hidden/background tab.
      // If the timer stalls (tab throttling), clamp the step to one frame so
      // content is never skipped — the video freezes briefly instead.
      await new Promise((resolve) => {
        let contentT = 0;
        let lastNow = performance.now();
        const timer = setInterval(() => {
          if (this._cancel) { clearInterval(timer); return resolve(); }
          const now = performance.now();
          let dt = (now - lastNow) / 1000;
          lastNow = now;
          if (dt > 0.25) dt = 1 / fps;
          const prevT = contentT;
          contentT = Math.min(contentT + dt * speed, timeline.duration);
          renderFrame(ctx, width, height, contentT, state, cache);
          if (audioStream) {
            triggerTimelineSounds(Sounds, timeline, state.messages, state.showKeyboard, prevT, contentT, state.app);
          }
          onProgress && onProgress(Math.min(1, contentT / timeline.duration));
          if (contentT >= timeline.duration) { clearInterval(timer); resolve(); }
        }, 1000 / fps);
      });

      recorder.stop();
      await done;
      stream.getTracks().forEach(tr => tr.stop());
      if (audioStream) Sounds.detachRecorder();

      if (this._cancel) {
        onDone && onDone(null);
        return;
      }

      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      const device = getDevice(state.deviceId);
      const filename = `conversation_${device.id}_${width}x${height}.${ext}`;
      onDone && onDone({ blob, filename, width, height, ext });
    } catch (err) {
      console.error(err);
      onError && onError(err);
    } finally {
      Sounds.detachRecorder();
      this.active = false;
    }
  },
};

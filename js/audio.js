// WebAudio による効果音合成（音声ファイル不使用）
// ブラウザの自動再生制限のため、最初のユーザー操作で unlock() する。
SV.audio = (function () {
  let ctx = null, master = null, crowdGain = null, noiseBuf = null;
  let muted = false;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    // ホワイトノイズのバッファ（打球・歓声の素材）
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startCrowd();
  }

  function noise(dur, freq, q, gain, type, when) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // 観客の環境音（ループするフィルタノイズ）
  function startCrowd() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0.03;
    src.connect(f); f.connect(crowdGain); crowdGain.connect(master);
    src.start();
  }

  const sfx = {
    bump() { noise(0.12, 700, 1.2, 0.8); tone(180, 0.1, 'sine', 0.35, 0, 90); },
    set() { noise(0.08, 1400, 2, 0.5); tone(320, 0.07, 'triangle', 0.15); },
    spike() { noise(0.18, 1000, 0.8, 1.2); tone(140, 0.18, 'sine', 0.6, 0, 50); },
    superSpike() {
      noise(0.35, 600, 0.5, 1.4); tone(120, 0.35, 'sawtooth', 0.25, 0, 40);
      tone(900, 0.4, 'sine', 0.15, 0.02, 2400);
    },
    serve() { noise(0.14, 900, 1, 0.9); tone(160, 0.12, 'sine', 0.4, 0, 70); },
    block() { noise(0.2, 400, 0.7, 1.2); tone(90, 0.2, 'square', 0.15, 0, 50); },
    floor() { noise(0.15, 300, 0.8, 0.7); tone(100, 0.15, 'sine', 0.5, 0, 45); },
    net() { noise(0.25, 2500, 0.5, 0.3, 'highpass'); },
    jump() { tone(220, 0.12, 'sine', 0.1, 0, 400); },
    toss() { tone(500, 0.08, 'sine', 0.08, 0, 700); },
    swingMiss() { noise(0.2, 2000, 3, 0.25); },
    whistle() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [2600, 2650].forEach((f) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 32;
        const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.setValueAtTime(0.05, t + 0.38); g.gain.linearRampToValueAtTime(0, t + 0.45);
        const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 4000;
        o.connect(f2); f2.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5);
      });
    },
    cheer(amount) {
      if (!ctx) return;
      const a = amount || 1;
      for (let i = 0; i < 4; i++) noise(1.6 + i * 0.3, 700 + i * 350, 0.7, 0.18 * a, 'bandpass', i * 0.05);
      if (crowdGain) {
        const t = ctx.currentTime;
        crowdGain.gain.cancelScheduledValues(t);
        crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
        crowdGain.gain.linearRampToValueAtTime(0.03 + 0.12 * a, t + 0.2);
        crowdGain.gain.linearRampToValueAtTime(0.03, t + 2.5);
      }
    },
    ooh() { if (ctx) { noise(1.2, 400, 2, 0.15); tone(260, 1.0, 'sine', 0.03, 0, 200); } },
    point(good) {
      const notes = good ? [523, 659, 784, 1047] : [392, 330];
      notes.forEach((n, i) => tone(n, 0.18, 'triangle', 0.16, i * 0.09));
    },
    fanfare() {
      const seq = [523, 523, 523, 659, 784, 0, 659, 784, 1047];
      seq.forEach((n, i) => { if (n) { tone(n, 0.22, 'square', 0.07, i * 0.13); tone(n / 2, 0.22, 'triangle', 0.1, i * 0.13); } });
    },
    perfect() { tone(1200, 0.12, 'sine', 0.12); tone(1800, 0.15, 'sine', 0.1, 0.06); },
    ui() { tone(880, 0.06, 'square', 0.06); },
    slowmo() { tone(300, 0.6, 'sine', 0.12, 0, 80); noise(0.6, 200, 0.5, 0.3, 'lowpass'); },
  };

  function play(name, arg) { if (sfx[name]) sfx[name](arg); }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.7;
    return muted;
  }
  return { unlock, play, toggleMute, get ready() { return !!ctx; }, get muted() { return muted; } };
})();
